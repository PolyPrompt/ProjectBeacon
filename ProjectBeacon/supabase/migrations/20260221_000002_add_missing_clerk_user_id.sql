alter table public.users
add column if not exists clerk_user_id text;

create unique index if not exists users_clerk_user_id_key
on public.users (clerk_user_id);
