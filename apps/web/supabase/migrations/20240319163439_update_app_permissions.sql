-- Save existing role permissions
CREATE TABLE IF NOT EXISTS temp_role_permissions AS
SELECT * FROM public.role_permissions;

-- Drop existing tables and types that depend on app_permissions
DROP TABLE IF EXISTS public.role_permissions;

-- Drop the existing enum type
DROP TYPE IF EXISTS public.app_permissions;

-- Recreate the enum type with all permissions
CREATE TYPE public.app_permissions AS ENUM (
  'roles.manage',
  'billing.manage',
  'settings.manage',
  'members.manage',
  'invites.manage',
  'invoices.create',
  'invoices.update',
  'invoices.delete',
  'invoices.status'
);

-- Recreate the role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(255) NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission public.app_permissions NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, permission)
);

-- Restore existing permissions that are still valid
INSERT INTO public.role_permissions (role, permission)
SELECT role, permission::public.app_permissions
FROM temp_role_permissions
WHERE permission::TEXT IN (
  'roles.manage',
  'billing.manage',
  'settings.manage',
  'members.manage',
  'invites.manage'
);

-- Drop the temporary table
DROP TABLE temp_role_permissions;
