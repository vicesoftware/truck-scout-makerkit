-- Create PostgREST-compatible wrapper function
create or replace function public.has_permission(
  p_account_id uuid,
  p_permission public.app_permissions
)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists(
    select 1
    from public.accounts_memberships
    join public.role_permissions on
      accounts_memberships.account_role = role_permissions.role
    where
      accounts_memberships.user_id = auth.uid()
      and accounts_memberships.account_id = p_account_id
      and role_permissions.permission = p_permission);
end;
$$;

-- Grant execute permissions
grant execute on function public.has_permission(uuid, public.app_permissions) to authenticated;
