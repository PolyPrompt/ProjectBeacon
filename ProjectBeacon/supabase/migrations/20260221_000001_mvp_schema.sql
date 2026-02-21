create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  deadline timestamptz not null,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  planning_status text not null default 'draft' check (planning_status in ('draft', 'locked', 'assigned')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (project_id, user_id)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (name)
);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  level smallint not null check (level between 1 and 5),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, skill_id)
);

create table if not exists public.project_member_skills (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  level smallint not null check (level between 1 and 5),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (project_id, user_id, skill_id),
  foreign key (project_id, user_id) references public.project_members(project_id, user_id) on delete cascade
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignee_user_id uuid references public.users(id) on delete set null,
  title text not null,
  description text not null,
  difficulty_points smallint not null check (difficulty_points in (1, 2, 3, 5, 8)),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  due_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (project_id, id)
);

create table if not exists public.task_required_skills (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  weight smallint check (weight between 1 and 5),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (task_id, skill_id)
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade,
  foreign key (project_id, depends_on_task_id) references public.tasks(project_id, id) on delete cascade
);

create table if not exists public.project_contexts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('text', 'pdf', 'doc')),
  context_type text not null check (context_type in ('initial', 'clarification_qa', 'assumption', 'document_extract')),
  title text,
  text_content text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_key text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.task_reassignment_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  request_type text not null check (request_type in ('swap', 'handoff')),
  task_id uuid not null,
  counterparty_task_id uuid,
  from_user_id uuid not null references public.users(id) on delete restrict,
  to_user_id uuid not null references public.users(id) on delete restrict,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  requested_by_user_id uuid not null references public.users(id) on delete restrict,
  responded_by_user_id uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  responded_at timestamptz,
  check (
    (request_type = 'swap' and counterparty_task_id is not null)
    or (request_type = 'handoff' and counterparty_task_id is null)
  ),
  check (from_user_id <> to_user_id),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade,
  foreign key (project_id, counterparty_task_id) references public.tasks(project_id, id) on delete cascade
);

create index if not exists idx_projects_owner_user_id on public.projects(owner_user_id);
create index if not exists idx_project_members_project_id on public.project_members(project_id);
create index if not exists idx_project_members_user_id on public.project_members(user_id);
create index if not exists idx_user_skills_user_id on public.user_skills(user_id);
create index if not exists idx_project_member_skills_project_user on public.project_member_skills(project_id, user_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_assignee_user_id on public.tasks(assignee_user_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_task_dependencies_project_id on public.task_dependencies(project_id);
create index if not exists idx_project_contexts_project_id on public.project_contexts(project_id);
create index if not exists idx_project_contexts_context_type on public.project_contexts(context_type);
create index if not exists idx_project_documents_project_id on public.project_documents(project_id);
create index if not exists idx_task_reassignment_requests_project_id on public.task_reassignment_requests(project_id);
create index if not exists idx_task_reassignment_requests_status on public.task_reassignment_requests(status);

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create trigger user_skills_set_updated_at
before update on public.user_skills
for each row
execute function public.set_updated_at();

create trigger project_member_skills_set_updated_at
before update on public.project_member_skills
for each row
execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create trigger project_contexts_set_updated_at
before update on public.project_contexts
for each row
execute function public.set_updated_at();
