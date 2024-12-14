-- Add carrier permissions to app_permissions type
DO $$ BEGIN
    ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.create';
    ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.read';
    ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.update';
    ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.delete';
END $$;
