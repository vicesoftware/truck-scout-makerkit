# Task: Plan RLS Functions <!-- omit in toc -->

This document outlines the plan for reusable Row-Level Security (RLS) functions in the TruckingApp database schema. These functions are designed to enforce consistent and secure access control based on the application's domain requirements and current DBML schema.

---
- [**1. Goals of RLS Functions**](#1-goals-of-rls-functions)
- [**2. Proposed Functions**](#2-proposed-functions)
  - [**1. `has_role_on_account(account_id UUID)`**](#1-has_role_on_accountaccount_id-uuid)
  - [**3. has\_permission(user\_id UUID, account\_id UUID, permission TEXT)**](#3-has_permissionuser_id-uuid-account_id-uuid-permission-text)
  - [**3. Key Considerations**](#3-key-considerations)
  - [**4. Next Steps**](#4-next-steps)


## **1. Goals of RLS Functions**
- Enforce multi-tenancy by restricting access based on `account_id`.
- Implement role-based access control (RBAC) using `role_permissions`.
- Support entity-specific access logic with generic functions.
- Ensure efficient and reusable access control logic.

---

## **2. Proposed Functions**

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
        AND user_id = current_user_id() -- Replace with session-based user ID retrieval
    );
  END;
  $$ LANGUAGE plpgsql STABLE;

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
  - `permission`: The required permission (e.g., `tickets.update`).
- **Logic**:
```sql
Copy code
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
- **Use Cases**:
  - Role-based operation control for tables like `trucking.loads` and `trucking.drivers`.

### **3. Key Considerations**
1. **Schema Alignment**:
  - Leverage the `public.accounts`, `public.accounts_memberships`, and `public.role_permissions` tables for role and account-based validation.
  - Account for entity-specific relationships, such as `trucking.loads.account_id`.

2. **Function Optimization**:
  - Use indexed fields like `account_id`, `user_id`, and `associated_entity_id` for efficient queries.
  - Ensure `STABLE` functions to cache results where possible.

3. **Testing**:
  - Validate functions against sample data for edge cases (e.g., cross-account data, entity ownership).

### **4. Next Steps**
1. Finalize and implement these functions in the database.
2. Test the functions with real-world scenarios.
3. Incorporate these functions into RLS policies for specific tables.

---




