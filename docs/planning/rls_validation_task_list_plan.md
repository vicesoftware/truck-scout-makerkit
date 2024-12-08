# Invoice System RLS Validation Plan

This document outlines the validation steps for the Row-Level Security (RLS) implementation in the invoice system, following the tutorial's pattern but applied to our domain.

---

## **1. Core Invoice Security Testing**

### **Permission Function Tests**
- [ ] Test `has_role_on_invoice` with various scenarios:
  - Owner accessing any invoice
  - Admin accessing account invoices
  - Member viewing account invoices
  - Factoring company accessing linked invoices
  - Unauthorized access attempts

### **RLS Policy Validation**
- [ ] Verify SELECT policies:
  - Account members can view their invoices
  - Factoring companies see only linked invoices
  - No cross-account invoice access

- [ ] Test UPDATE policies:
  - Owner can update any invoice
  - Admin can update account invoices
  - Members cannot update invoices
  - Status updates are properly restricted

- [ ] Validate DELETE policies:
  - Only owner can delete invoices
  - Document cleanup on deletion

---

## **3. Edge Cases to Test**

| **Scenario**                                | **Expected Outcome**                                                          |
|---------------------------------------------|------------------------------------------------------------------------------|
| Invoice shared with factoring company       | Both account and factoring company can access invoice                         |
| User manages multiple accounts              | Can only access invoices for accounts they are members of                     |
| Invoice status update                       | Only authorized roles can change status                                       |
| Document attachment                         | Only visible to invoice participants                                          |

---

## **4. Real-World Workflow Testing**

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

## **5. Performance Testing**

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

## **6. Security Verification**

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

## **7. Implementation Checklist**

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

## **Next Steps**

1. Execute test cases with sample data
2. Document any security gaps found
3. Optimize based on performance testing
4. Use findings to refine implementation

---

## **Success Criteria**

- All test cases pass
- No unauthorized access possible
- Performance meets requirements
- Document security verified
