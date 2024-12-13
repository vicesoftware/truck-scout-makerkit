-- Enable RLS on account_user table
alter table public.account_user enable row level security;

-- Grant access to authenticated users
grant all on public.account_user to authenticated;
grant all on public.account_user to service_role;

-- Create policies for account_user table
create policy "Users can read account_user entries they are members of"
  on public.account_user
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.account_user au
      where au.account_id = account_user.account_id
      and au.user_id = auth.uid()
    )
  );

create policy "Service role can manage all account_user entries"
  on public.account_user
  for all
  to service_role
  using (true)
  with check (true);

create policy "Users can insert account_user entries for their accounts"
  on public.account_user
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.account_user au
      where au.account_id = account_user.account_id
      and au.user_id = auth.uid()
      and au.role = 'owner'
    )
  );
