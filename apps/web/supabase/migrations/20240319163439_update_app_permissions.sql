-- Add new invoice permissions to app_permissions enum
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.create';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.update';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.delete';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.status';

-- Add timestamps to role_permissions if they don't exist
DO $$ BEGIN
    ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add id column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add unique constraint if it doesn't exist (using a safer approach)
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'role_permissions_role_permission_key'
    ) THEN
        ALTER TABLE public.role_permissions
        ADD CONSTRAINT role_permissions_role_permission_key
        UNIQUE (role, permission);
    END IF;
END $$;
