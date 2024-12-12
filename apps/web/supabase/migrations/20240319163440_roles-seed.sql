-- Seed the roles table with default roles 'owner', 'member', and 'billing'
insert into public.roles(
    name,
    hierarchy_level)
values (
    'owner',
    1);

insert into public.roles(
    name,
    hierarchy_level)
values (
    'member',
    2);

insert into public.roles(
    name,
    hierarchy_level)
values (
    'billing',
    3);

-- We seed the role_permissions table with the default roles and permissions
insert into public.role_permissions(
  role,
  permission)
values (
  'owner',
  'roles.manage'),
(
  'owner',
  'billing.manage'),
(
  'owner',
  'settings.manage'),
(
  'owner',
  'members.manage'),
(
  'owner',
  'invites.manage'),
(
  'member',
  'settings.manage'),
(
  'member',
  'invites.manage');
