alter table public.project_members
add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
