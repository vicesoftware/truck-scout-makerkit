# Task: Write Policy Blueprints

This document outlines SQL pseudocode blueprints for Row-Level Security (RLS) policies in the TruckingApp database schema. These policies are designed to enforce secure and consistent access control across key tables.

---

## **1. Key RLS Policy Components**
Each RLS policy will include:
1. **Target Table**: The table to which the policy applies.
2. **Action**: The SQL operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) being controlled.
3. **Role or User**: The database role or user affected by the policy.
4. **Logic**: The conditions under which the action is permitted, typically invoking reusable functions.

---

## **2. Policies for High-Priority Tables**

### **`public.accounts`**

1. **`SELECT` Policy**:
   - Allow users to view accounts they are members of.
   ```sql
   CREATE POLICY select_accounts
   ON public.accounts
   FOR SELECT
   TO authenticated
   USING (
     public.has_role_on_account(id) -- `id` is the account_id in the accounts table
   );
   ```

2. **`INSERT` Policy**:
   - Allow only service roles or authenticated users with specific permissions to create accounts.
   ```sql
   CREATE POLICY insert_accounts
   ON public.accounts
   FOR INSERT
   TO service_role, authenticated
   USING (
     public.has_permission(current_user_id(), id, 'accounts.create')
   );
   ```

3. **`UPDATE` Policy**:
   - Allow updates only for users with the `accounts.update` permission.
   ```sql
   CREATE POLICY update_accounts
   ON public.accounts
   FOR UPDATE
   TO authenticated
   USING (
     public.has_permission(current_user_id(), id, 'accounts.update')
   );
   ```

### **`trucking.invoices`**

1. **`SELECT` Policy**:
   - Allow access to account members and associated factoring companies
   ```sql
   CREATE POLICY select_invoices
   ON trucking.invoices
   FOR SELECT
   TO authenticated
   USING (
     public.has_role_on_account(account_id)
     OR
     public.is_factoring_company_for_invoice(id)
   );
   ```

2. **`INSERT` Policy**:
   - Allow creation by account members with proper permissions
   ```sql
   CREATE POLICY insert_invoices
   ON trucking.invoices
   FOR INSERT
   TO authenticated
   WITH CHECK (
     public.has_role_on_account(account_id)
     AND
     public.has_permission(auth.uid(), account_id, 'invoices.create')
   );
   ```

3. **`UPDATE` Policy**:
   - Restrict updates based on status and permissions
   ```sql
   CREATE POLICY update_invoices
   ON trucking.invoices
   FOR UPDATE
   TO authenticated
   USING (
     public.has_permission(auth.uid(), account_id, 'invoices.update')
   )
   WITH CHECK (
     public.has_permission(auth.uid(), account_id, 'invoices.update')
   );
   ```

4. **`DELETE` Policy**:
   - Allow deletion only by account owners
   ```sql
   CREATE POLICY delete_invoices
   ON trucking.invoices
   FOR DELETE
   TO authenticated
   USING (
     public.has_permission(auth.uid(), account_id, 'invoices.delete')
   );
   ```

### **`trucking.loads`**

1. **`SELECT` Policy**:
   - Restrict access to loads owned by the user's account.
   ```sql
   CREATE POLICY select_loads
   ON trucking.loads
   FOR SELECT
   TO authenticated
   USING (
     account_id IN (
       SELECT account_id
       FROM public.accounts_memberships
       WHERE user_id = current_user_id()
     )
   );
   ```

2. **`INSERT` Policy**:
   - Allow only `Dispatchers` or `Owners` to create new loads.
   ```sql
   CREATE POLICY insert_loads
   ON trucking.loads
   FOR INSERT
   TO authenticated
   USING (
     public.has_role_on_account(account_id) AND
     public.has_permission(current_user_id(), account_id, 'loads.create')
   );
   ```

3. **`UPDATE` Policy**:
   - Restrict updates to users with the `loads.update` permission.
   ```sql
   CREATE POLICY update_loads
   ON trucking.loads
   FOR UPDATE
   TO authenticated
   USING (
     public.has_permission(current_user_id(), account_id, 'loads.update')
   );
   ```

4. **`DELETE` Policy**:
   - Restrict deletion to account owners or users with specific permissions.
   ```sql
   CREATE POLICY delete_loads
   ON trucking.loads
   FOR DELETE
   TO authenticated
   USING (
     public.has_permission(current_user_id(), account_id, 'loads.delete')
   );
   ```

### **`kit.documents`**

1. **`SELECT` Policy**:
   - Allow access only to documents linked to entities within the user's account.
   ```sql
   CREATE POLICY select_documents
   ON kit.documents
   FOR SELECT
   TO authenticated
   USING (
     account_id IN (
       SELECT account_id
       FROM public.accounts_memberships
       WHERE user_id = current_user_id()
     )
   );
   ```

2. **`INSERT` Policy**:
   - Allow authenticated users to upload documents linked to their account.
   ```sql
   CREATE POLICY insert_documents
   ON kit.documents
   FOR INSERT
   TO authenticated
   USING (
     public.has_role_on_account(account_id)
   );
   ```

3. **`DELETE` Policy**:
   - Allow deletion only by the document owner or account owner.
   ```sql
   CREATE POLICY delete_documents
   ON kit.documents
   FOR DELETE
   TO authenticated
   USING (
     public.has_permission(current_user_id(), account_id, 'documents.delete')
   );
   ```

---

## **3. General Considerations**
- **Policy Testing**:
  - Validate policies using real-world scenarios and edge cases.
  - Ensure that unauthorized actions are blocked and authorized actions succeed.

- **Performance**:
  - Test performance impact of policies, especially for large datasets.

- **Policy Interaction**:
  - Ensure policies don't conflict, especially when multiple roles or conditions apply.

---

## **4. Next Steps**
1. Refine and finalize these policy blueprints.
2. Test the policies on sample data.
3. Begin implementation in the database.

---
