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

## **2. User Authentication and Basic Access Testing**

### **Objective**
Create a focused test that verifies:
1. User can be created successfully
2. User can authenticate
3. Test runs in the authenticated user's context

### **Test Scenario Requirements**
- Use predefined test users from seed.sql
- Implement a minimal, focused authentication test
- Validate basic user creation and login functionality

### **Detailed Test Steps**
1. Select a predefined test user from seed.sql
2. Attempt user authentication
3. Verify successful login
4. Perform a simple action in the authenticated context
5. Validate user's ability to interact with the system

### **Implementation Constraints**
- Leverage existing seed.sql data
- Minimal custom user creation logic
- Use Supabase authentication mechanisms
- Ensure test isolation and repeatability

### **Success Criteria**
- Test user can successfully authenticate
- Authentication context is maintained throughout the test
- No unexpected errors during authentication process
- Basic system interaction possible after authentication

### **Potential Challenges**
- Handling different authentication scenarios
- Ensuring consistent test environment
- Managing authentication state

### **Tools and Approach**
- Playwright for test execution
- Supabase authentication
- Minimal, focused test design

### **Next Immediate Actions**
1. Create test file for user authentication
2. Implement basic authentication test
3. Verify test passes consistently
4. Document test implementation approach

### **Technical Implementation Details**

#### **Test User Authentication Approach**

##### **1. Test Environment Setup**
- Use Playwright for test execution
- Leverage Supabase client for authentication
- Utilize predefined test users from seed.sql

##### **2. Authentication Mechanism**
```typescript
// Proposed authentication test structure
test('User Authentication and Context Validation', async () => {
  // 1. Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // 2. Select test user (from seed.sql)
  const testUser = {
    email: 'test@makerkit.dev',
    password: 'password123'
  };

  // 3. Attempt authentication
  const { data, error } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: testUser.password
  });

  // 4. Validation Checks
  expect(error).toBeNull(); // No authentication error
  expect(data.user).toBeTruthy(); // User object exists
  expect(data.user?.email).toBe(testUser.email); // Correct user authenticated

  // 5. Minimal Context Interaction
  const { data: profileData, error: profileError } = await supabase
    .from('accounts_memberships')
    .select('account_role')
    .eq('user_id', data.user?.id)
    .single();

  expect(profileError).toBeNull(); // No error fetching profile
  expect(profileData?.account_role).toBeDefined(); // Role is assigned
});
```

##### **3. Key Validation Points**
- Successful authentication
- User email verification
- User role retrieval
- Minimal system interaction

##### **4. Error Handling Scenarios**
- Invalid credentials
- Disabled accounts
- Expired passwords
- Multi-factor authentication (if applicable)

##### **5. Environment Considerations**
- Local development (localhost)
- CI/CD testing environment
- Different authentication providers

##### **6. Performance and Reliability**
- Minimal test execution time
- Consistent test results
- Isolation between test runs

#### **Proposed Test File Structure**
```
apps/e2e/
└── tests/
    └── authentication/
        └── user-authentication.spec.ts
```

#### **Dependencies**
- @playwright/test
- @supabase/supabase-js
- dotenv (for environment configuration)

#### **Configuration Requirements**
- Supabase URL and Anon Key
- Predefined test users in seed.sql
- Playwright configuration

#### **Potential Extensions**
- Parameterized tests for multiple user roles
- More complex authentication scenarios
- Integration with broader RLS testing strategy
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



