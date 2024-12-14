-- Create internal has_permission function
create or replace function public.has_permission_internal(
  account_id uuid,
  permission_name public.app_permissions,
  user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
as $$
declare
  user_role text;
begin
  -- Get the user's role for the specified account
  select account_role into user_role
  from public.accounts_memberships
  where accounts_memberships.account_id = $1
  and accounts_memberships.user_id = $3;

  -- If no role found, user doesn't have access
  if user_role is null then
    raise exception 'new row violates row-level security policy for table "carriers"'
      using hint = 'User does not have access to this account';
  end if;

  -- Admin and owner roles have all permissions
  if user_role in ('admin', 'owner') then
    return true;
  end if;

  -- For member role, check specific permissions
  if user_role = 'member' then
    case permission_name
      when 'carriers.read' then
        return true;
      when 'carriers.create', 'carriers.update', 'carriers.delete' then
        raise exception 'new row violates row-level security policy for table "carriers"'
          using hint = 'Members can only read carriers';
      else
        return false;
    end case;
  end if;

  raise exception 'new row violates row-level security policy for table "carriers"'
    using hint = 'Invalid role or permission';
end;
$$;

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
  return public.has_permission_internal(p_account_id, p_permission, auth.uid());
end;
$$;

-- Grant execute permissions
grant execute on function public.has_permission_internal(uuid, public.app_permissions, uuid) to authenticated;
grant execute on function public.has_permission(uuid, public.app_permissions) to authenticated;
