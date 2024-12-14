import { test, expect } from '@playwright/test';
import {
  createTestAccountWithUser,
  addUserToAccount,
  createAuthenticatedClient,
  cleanupTestAccount,
  TestAccount,
  TestUser,
  hasPermission,
} from '../utils/supabase';

test.describe('Carrier Tests', () => {
  let ownerAccount: TestAccount;
  let ownerUser: TestUser;
  let memberUser: TestUser;
  let adminUser: TestUser;
  let carrierId: string;

  test.beforeAll(async () => {
    try {
      // 1. Create owner account
      const ownerSetup = await createTestAccountWithUser({
        email: `owner-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'owner'
      });
      ownerAccount = ownerSetup.account;
      ownerUser = ownerSetup.user;

      // 2. Add member user to owner's account
      memberUser = await addUserToAccount(ownerAccount.id, {
        email: `member-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'member'
      });

      // 3. Add admin user to owner's account
      adminUser = await addUserToAccount(ownerAccount.id, {
        email: `admin-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'admin'
      });

      // 4. Create test carrier using owner client
      const ownerClient = await createAuthenticatedClient(ownerUser);
      
      // Verify owner has carrier management permission
      const canManage = await hasPermission(
        ownerClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(true);

      const { data: carrier, error: createError } = await ownerClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Test Carrier',
          mc_number: 'MC67890',
          preferred_status: false,
          rating: 4.5
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create test carrier: ${createError.message}`);
      }

      carrierId = carrier.id;
    } catch (err) {
      const error = err as Error;
      throw new Error(`Test setup failed: ${error.message}`);
    }
  });

  test.afterAll(async () => {
    try {
      await cleanupTestAccount(ownerAccount.id);
    } catch (err) {
      const error = err as Error;
      console.error(`Cleanup failed: ${error.message}`);
      throw error;
    }
  });

  test('Member can read carrier', async () => {
    try {
      const memberClient = await createAuthenticatedClient(memberUser);

      // Verify member does not have carrier management permission
      const canManage = await hasPermission(
        memberClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(false);

      // Verify member can read carrier data
      const { data: carrier, error: readError } = await memberClient
        .from('carriers')
        .select(`
          id,
          name,
          mc_number,
          preferred_status,
          rating,
          created_at,
          updated_at
        `)
        .eq('id', carrierId)
        .single();

      if (readError) {
        throw new Error(`Failed to read carrier: ${readError.message}`);
      }

      expect(carrier).toBeDefined();
      expect(carrier.id).toBe(carrierId);
      expect(carrier.name).toBe('Test Carrier');
      expect(carrier.mc_number).toBe('MC67890');
      expect(carrier.preferred_status).toBe(false);
      expect(carrier.rating).toBe(4.5);
      expect(carrier.created_at).toBeDefined();
      expect(carrier.updated_at).toBeDefined();

      // Verify RLS policy prevents access to other accounts
      const { data: otherCarrier, error: otherError } = await memberClient
        .from('carriers')
        .select()
        .neq('account_id', ownerAccount.id)
        .maybeSingle();

      expect(otherCarrier).toBeNull();
      expect(otherError).toBeNull();
    } catch (err) {
      const error = err as Error;
      throw new Error(`Member read test failed: ${error.message}`);
    }
  });

  test('Owner can create carrier', async () => {
    try {
      const ownerClient = await createAuthenticatedClient(ownerUser);
      
      // Verify owner has carrier management permission
      const canManage = await hasPermission(
        ownerClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(true);

      const { data: carrier, error } = await ownerClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Another Test Carrier',
          mc_number: 'MC54321',
          preferred_status: true,
          rating: 3.5
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create carrier: ${error.message}`);
      }

      expect(carrier).toBeDefined();
      expect(carrier.name).toBe('Another Test Carrier');
      expect(carrier.mc_number).toBe('MC54321');
      expect(carrier.preferred_status).toBe(true);
      expect(carrier.rating).toBe(3.5);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Owner create test failed: ${error.message}`);
    }
  });

  test('Member cannot create carrier', async () => {
    try {
      const memberClient = await createAuthenticatedClient(memberUser);

      // Verify member does not have carrier management permission
      const canManage = await hasPermission(
        memberClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(false);

      // Attempt to create carrier
      const { data: carrier, error: createError } = await memberClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Member Test Carrier',
          mc_number: 'MC99999',
          preferred_status: false,
          rating: 3.0
        })
        .select()
        .single();

      // Verify creation was denied
      expect(createError).toBeDefined();
      expect(carrier).toBeNull();
      if (createError) {
        expect(createError.message).toContain('row-level security policy');
      } else {
        throw new Error('Expected an error but none was received');
      }
    } catch (err) {
      const error = err as Error;
      throw new Error(`Member create test failed: ${error.message}`);
    }
  });

  test('Member cannot update carrier', async () => {
    try {
      const memberClient = await createAuthenticatedClient(memberUser);

      // Verify member does not have carrier management permission
      const canManage = await hasPermission(
        memberClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(false);

      // Attempt to update carrier
      const { data: carrier, error: updateError } = await memberClient
        .from('carriers')
        .update({
          name: 'Updated Name',
          rating: 2.0
        })
        .eq('id', carrierId)
        .select()
        .single();

      // Verify update was denied
      expect(updateError).toBeDefined();
      expect(carrier).toBeNull();
      if (updateError) {
        expect(updateError.message).toContain('permission denied');
      } else {
        throw new Error('Expected an error but none was received');
      }

      // Verify carrier was not actually updated
      const { data: originalCarrier, error: readError } = await memberClient
        .from('carriers')
        .select()
        .eq('id', carrierId)
        .single();

      expect(readError).toBeNull();
      expect(originalCarrier.name).toBe('Test Carrier');
      expect(originalCarrier.rating).toBe(4.5);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Member update test failed: ${error.message}`);
    }
  });

  test('Admin should be able to update carriers', async () => {
    try {
      const adminClient = await createAuthenticatedClient(adminUser);

      // Verify admin has carrier management permission
      const canManage = await hasPermission(
        adminClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(true);

      // Update carrier
      const { data: updatedCarrier, error: updateError } = await adminClient
        .from('carriers')
        .update({
          name: 'Admin Updated Carrier',
          rating: 3.0,
          preferred_status: true
        })
        .eq('id', carrierId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update carrier: ${updateError.message}`);
      }

      expect(updatedCarrier).toBeDefined();
      expect(updatedCarrier.name).toBe('Admin Updated Carrier');
      expect(updatedCarrier.rating).toBe(3.0);
      expect(updatedCarrier.preferred_status).toBe(true);

      // Verify update persisted
      const { data: verifyCarrier, error: verifyError } = await adminClient
        .from('carriers')
        .select()
        .eq('id', carrierId)
        .single();

      expect(verifyError).toBeNull();
      expect(verifyCarrier.name).toBe('Admin Updated Carrier');
      expect(verifyCarrier.rating).toBe(3.0);
      expect(verifyCarrier.preferred_status).toBe(true);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Admin update test failed: ${error.message}`);
    }
  });

  test('Admin should be able to delete carriers', async () => {
    try {
      const adminClient = await createAuthenticatedClient(adminUser);

      // Verify admin has carrier management permission
      const canManage = await hasPermission(
        adminClient,
        ownerAccount.id,
        'carriers.manage'
      );
      expect(canManage).toBe(true);

      // Create a carrier to delete
      const { data: carrier, error: createError } = await adminClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Carrier To Delete',
          mc_number: 'MC11111',
          preferred_status: false,
          rating: 2.5
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create test carrier: ${createError.message}`);
      }

      // Delete the carrier
      const { error: deleteError } = await adminClient
        .from('carriers')
        .delete()
        .eq('id', carrier.id);

      if (deleteError) {
        throw new Error(`Failed to delete carrier: ${deleteError.message}`);
      }

      // Verify carrier was deleted
      const { data: verifyCarrier, error: verifyError } = await adminClient
        .from('carriers')
        .select()
        .eq('id', carrier.id)
        .maybeSingle();

      expect(verifyError).toBeNull();
      expect(verifyCarrier).toBeNull();
    } catch (err) {
      const error = err as Error;
      throw new Error(`Admin delete test failed: ${error.message}`);
    }
  });
});
