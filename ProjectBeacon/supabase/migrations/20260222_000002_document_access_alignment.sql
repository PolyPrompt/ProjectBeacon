alter table public.project_documents
add column if not exists is_public boolean not null default false,
add column if not exists used_for_planning boolean not null default false;

create table if not exists public.project_document_access (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.project_documents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (document_id, user_id)
);

create index if not exists idx_project_document_access_document_id
  on public.project_document_access(document_id);

create index if not exists idx_project_document_access_user_id
  on public.project_document_access(user_id);

create index if not exists idx_project_documents_used_for_planning
  on public.project_documents(project_id, used_for_planning);
