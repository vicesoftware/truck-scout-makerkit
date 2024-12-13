# E2E Test Plan: Carrier Management

## Overview
This document outlines the end-to-end test plan for carrier management functionality, focusing on authenticated access and CRUD operations.

## Test Environment Setup

### Authentication and Roles
1. Create test users with different roles:
   - Owner (highest privileges)
   - Admin (can manage carriers)
   - Member (limited access)
2. Each test should demonstrate proper role-based access control
3. Tests should use Supabase authentication

### Database State
- Tests should handle their own test data setup and cleanup
- Each test should create its own unique account context
- Use unique MC numbers for each test carrier

## Test Scenarios

### 1. Authentication and Authorization (Base Pattern)
This foundational test will demonstrate the pattern for authenticated database access that other tests will follow.

```typescript
// Pattern to demonstrate:
- Create test account
- Create authenticated user with specific role
- Verify database access with role permissions
- Clean up test data
```

### 2. Carrier CRUD Operations

#### Create Carrier
- Test creating carrier with minimum required fields:
  - account_id
  - name
  - mc_number
- Test creating carrier with all fields:
  - Include contact_info (JSONB)
  - rating
  - preferred_status
  - factoring_company_id (optional)
- Verify:
  - Success response
  - Created carrier matches input
  - Timestamps are set
  - Only users with 'carriers.manage' permission can create

#### Read Carrier
- Test retrieving single carrier by ID
- Test listing carriers for an account
- Test filtering carriers by:
  - MC number
  - Preferred status
  - Factoring company
- Verify:
  - Users can only see carriers in their account
  - All fields are correctly returned
  - Proper error handling for non-existent carriers

#### Update Carrier
- Test updating individual fields:
  - name
  - mc_number
  - contact_info
  - rating
  - preferred_status
  - factoring_company_id
- Test updating multiple fields simultaneously
- Verify:
  - Only authorized users can update
  - updated_at timestamp is updated
  - Original fields remain unchanged
  - Proper error handling for invalid updates

#### Delete Carrier
- Test deleting existing carrier
- Verify:
  - Only authorized users can delete
  - Carrier no longer exists after deletion
  - Related data is properly handled
  - Proper error handling for non-existent carriers

### 3. Role-Based Access Control

#### Owner Role Tests
- Verify all CRUD operations are permitted
- Test managing carriers across the account

#### Admin Role Tests
- Verify all CRUD operations are permitted
- Test managing carriers across the account

#### Member Role Tests
- Verify read-only access
- Confirm create/update/delete operations are denied

### 4. Edge Cases and Error Handling
- Test duplicate MC numbers
- Test invalid data formats
- Test missing required fields
- Test unauthorized access attempts
- Test cross-account access attempts

## Implementation Priority

1. Authentication Pattern Test
   - This will establish the base pattern for all subsequent tests
   - Focus on demonstrating proper role-based DB access

2. Basic CRUD Tests
   - Create with required fields
   - Read single carrier
   - Update basic fields
   - Delete carrier

3. Advanced CRUD Tests
   - Complex create scenarios
   - List and filter operations
   - Batch operations
   - Edge cases

4. Role-Based Access Tests
   - Different role permissions
   - Access control verification

## Test Data Management

### Test Account Structure
```typescript
interface TestAccount {
  id: string;
  name: string;
  users: {
    owner: TestUser;
    admin: TestUser;
    member: TestUser;
  };
}

interface TestUser {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}
```

### Sample Carrier Data
```typescript
interface TestCarrier {
  name: string;
  mc_number: string;
  contact_info: {
    phone: string;
    email: string;
    address: string;
  };
  rating: number;
  preferred_status: boolean;
}
```

## Best Practices
1. Each test should be independent and handle its own setup/cleanup
2. Use descriptive test names that indicate the scenario being tested
3. Group related tests using describe blocks
4. Add appropriate error messages for failed assertions
5. Document any non-obvious test setup or assertions
6. Use helper functions for common operations
7. Maintain consistent naming conventions
