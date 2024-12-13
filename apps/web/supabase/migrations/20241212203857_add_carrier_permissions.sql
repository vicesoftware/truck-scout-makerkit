-- Add new enum values
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.manage';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'factoring_companies.manage';
