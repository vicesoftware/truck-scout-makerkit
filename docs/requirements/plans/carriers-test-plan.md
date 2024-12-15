# Carriers Test Plan

## Overview
This document outlines the test plan for the carriers functionality, following our database testing best practices. We'll implement these tests one at a time, ensuring each test passes before moving to the next.

## Test Categories

### 1. Role-Based Access Testing

#### Test 1: Anon Access ✅
- **Description**: Verify anon role cannot access carriers table
- **Method**: 
  1. Revoke all privileges from anon role
  2. Check SELECT privilege
- **Expected**: No SELECT privilege for anon role
- **Status**: PASSED
- **Implementation Notes**:
  - Needed to explicitly revoke privileges
  - Used row_eq() for proper test assertion
  - Test runs within transaction for cleanup

#### Test 2: Basic Member Access
- **Description**: Verify authenticated member can view carriers in their account
- **Method**:
  1. Create member user with tests.create_supabase_user()
  2. Set identifier with makerkit.set_identifier()
  3. Create test account
  4. Add member to account using proper function
  5. Query carriers
- **Expected**: Member can see carriers in their account
- **Setup Dependencies**: 
  - Requires Test 3 (Owner Permissions) to be implemented first to create test carriers

### 2. Permission Testing

#### Test 3: Owner Permissions ✅
- **Description**: Verify owner can create carriers
- **Method**:
  1. Create owner user with tests.create_supabase_user()
  2. Set identifier with makerkit.set_identifier()
  3. Create test account
  4. Attempt to create carrier
- **Expected**: Owner can successfully create carrier
- **Status**: PASSED
- **Implementation Notes**:
  - Need to create user before setting identifier
  - Account creation must happen after authentication
  - Used lives_ok() to verify successful insertion
  - Used makerkit.get_account_id_by_slug() to get account ID

#### Test 4: Member Permission Boundaries 🔄
- **Description**: Verify member without carriers.manage cannot create carriers
- **Method**:
  1. Create member user
  2. Add to account without carriers.manage permission
  3. Attempt to create carrier
- **Expected**: Operation fails with RLS policy violation
- **Setup Dependencies**: 
  - Requires Test 3 for account setup
- **Status**: NEXT

### 3. Business Logic Testing

#### Test 5: Cross-Account Access
- **Description**: Verify users cannot access carriers from other accounts
- **Method**:
  1. Create two accounts with owners
  2. Create carrier in first account
  3. Verify second owner cannot see it
- **Expected**: No access to carriers from other accounts
- **Setup Dependencies**: 
  - Requires Test 3 for carrier creation

## Implementation Order

1. ✅ Test 1: Anon Access
   - Simplest test
   - No user setup required
   - Provides base security verification

2. ✅ Test 3: Owner Permissions
   - Required for other tests
   - Tests core functionality
   - No dependencies

3. 🔄 Test 4: Member Permission Boundaries (Next)
   - Tests permission restrictions
   - Verifies RLS policies
   - Builds on Test 3

4. Test 2: Basic Member Access
   - Tests read access
   - Requires working owner permissions

5. Test 5: Cross-Account Access
   - Tests data isolation
   - Most complex setup

## Success Criteria

Each test must:
1. Pass independently
2. Not interfere with other tests
3. Clean up after itself (via transaction rollback)
4. Follow our testing best practices
5. Have clear, descriptive messages

## Test Setup Requirements

For each test:
1. Begin transaction
2. Create extension "basejump-supabase_test_helpers"
3. Declare test plan
4. Set up required test users/data
5. Run test(s)
6. Call finish()
7. Rollback transaction

## Implementation Progress
✅ = Completed
🔄 = In Progress/Next
⏳ = Pending

1. ✅ Test 1: Anon Access
2. ✅ Test 3: Owner Permissions
3. 🔄 Test 4: Member Permission Boundaries
4. ⏳ Test 2: Basic Member Access
5. ⏳ Test 5: Cross-Account Access
