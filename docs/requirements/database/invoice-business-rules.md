# Invoice System Business Rules

This document outlines the business rules for the invoice system based on our domain requirements.

## **1. Core Invoice Rules**

### **Access Control**
1. **Account-Based Access**:
   - Every invoice belongs to an account via `account_id`
   - Account members can view their account's invoices
   - Account owners have full access to all invoices

2. **Factoring Company Access**:
   - Can only view invoices for their associated carriers
   - Access determined through `trucking.carriers.factoring_company_id`
   - Cannot modify invoice data

3. **Role-Based Permissions**:
   - System admins have global access to view invoice totals and other system-wide details.
   - Company admins can view invoice totals if their responsibilities include financial oversight.
   ```sql
   -- Required permissions in app_permissions enum
   'invoices.create'    -- Create new invoices
   'invoices.update'    -- Update invoice details
   'invoices.delete'    -- Delete invoices
   'invoices.status'    -- Update invoice status
   ```

### **Status Management**
1. **Valid Status Transitions**:
   ```
   Draft -> Pending -> Paid
     |         |
     v         v
    Void     Void
   ```

2. **Status Rules**:
   - Status transitions follow strict role permissions:
     * Owner: Can make any transition except from Paid
     * Billing: Can transition Draft->Pending->Paid
     * Admin: Can transition Draft->Pending only
     * Member: Cannot change status
   - Paid invoices cannot be modified or changed to any other status
   - Void status requires a documented reason
   - Status changes must be logged with:
     * User ID who made the change
     * Previous status
     * New status
     * Timestamp
     * Change reason (required for Void)
   - Status validation enforced through database functions:
     ```sql
     -- Function to validate status transitions
     can_update_invoice_status(invoice_id UUID, new_status TEXT)
     ```
   - Audit trail maintained in invoice_audit_log table
   - Status changes trigger automatic audit logging
   - Invalid transitions are blocked with appropriate error messages

## **2. Data Protection**

### **Sensitive Fields**
1. **Financial Data**:
   - `amount`: Masked for roles without full access
   - `payment_details`: Contains sensitive info, masked for roles without access
   - `internal_notes`: Account-only visibility

2. **Access Levels**:
   - Full Access: Owner, Billing roles
   - Partial Access: Admin (masked sensitive data)
   - Limited Access: Members (basic details only)
   - External Access: Factoring companies (their invoices only)

### **Audit Requirements**
1. **Track Changes**:
   - Status updates
   - Amount modifications
   - Assignment changes

2. **Log Requirements**:
   - Who made the change
   - When it was made
   - Previous value
   - New value
   - Reason (if required)

3. **Access Logging**:
   - Log all access to sensitive fields (e.g., invoice totals, payment details).
   - Include user ID, timestamp, and data accessed.

## **3. Implementation Requirements**

### **Database Functions**
1. **Core Functions**:
   ```sql
   has_role_on_invoice(invoice_id UUID)
   is_factoring_company_for_invoice(invoice_id UUID)
   ```

2. **Validation Functions**:
   ```sql
   can_update_invoice_status(invoice_id UUID, new_status TEXT)
   can_modify_invoice(invoice_id UUID)
   ```

### **Required Indexes**
```sql
CREATE INDEX ix_invoices_account_id ON trucking.invoices(account_id);
CREATE INDEX ix_invoices_carrier_id ON trucking.invoices(carrier_id);
CREATE INDEX ix_invoices_load_id ON trucking.invoices(load_id);
```

## **4. Testing Requirements**

### **Access Control Tests**
1. **Account Access**:
   - Members can only see their invoices
   - Owners can see all account invoices
   - No cross-account access

2. **Factoring Company Access**:
   - Can only see associated invoices
   - Cannot modify invoice data

### **Status Tests**
1. **Transitions**:
   - Valid status changes succeed
   - Invalid changes are blocked
   - Proper audit trail created

2. **Access Logging Tests**:
   - Ensure all sensitive data access is logged with correct user ID, timestamp, and accessed fields.

## **5. Success Criteria**

1. **Security**:
   - No data leakage between accounts
   - Proper factoring company isolation
   - Financial data properly protected
   - Sensitive fields are masked as per access levels

2. **Functionality**:
   - All roles can perform allowed actions
   - Status transitions work correctly
   - Audit trail maintained

3. **Performance**:
   - Efficient policy evaluation
   - Quick access patterns
   - Proper index usage

## **Future Work**

### Medium Priority Enhancements
1. Expand testing coverage for access control, especially for roles with limited access, like factoring companies.
2. Enhance security for factoring company views with rate limiting and detailed access logs.
3. Improve status change audits by requiring reasons for all transitions and capturing user roles in logs.

### Low Priority Suggestions
1. Plan for scalability, such as multi-currency support and invoice dispute handling.
2. Refactor database functions (`has_role_on_invoice`, `can_update_invoice_status`) for modularity and reusability.
3. Implement admin-only reporting views for streamlined oversight without exposing sensitive details.

---

## **Notes**

This document includes high-priority changes in the relevant sections for immediate implementation, while medium- and low-priority suggestions are deferred to the future work section for later enhancements.

