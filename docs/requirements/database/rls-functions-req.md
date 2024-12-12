# Task: Plan RLS Functions

This document outlines the plan for reusable Row-Level Security (RLS) functions in the TruckingApp database schema. These functions are designed to enforce consistent and secure access control based on the application's domain requirements and current DBML schema.

---
## **1. Goals of RLS Functions**
- Enforce multi-tenancy by restricting access based on `account_id`.
- Implement role-based access control (RBAC) using `role_permissions`.
- Support entity-specific access logic with generic functions.
- Ensure efficient and reusable access control logic.

---

## **2. Core Functions**

### **1. `has_role_on_account(account_id UUID)`**
- **Purpose**: Check if the current user has a role on a given `account_id`.
- **Inputs**:
  - `account_id`: The account being queried.
- **Logic**:
  ```sql
  CREATE OR REPLACE FUNCTION public.has_role_on_account(account_id UUID)
  RETURNS BOOLEAN AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1
      FROM public.accounts_memberships
      WHERE account_id = account_id
        AND user_id = auth.uid()
    );
  END;
  $$ LANGUAGE plpgsql STABLE;
  ```
- **Use Cases**: Validate membership for tables like `trucking.loads`, `trucking.carriers`, and `public.accounts`.

### **2. can_access_entity(user_id UUID, entity_id UUID, entity_type TEXT)**
- **Purpose**: Determine if a user can access a specific entity.
- **Inputs**:
  - `user_id`: The user making the request.
  - `entity_id`: The ID of the entity being accessed.
  - `entity_type`: The type of entity (e.g., load, document).
- **Logic**:
```sql
CREATE OR REPLACE FUNCTION public.can_access_entity(user_id UUID, entity_id UUID, entity_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  CASE entity_type
    WHEN 'load' THEN
      RETURN EXISTS (
        SELECT 1
        FROM trucking.loads
        WHERE id = entity_id
          AND account_id IN (
            SELECT account_id
            FROM public.accounts_memberships
            WHERE user_id = user_id
          )
      );
    WHEN 'document' THEN
      RETURN EXISTS (
        SELECT 1
        FROM kit.documents
        WHERE id = entity_id
          AND account_id IN (
            SELECT account_id
            FROM public.accounts_memberships
            WHERE user_id = user_id
          )
      );
    -- Add cases for other entity types as needed
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;
```
- **Use Cases**: Cross-entity access control for tables like `trucking.loads` and `kit.documents`.

### **3. has_permission(user_id UUID, account_id UUID, permission TEXT)**
- **Purpose**: Verify if a user has a specific permission for an account.
- **Inputs**:
  - `user_id`: The user making the request.
  - `account_id`: The account being queried.
  - `permission`: The required permission (e.g., `invoices.update`).
- **Logic**:
```sql
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, account_id UUID, permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.accounts_memberships am
      ON rp.role = am.account_role
    WHERE am.user_id = user_id
      AND am.account_id = account_id
      AND rp.permission = permission
  );
END;
$$ LANGUAGE plpgsql STABLE;
```
- **Use Cases**: Role-based operation control for tables like `trucking.loads` and `trucking.drivers`.

## **3. Invoice-Specific Functions**

Following the tutorial's pattern of nested permission checks, we need these additional functions for the invoice system:

### **1. has_role_on_invoice(invoice_id UUID)**
- **Purpose**: Check if user has role on invoice's account (similar to tutorial's has_role_on_ticket_account)
- **Logic**:
```sql
CREATE OR REPLACE FUNCTION public.has_role_on_invoice(invoice_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM trucking.invoices invoice
    WHERE invoice.id = invoice_id
      AND public.has_role_on_account(invoice.account_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### **2. is_factoring_company_for_invoice(invoice_id UUID)**
- **Purpose**: Check if current user is the factoring company for this invoice
- **Logic**:
```sql
CREATE OR REPLACE FUNCTION public.is_factoring_company_for_invoice(invoice_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM trucking.invoices i
    JOIN trucking.carriers c ON i.carrier_id = c.id
    WHERE i.id = invoice_id
      AND c.factoring_company_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### **3. mask_sensitive_invoice_data(field_value TEXT, user_id UUID, invoice_id UUID)**
- **Purpose**: Mask sensitive invoice data based on user role and permissions
- **Inputs**:
  - `field_value`: The original value to potentially mask
  - `user_id`: The user requesting access
  - `invoice_id`: The invoice being accessed
- **Logic**:
```sql
CREATE OR REPLACE FUNCTION public.mask_sensitive_invoice_data(
    field_value TEXT,
    user_id UUID,
    invoice_id UUID
)
RETURNS TEXT AS $$
DECLARE
    has_full_access BOOLEAN;
BEGIN
    -- Check if user has full access (owner or billing role)
    SELECT EXISTS (
        SELECT 1
        FROM public.invoices i
        JOIN public.accounts_memberships am ON i.account_id = am.account_id
        WHERE i.id = invoice_id
        AND am.user_id = user_id
        AND am.account_role IN ('owner', 'billing')
    ) INTO has_full_access;

    RETURN CASE
        WHEN has_full_access THEN field_value
        ELSE '****'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
- **Use Cases**:
  - Masking bank details for non-privileged roles
  - Protecting payment information
  - Securing sensitive financial data
- **Security Notes**:
  - Uses SECURITY DEFINER for consistent access control
  - Implements role-based masking logic
  - Prevents unauthorized access to sensitive data

### **4. can_update_invoice_status(invoice_id UUID, new_status TEXT)**
- **Purpose**: Validate invoice status transitions based on user role and current status
- **Inputs**:
  - `invoice_id`: The invoice being updated
  - `new_status`: The proposed new status
- **Logic**:
```sql
CREATE OR REPLACE FUNCTION public.can_update_invoice_status(
    invoice_id UUID,
    new_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
    user_role TEXT;
BEGIN
    -- Get current status and user role
    SELECT
        i.status,
        am.account_role
    INTO
        current_status,
        user_role
    FROM public.invoices i
    JOIN public.accounts_memberships am
        ON i.account_id = am.account_id
    WHERE i.id = invoice_id
        AND am.user_id = auth.uid();

    -- Role-based transition rules
    CASE user_role
        WHEN 'owner' THEN
            -- Owner can make any transition except from Paid
            RETURN current_status != 'Paid';
        WHEN 'billing' THEN
            -- Billing can transition Draft->Pending->Paid
            RETURN (
                (current_status = 'Draft' AND new_status = 'Pending') OR
                (current_status = 'Pending' AND new_status = 'Paid')
            );
        WHEN 'admin' THEN
            -- Admin can only transition Draft->Pending
            RETURN current_status = 'Draft' AND new_status = 'Pending';
        ELSE
            -- Other roles cannot change status
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE;
```
- **Use Cases**:
  - Enforcing status transition workflow
  - Implementing role-based status changes
  - Preventing invalid status transitions
- **Security Notes**:
  - Validates user role and permissions
  - Enforces business rules for status changes
  - Prevents unauthorized status modifications

## **4. Key Considerations**

1. **Schema Alignment**:
  - Leverage the `public.accounts`, `public.accounts_memberships`, and `public.role_permissions` tables for role and account-based validation.
  - Account for entity-specific relationships, such as `trucking.loads.account_id`.

2. **Function Optimization**:
  - Use indexed fields like `account_id`, `user_id`, and `associated_entity_id` for efficient queries.
  - Ensure `STABLE` functions to cache results where possible.

3. **Testing**:
  - Validate functions against sample data for edge cases (e.g., cross-account data, entity ownership).

## **5. Next Steps**

1. Implement core functions in the database.
2. Add invoice-specific functions.
3. Test the functions with real-world scenarios.
4. Incorporate these functions into RLS policies for specific tables.

---
