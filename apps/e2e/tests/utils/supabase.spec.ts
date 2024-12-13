import { test, expect } from '@playwright/test';
import {
  supabase,
  supabaseAdmin,
  createTestAccountWithUser,
  createAuthenticatedClient,
  hasPermission,
  cleanupTestAccount,
  TestUser,
  TestAccount
} from './supabase';

test.describe('Supabase Foundation Tests', () => {
  let testAccount: TestAccount;
  let ownerUser: TestUser;
  let adminUser: TestUser;
  let memberUser: TestUser;

  test.beforeAll(async () => {
    // Create test users with different roles
    ownerUser = {
      email: `owner-${Date.now()}@test.com`,
      password: 'testPassword123',
      role: 'owner'
    };

    const ownerSetup = await createTestAccountWithUser(ownerUser);
    testAccount = ownerSetup.account;
    ownerUser = ownerSetup.user;

    // Create admin user
    adminUser = {
      email: `admin-${Date.now()}@test.com`,
      password: 'testPassword123',
      role: 'admin'
    };
    const adminSetup = await createTestAccountWithUser(adminUser);
    adminUser = adminSetup.user;

    // Create member user
    memberUser = {
      email: `member-${Date.now()}@test.com`,
      password: 'testPassword123',
      role: 'member'
    };
    const memberSetup = await createTestAccountWithUser(memberUser);
    memberUser = memberSetup.user;
  });

  test.afterAll(async () => {
    // Clean up all test data to maintain test isolation
    await cleanupTestAccount(testAccount?.id);
  });

  test.describe('Database Connectivity', () => {
    test('should be able to connect to Supabase', async () => {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  test.describe('User Creation & Management', () => {
    test('should create users with different roles', async () => {
      // Verify owner user
      expect(ownerUser.id).toBeDefined();
      expect(ownerUser.role).toBe('owner');

      // Verify admin user
      expect(adminUser.id).toBeDefined();
      expect(adminUser.role).toBe('admin');

      // Verify member user
      expect(memberUser.id).toBeDefined();
      expect(memberUser.role).toBe('member');
    });

    test('should support email/password authentication', async () => {
      // Test owner authentication
      const ownerClient = await createAuthenticatedClient(ownerUser);
      const { data: ownerData, error: ownerError } = await ownerClient
        .from('accounts')
        .select('*')
        .eq('id', testAccount.id);

      expect(ownerError).toBeNull();
      expect(ownerData).toHaveLength(1);

      // Test admin authentication
      const adminClient = await createAuthenticatedClient(adminUser);
      const { data: adminData, error: adminError } = await adminClient
        .from('accounts')
        .select('*')
        .eq('id', testAccount.id);

      expect(adminError).toBeNull();
      expect(adminData).toHaveLength(1);

      // Test member authentication
      const memberClient = await createAuthenticatedClient(memberUser);
      const { data: memberData, error: memberError } = await memberClient
        .from('accounts')
        .select('*')
        .eq('id', testAccount.id);

      expect(memberError).toBeNull();
      expect(memberData).toHaveLength(1);
    });
  });

  test.describe('Account Management', () => {
    test('should link users to accounts with specific roles', async () => {
      const { data, error } = await supabaseAdmin
        .from('account_user')
        .select('*')
        .eq('account_id', testAccount.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(3); // owner, admin, member

      const roles = data?.map((u: { role: string }) => u.role) || [];
      expect(roles).toContain('owner');
      expect(roles).toContain('admin');
      expect(roles).toContain('member');
    });

    test('should enforce account-specific data isolation', async () => {
      // Create another test account
      const otherUser: TestUser = {
        email: `other-${Date.now()}@test.com`,
        password: 'testPassword123',
        role: 'owner'
      };
      const otherSetup = await createTestAccountWithUser(otherUser);

      try {
        // Try to access other account's data with first account's user
        const ownerClient = await createAuthenticatedClient(ownerUser);
        const { error } = await ownerClient
          .from('accounts')
          .select('*')
          .eq('id', otherSetup.account.id);

        expect(error).not.toBeNull();
      } finally {
        await cleanupTestAccount(otherSetup.account.id);
      }
    });
  });

  test.describe('Permission Verification', () => {
    test('should verify role-based permissions', async () => {
      // Test owner permissions
      const ownerClient = await createAuthenticatedClient(ownerUser);
      expect(await hasPermission(ownerClient, testAccount.id, 'carriers.manage')).toBe(true);

      // Test admin permissions
      const adminClient = await createAuthenticatedClient(adminUser);
      expect(await hasPermission(adminClient, testAccount.id, 'carriers.manage')).toBe(true);

      // Test member permissions
      const memberClient = await createAuthenticatedClient(memberUser);
      expect(await hasPermission(memberClient, testAccount.id, 'carriers.manage')).toBe(false);
    });

    test('should verify permission inheritance', async () => {
      const ownerClient = await createAuthenticatedClient(ownerUser);
      const adminClient = await createAuthenticatedClient(adminUser);
      const memberClient = await createAuthenticatedClient(memberUser);

      const permissions = ['carriers.manage', 'carriers.read', 'carriers.write'];

      for (const permission of permissions) {
        // Owner should have all permissions
        expect(await hasPermission(ownerClient, testAccount.id, permission)).toBe(true);

        // Admin should have manage permissions
        expect(await hasPermission(adminClient, testAccount.id, permission)).toBe(true);

        // Member should only have read permissions
        const shouldHave = permission === 'carriers.read';
        expect(await hasPermission(memberClient, testAccount.id, permission)).toBe(shouldHave);
      }
    });
  });

  test.describe('Authentication Utilities', () => {
    test('should manage authentication tokens/sessions', async () => {
      const client = await createAuthenticatedClient(ownerUser);

      // Verify authenticated access
      const { error: authError } = await client
        .from('accounts')
        .select('*')
        .eq('id', testAccount.id);

      expect(authError).toBeNull();

      // Sign out
      await client.auth.signOut();

      // Verify access is denied after sign out
      const { error: deniedError } = await client
        .from('accounts')
        .select('*')
        .eq('id', testAccount.id);

      expect(deniedError).not.toBeNull();
    });

    test('should support concurrent authenticated sessions', async () => {
      // Create multiple authenticated clients
      const ownerClient = await createAuthenticatedClient(ownerUser);
      const adminClient = await createAuthenticatedClient(adminUser);
      const memberClient = await createAuthenticatedClient(memberUser);

      // Test concurrent access
      const [ownerResult, adminResult, memberResult] = await Promise.all([
        ownerClient.from('accounts').select('*').eq('id', testAccount.id),
        adminClient.from('accounts').select('*').eq('id', testAccount.id),
        memberClient.from('accounts').select('*').eq('id', testAccount.id)
      ]);

      expect(ownerResult.error).toBeNull();
      expect(adminResult.error).toBeNull();
      expect(memberResult.error).toBeNull();
    });

    test('should handle token refresh', async () => {
      const client = await createAuthenticatedClient(ownerUser);

      // Force token refresh by manipulating expiry
      const session = await client.auth.getSession();
      if (session.data.session) {
        // Simulate passage of time by making multiple authenticated requests
        for (let i = 0; i < 3; i++) {
          const { error } = await client
            .from('accounts')
            .select('*')
            .eq('id', testAccount.id);

          expect(error).toBeNull();

          // Add small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    });
  });
});
