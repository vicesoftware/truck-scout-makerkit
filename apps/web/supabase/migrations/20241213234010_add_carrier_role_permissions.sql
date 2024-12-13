-- Add carrier permissions to role_permissions table
INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'carriers.read'),
  ('owner', 'carriers.create'),
  ('owner', 'carriers.update'),
  ('owner', 'carriers.delete'),
  ('admin', 'carriers.read'),
  ('admin', 'carriers.create'),
  ('admin', 'carriers.update'),
  ('admin', 'carriers.delete'),
  ('member', 'carriers.read');
