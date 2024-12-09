# Invoice RLS Validation Queries

This document contains SQL queries to validate the RLS implementation for the invoice system. These queries should be run through the application with different user contexts to verify the security policies.

## 1. Permission Function Tests

### Test `has_role_on_invoice`
```sql
-- As owner (should see all account invoices)
SELECT * FROM trucking.invoices 
WHERE account_id = '11111111-1111-1111-1111-111111111111';

-- As admin (should see all account invoices)
SELECT * FROM trucking.invoices 
WHERE account_id = '11111111-1111-1111-1111-111111111111';

-- As member (should see all account invoices)
SELECT * FROM trucking.invoices 
WHERE account_id = '11111111-1111-1111-1111-111111111111';

-- As factoring company (should only see linked invoices)
SELECT * FROM trucking.invoices i
JOIN trucking.carriers c ON i.carrier_id = c.id
WHERE c.factoring_company_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
```

### Test Invoice Status Updates
```sql
-- As owner (should succeed)
UPDATE trucking.invoices 
SET status = 'Pending'
WHERE id = '99999999-9999-9999-9999-999999999999'
AND status = 'Draft';

-- As admin (should succeed)
UPDATE trucking.invoices 
SET status = 'Pending'
WHERE id = '99999999-9999-9999-9999-999999999999'
AND status = 'Draft';

-- As member (should fail)
UPDATE trucking.invoices 
SET status = 'Pending'
WHERE id = '99999999-9999-9999-9999-999999999999'
AND status = 'Draft';

-- Invalid transition (should fail)
UPDATE trucking.invoices 
SET status = 'Draft'
WHERE id = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb'
AND status = 'Paid';
```

### Test Invoice Modifications
```sql
-- As owner (should succeed)
UPDATE trucking.invoices 
SET amount = 1500.00
WHERE id = '99999999-9999-9999-9999-999999999999'
AND status != 'Paid';

-- As admin (should succeed)
UPDATE trucking.invoices 
SET amount = 1500.00
WHERE id = '99999999-9999-9999-9999-999999999999'
AND status != 'Paid';

-- As member (should fail)
UPDATE trucking.invoices 
SET amount = 1500.00
WHERE id = '99999999-9999-9999-9999-999999999999';

-- Modify paid invoice (should fail)
UPDATE trucking.invoices 
SET amount = 3500.00
WHERE id = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb'
AND status = 'Paid';
```

### Test Invoice Deletion
```sql
-- As owner (should succeed)
DELETE FROM trucking.invoices 
WHERE id = '99999999-9999-9999-9999-999999999999';

-- As admin (should fail)
DELETE FROM trucking.invoices 
WHERE id = '99999999-9999-9999-9999-999999999999';

-- As member (should fail)
DELETE FROM trucking.invoices 
WHERE id = '99999999-9999-9999-9999-999999999999';
```

## 2. Cross-Account Access Tests

```sql
-- As member of Account 1 trying to access Account 2 (should return 0 rows)
SELECT * FROM trucking.invoices 
WHERE account_id = '22222222-2222-2222-2222-222222222222';

-- As factoring company trying to access unrelated invoices (should return 0 rows)
SELECT * FROM trucking.invoices i
JOIN trucking.carriers c ON i.carrier_id = c.id
WHERE c.factoring_company_id != 'dddddddd-dddd-dddd-dddd-dddddddddddd';
```

## 3. Audit Log Verification

```sql
-- Check audit logs for invoice changes
SELECT * FROM trucking.audit_logs 
WHERE table_name = 'invoices'
ORDER BY created_at DESC;

-- Verify status changes are logged
SELECT 
    al.record_id,
    al.action,
    (al.old_data->>'status') as old_status,
    (al.new_data->>'status') as new_status,
    al.created_at
FROM trucking.audit_logs al
WHERE table_name = 'invoices'
AND (al.old_data->>'status') != (al.new_data->>'status')
ORDER BY created_at DESC;
```

## Test Execution Steps

1. Connect to the database as each test user:
   - owner@test.com (password123)
   - admin@test.com (password123)
   - member@test.com (password123)
   - factoring@test.com (password123)

2. Run the relevant queries for each user context

3. Verify the results match the expected outcomes:
   - Owners can perform all operations
   - Admins can view and update but not delete
   - Members can only view
   - Factoring companies can only view their linked invoices

4. Check audit logs to ensure all changes are properly tracked

## Expected Results

1. Permission Tests:
   - [x] Owner has full access
   - [x] Admin has create/update access
   - [x] Member has read-only access
   - [x] Factoring company has filtered read-only access

2. Status Updates:
   - [x] Valid transitions succeed
   - [x] Invalid transitions fail
   - [x] Unauthorized users cannot update status

3. Data Protection:
   - [x] No cross-account access
   - [x] Paid invoices cannot be modified
   - [x] All changes are logged

4. Audit Trail:
   - [x] All changes have user tracking
   - [x] Status changes are logged
   - [x] Amount changes are logged
