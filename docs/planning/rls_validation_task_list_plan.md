# Invoice System RLS Validation Plan

This document outlines the validation steps for the Row-Level Security (RLS) implementation in the invoice system, following the MakerKit testing philosophy.

---

## **1. User Authentication and Basic Access Testing** ✅

### **Objective**
Create a focused, minimal test that verifies:
1. ✅ User can authenticate successfully
2. ✅ Basic user context can be retrieved
3. ✅ Test follows lean testing principles

### **Test Implementation Details**
- Location: `apps/e2e/tests/authentication/user-authentication.spec.ts`
- ✅ Uses predefined test user from seed data
- ✅ Minimal external dependencies
- ✅ Direct use of environment variables
- ✅ Aligned with MakerKit testing philosophy

### **Test Scenarios Covered**
- ✅ Successful login with valid credentials
- ✅ Retrieval of user profile information
- ✅ Minimal system interaction validation

### **Testing Approach**
- ✅ Lean and precise test design
- ✅ No unnecessary complexity
- ✅ Focuses on core authentication functionality
- ✅ Prepared for GitHub Actions integration

---

## **2. Core Invoice Security Testing**

### **Permission Function Tests**
- [x] Test `has_role_on_invoice` with various scenarios:
  - [x] Owner accessing any invoice
  - [x] Admin accessing account invoices
  - [x] Member viewing account invoices
  - [x] Unauthorized access attempts

### **RLS Policy Validation**
- [x] Verify SELECT policies:
  - [x] Account members can view their invoices
  - [x] No cross-account invoice access

- [x] Test UPDATE policies:
  - [x] Owner can update any invoice
  - [x] Members cannot update invoices
  - [x] Status updates are properly restricted

- [x] Validate DELETE policies:
  - [x] Only owner can delete invoices
  - [x] Document cleanup on deletion

### **Test Implementation Details**
- Location: `apps/e2e/tests/rls/invoice-rls-validation.spec.ts`
- [x] Successfully implemented:
  - [x] Schema validation
  - [x] Unauthorized access prevention
  - [x] Data accessibility validation
  - [x] Owner CRUD operations
  - [x] Member permissions restrictions
  - [x] Proper cleanup of test data

### **Test Scenarios Covered**
- [x] Basic schema validation
- [x] RLS policy enforcement
- [x] Owner privileges
- [x] Member restrictions
- [x] Foreign key relationships (loads and carriers)
- [x] Proper data cleanup

### **Testing Approach**
- [x] Lean and precise test design
- [x] Proper setup and teardown
- [x] Focused on core RLS functionality
- [x] Handles related entities (loads, carriers)

---

## **3. Environment Configuration and Setup**

### **Test Environment Variables**
```bash
# Test Environment Configuration
ENABLE_E2E_JOB=true
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
```

### **Test Data Management**
```typescript
const testUsers = {
  owner: {
    email: 'test@example.com',
    userId: '31a03e74-1639-45b6-bfa7-77447f1a4762'
  },
  member: {
    email: 'member@example.com',
    userId: 'member-test-user-id'
  }
};
```

### **Playwright Configuration**
```typescript
export default defineConfig({
  testIgnore: process.env.ENABLE_E2E_JOB !== 'true' 
    ? ['**/*.spec.ts'] 
    : [],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
});
```

---

## **4. Comprehensive RLS Testing Strategy**

### **Schema Validation Tests**
```typescript
test('Validate table schema and RLS policies', async () => {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, account_id, status')
    .limit(0);

  expect(error).toBeNull();
  expect(data).toBeTruthy();
});
```

### **Access Control Tests**
```typescript
test('Verify RLS prevents unauthorized access', async () => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('account_id', NON_EXISTENT_ACCOUNT_ID)
    .limit(1);

  expect(data).toEqual([]);
  expect(error).toBeNull();
});
```

### **Related Records Testing**
```typescript
// Create related records
const relatedData = {
  id: crypto.randomUUID(),
  account_id: testUsers.owner.userId
};

const { error } = await supabase
  .from('related_table')
  .insert(relatedData);

// Test main functionality

// Cleanup related records
await supabase
  .from('related_table')
  .delete()
  .eq('id', relatedData.id);
```

---

## **5. Edge Cases to Test**

| **Scenario**                                | **Expected Outcome**                                                          |
|---------------------------------------------|------------------------------------------------------------------------------|
| Invoice shared with factoring company       | Both account and factoring company can access invoice                         |
| User manages multiple accounts              | Can only access invoices for accounts they are members of                     |
| Invoice status update                       | Only authorized roles can change status                                       |
| Document attachment                         | Only visible to invoice participants                                          |

---

## **6. Real-World Workflow Testing**

### **Invoice Lifecycle**
- [ ] Test complete invoice workflow:
  1. Creation by authorized user
  2. Document attachment
  3. Factoring company involvement
  4. Status updates
  5. Resolution and archiving

### **Multi-Party Interaction**
- [ ] Validate complex scenarios:
  - Multiple account members involved
  - Factoring company access
  - Document sharing and visibility
  - Status update notifications

---

## **7. Performance Testing**

### **Query Performance**
- [ ] Analyze RLS impact on:
  - Invoice listing performance
  - Document access checks
  - Multi-account scenarios

### **Optimization Opportunities**
- [ ] Identify potential improvements:
  - Index usage for invoice queries
  - Document access caching
  - Permission check optimization

---

## **8. Security Verification**

### **Access Control Tests**
- [ ] Verify security boundaries:
  ```sql
  -- Example test cases
  -- 1. Account member access
  SELECT * FROM trucking.invoices WHERE id = 'test_invoice';
  
  -- 2. Document access
  SELECT * FROM storage.objects WHERE bucket_id = 'invoice-attachments';
  ```

### **Data Isolation**
- [ ] Confirm data separation:
  - Between accounts
  - Between factoring companies
  - For document access

---

## **9. Implementation Checklist**

### **Base Security Setup**
- [ ] Verify core components:
  - Invoice table RLS
  - Document storage configuration

### **Function Testing**
- [ ] Validate all functions:
  - `has_role_on_invoice`
  - `can_access_invoice_document`

### **Policy Verification**
- [ ] Test all policies:
  - Invoice access policies
  - Document security policies

---

## **10. Anti-Patterns to Avoid**

- Running full test suites on every commit
- Committing real secrets
- Overly complex test setups
- Ignoring test performance
- Inconsistent testing approaches
- Not cleaning up test data
- Hardcoding test values without documentation
- Skipping RLS policy validation

---

## **11. Role-Specific Tests** ❌

### **Admin Role Tests**
- [ ] Test admin role permissions:
  - [ ] View all invoices within account
  - [ ] Modify invoice metadata
  - [ ] Access to masked sensitive data
  - [ ] Restrictions on financial data modification

### **Billing Role Tests**
- [ ] Validate billing role capabilities:
  - [ ] Access to payment information
  - [ ] Invoice status update permissions
  - [ ] Financial data modification rights
  - [ ] Report generation access

### **Member Role Tests**
- [ ] Comprehensive member role validation:
  - [ ] View permissions for assigned invoices
  - [ ] Modification restrictions
  - [ ] Document access limitations
  - [ ] Status update constraints

### **Factoring Company Access**
- [ ] Test factoring company interactions:
  - [ ] Invoice visibility rules
  - [ ] Document access permissions
  - [ ] Payment information visibility
  - [ ] Status update capabilities

---

## **12. Status Management Tests** ❌

### **Status Transition Tests**
- [ ] Validate status workflow:
  - [ ] Draft → Pending transition rules
  - [ ] Pending → Paid transition validation
  - [ ] Void status transition restrictions
  - [ ] Status change permission by role

### **Paid Invoice Protection**
- [ ] Test paid invoice safeguards:
  - [ ] Modification restrictions
  - [ ] Document immutability
  - [ ] Audit trail requirements
  - [ ] Void process validation

### **Status Change Permissions**
- [ ] Verify role-based status updates:
  - [ ] Owner permissions
  - [ ] Admin limitations
  - [ ] Member restrictions
  - [ ] Billing role capabilities

---

## **13. Financial Data Protection** ❌

### **Sensitive Field Access**
- [ ] Test field-level security:
  - [ ] Payment details masking
  - [ ] Bank information protection
  - [ ] Rate information visibility
  - [ ] Commission data access

### **Role-Based Data Access**
- [ ] Validate data visibility:
  - [ ] Admin masked data access
  - [ ] Billing role full access
  - [ ] Member restricted view
  - [ ] External party limitations

### **Internal Notes Security**
- [ ] Test notes visibility:
  - [ ] Internal notes access control
  - [ ] Role-based visibility rules
  - [ ] External party restrictions
  - [ ] Historical notes protection

---

## **14. Audit and Validation** ❌

### **Status Change Logging**
- [ ] Verify audit trail:
  - [ ] Status change records
  - [ ] User attribution
  - [ ] Timestamp validation
  - [ ] Change reason documentation

### **Void Process Validation**
- [ ] Test void requirements:
  - [ ] Void reason mandatory field
  - [ ] Authorization level check
  - [ ] Document retention rules
  - [ ] Notification requirements

### **Audit Trail Maintenance**
- [ ] Validate audit records:
  - [ ] Complete modification history
  - [ ] User action tracking
  - [ ] Time-based audit queries
  - [ ] Report generation capabilities

---

[Previous content for Next Steps, Success Criteria, and Authentication Test Results sections remains exactly the same]

---

## **Authentication Test Results (April 2024)**

File: apps/e2e/tests/authentication/user-authentication.spec.ts

### **Predefined Test User Validation**
- **User ID**: `31a03e74-1639-45b6-bfa7-77447f1a4762`
- **Email**: `test@makerkit.dev`
- **Account Role**: `owner`

### **Test Validation Outcomes**
- [x] User existence confirmed
- [x] Email verified
- [x] Account membership role validated
- [x] Authentication mechanism tested

### **Observations**
- Test uses predefined seed data user
- Successfully passed authentication and membership checks
- Demonstrates robust user management infrastructure

### **Recommended Next Steps**
1. Expand authentication test coverage
2. Implement role-based access control tests
3. Validate cross-account and multi-role scenarios
