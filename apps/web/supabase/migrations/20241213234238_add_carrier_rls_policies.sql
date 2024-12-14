-- Drop existing policies if they exist
DROP POLICY IF EXISTS carriers_read ON carriers;
DROP POLICY IF EXISTS carriers_create ON carriers;
DROP POLICY IF EXISTS carriers_update ON carriers;
DROP POLICY IF EXISTS carriers_delete ON carriers;

-- Enable RLS on carriers table
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

-- Read policy - Allow read access to users in the same account
CREATE POLICY carriers_read ON carriers
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM accounts_memberships am
            WHERE am.account_id = carriers.account_id
            AND am.user_id = auth.uid()
        )
    );

-- Create policy
CREATE POLICY carriers_create ON carriers
    FOR INSERT WITH CHECK (
        has_permission(account_id, 'carriers.create'::public.app_permissions)
    );

-- Update policy
CREATE POLICY carriers_update ON carriers
    FOR UPDATE USING (
        has_permission(account_id, 'carriers.update'::public.app_permissions)
    ) WITH CHECK (
        has_permission(account_id, 'carriers.update'::public.app_permissions)
    );

-- Delete policy
CREATE POLICY carriers_delete ON carriers
    FOR DELETE USING (
        has_permission(account_id, 'carriers.delete'::public.app_permissions)
    );

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carriers TO authenticated;

-- Ensure RLS is enforced for all operations
ALTER TABLE public.carriers FORCE ROW LEVEL SECURITY;
