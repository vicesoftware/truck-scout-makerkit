-- Add invoice-specific permissions to app_permissions type
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.create';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.update';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.delete';
ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'invoices.status';
