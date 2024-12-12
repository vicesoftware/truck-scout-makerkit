-- Add billing role permissions
INSERT INTO public.role_permissions (role, permission)
VALUES
    ('billing', 'invoices.create'),
    ('billing', 'invoices.update'),
    ('billing', 'invoices.status');
