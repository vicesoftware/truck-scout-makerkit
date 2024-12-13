-- Enable moddatetime extension
create extension if not exists moddatetime schema extensions;

-- Create account_user table
create table if not exists public.account_user (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, account_id)
);

-- Add updated_at trigger
create trigger handle_updated_at before update on public.account_user
  for each row execute procedure moddatetime (updated_at);

-- Grant access to authenticated users
grant all on public.account_user to authenticated;
grant all on public.account_user to service_role;

-- Rename the RLS migration to ensure it runs after table creation
