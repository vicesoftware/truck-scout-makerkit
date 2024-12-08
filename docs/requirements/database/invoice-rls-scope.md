# Invoice System RLS Scope and Objectives

This document defines the specific tables, columns, and scope for implementing Row-Level Security (RLS) in the invoice system, following the tutorial's pattern.

## **1. Tables Requiring RLS**

### **`trucking.invoices`**
- **Core Fields**:
  ```sql
  id UUID [pk]
  account_id UUID [ref: > accounts.id]    -- Key for RLS policies
  load_id UUID [ref: > loads.id]          -- Related load
  carrier_id UUID [ref: > carriers.id]     -- Related carrier
  amount DECIMAL(10,2)                     -- Sensitive financial data
  due_date TIMESTAMP                       -- Payment timeline
  paid_status BOOLEAN                      -- Payment status
  created_at TIMESTAMP
  updated_at TIMESTAMP
  ```

### **Access Control Requirements**

1. **Account-Based Access**:
   - Base Rule: Users must have a role on the invoice's account
   - Role-Based Permissions:
     * Owner: Full access to all account invoices
     * Admin: Can view and manage account invoices
     * Billing: Can view and update payment status
     * Member: Read-only access to invoices
   - Inheritance Rules:
     * Account owners automatically get all invoice permissions
     * Admin permissions don't cascade to financial operations

2. **Factoring Company Access**:
   - Access Determination:
     * Via `trucking.carriers.factoring_company_id`
     * Only to invoices linked to their associated carriers
   - Allowed Operations:
     * View their linked invoices
     * View payment status
   - Restrictions:
     * Cannot modify invoice details
     * No access to unrelated invoices
     * Cannot see internal account data

3. **Financial Data Protection**:
   - Sensitive Fields:
     * `amount`: Full amount visibility restricted
     * `payment_details`: Contains sensitive payment info
     * `internal_notes`: Account-only visibility
   - Access Levels:
     * Full Access: Owner, Billing roles
     * Partial Access: Admin (masked sensitive data)
     * Limited Access: Members (basic details only)
     * External Access: Factoring companies (their invoices only)

4. **Status Update Controls**:
   - Valid Status Transitions:
     * Draft -> Pending -> Paid
     * Draft -> Void
     * Pending -> Void
   - Permission Requirements:
     * Draft to Pending: Billing or Owner
     * Marking as Paid: Billing or Owner
     * Voiding: Owner only
   - Validation Rules:
     * Cannot modify paid invoices
     * Void requires reason
     * Status changes logged

## **2. Implementation Phases**

### **Phase 1: Core Invoice Security**
1. Set up base RLS policies
2. Configure role-based access
3. Implement permission functions

### **Phase 2: Access Patterns**
1. Account-based access control
2. Factoring company access
3. Status management security

### **Phase 3: Status Management**
1. Status transition logic
2. Validation rules
3. Audit logging

## **3. Success Criteria**

1. **Security**:
   - No data leakage between accounts
   - Proper factoring company isolation
   - Financial data properly protected

2. **Functionality**:
   - All roles can perform allowed actions
   - Status transitions work correctly
   - Audit trail maintained

3. **Performance**:
   - Efficient policy evaluation
   - Quick access patterns
   - Proper index usage

## **4. Next Steps**

1. Implement base invoice table security
2. Configure role-based access
3. Add status management
4. Set up audit logging
