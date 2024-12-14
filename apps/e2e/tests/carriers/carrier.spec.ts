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

      // Verify owner has carrier creation permission
      const canManage = await hasPermission(
        ownerClient,
        ownerAccount.id,
        'carriers.create'
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

      // Verify member has read permission
      const canRead = await hasPermission(
        memberClient,
        ownerAccount.id,
        'carriers.read'
      );
      expect(canRead).toBe(true);

      // Verify member can read carrier data
      const { data: carrier, error: readError } = await memberClient
        .from('carriers')
        .select('id, name, mc_number, preferred_status, rating, created_at, updated_at')
        .eq('account_id', ownerAccount.id)
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

      // Verify owner has carrier creation permission
      const canCreate = await hasPermission(
        ownerClient,
        ownerAccount.id,
        'carriers.create'
      );
      expect(canCreate).toBe(true);

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
    const memberClient = await createAuthenticatedClient(memberUser);

    // Verify member does not have carrier creation permission
    const canCreate = await hasPermission(
      memberClient,
      ownerAccount.id,
      'carriers.create'
    );
    expect(canCreate).toBe(false);

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

    // Verify creation was denied due to RLS policy
    expect(createError).toBeDefined();
    expect(carrier).toBeNull();
    expect(createError?.message).toContain('row-level security policy');
  });

  test('Member cannot update carrier', async () => {
    const ownerClient = await createAuthenticatedClient(ownerUser);
    const memberClient = await createAuthenticatedClient(memberUser);

    // Create a test carrier as owner
    const { data: carrier, error: createError } = await ownerClient
      .from('carriers')
      .insert({
        account_id: ownerAccount.id,
        name: 'Test Carrier',
        mc_number: 'MC99999',
        preferred_status: false,
        rating: 4.0
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create test carrier: ${createError.message}`);
    }

    // Verify member does not have carrier update permission
    const canUpdate = await hasPermission(
      memberClient,
      ownerAccount.id,
      'carriers.update'
    );
    expect(canUpdate).toBe(false);

    // Attempt to update carrier
    const { error: updateError } = await memberClient
      .from('carriers')
      .update({
        name: 'Member Updated Carrier',
        rating: 2.0,
        preferred_status: true
      })
      .eq('id', carrier.id);

    // Verify update was denied due to RLS policy
    expect(updateError).toBeDefined();
    expect(updateError?.message).toContain('row-level security policy');
  });

  test('Admin should be able to update carriers', async () => {
    try {
      const adminClient = await createAuthenticatedClient(adminUser);

      // Verify admin has carrier update permission
      const canUpdate = await hasPermission(
        adminClient,
        ownerAccount.id,
        'carriers.update'
      );
      expect(canUpdate).toBe(true);

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

      // Verify admin has carrier delete permission
      const canDelete = await hasPermission(
        adminClient,
        ownerAccount.id,
        'carriers.delete'
      );
      expect(canDelete).toBe(true);

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

  test('Owner can list and filter carriers', async () => {
    try {
      const ownerClient = await createAuthenticatedClient(ownerUser);

      // Create multiple test carriers
      const carriers = [
        { name: 'Test Carrier 1', mc_number: 'MC12345', preferred_status: true },
        { name: 'Test Carrier 2', mc_number: 'MC67890', preferred_status: false },
        { name: 'Test Carrier 3', mc_number: 'MC11111', preferred_status: true }
      ];

      // Insert test carriers
      for (const carrier of carriers) {
        const { error: createError } = await ownerClient
          .from('carriers')
          .insert({
            ...carrier,
            account_id: ownerAccount.id,
            rating: 4.0
          });

        if (createError) {
          throw new Error(`Failed to create test carrier: ${createError.message}`);
        }
      }

      // Test filtering by MC number
      const { data: mcNumberResult, error: mcNumberError } = await ownerClient
        .from('carriers')
        .select()
        .eq('mc_number', 'MC12345')
        .single();

      expect(mcNumberError).toBeNull();
      expect(mcNumberResult?.name).toBe('Test Carrier 1');

      // Test filtering by preferred status
      const { data: preferredResult, error: preferredError } = await ownerClient
        .from('carriers')
        .select()
        .eq('preferred_status', true);

      expect(preferredError).toBeNull();
      expect(preferredResult?.length ?? 0).toBe(2);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Owner list and filter test failed: ${error.message}`);
    }
  });

  test('Owner can create carrier with contact info', async () => {
    try {
      const ownerClient = await createAuthenticatedClient(ownerUser);

      const contactInfo = {
        phone: '555-0123',
        email: 'contact@testcarrier.com',
        address: '123 Test St'
      };

      const { data, error } = await ownerClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Contact Test Carrier',
          mc_number: 'MC99999',
          contact_info: contactInfo,
          preferred_status: false,
          rating: 4.0
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.contact_info).toEqual(contactInfo);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Contact info test failed: ${error.message}`);
    }
  });

  test('Carrier timestamps are properly set', async () => {
    try {
      const ownerClient = await createAuthenticatedClient(ownerUser);

      // Create carrier
      const { data: created, error: createError } = await ownerClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Timestamp Test Carrier',
          mc_number: 'MC77777',
          preferred_status: false,
          rating: 4.0
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create carrier: ${createError.message}`);
      }

      expect(created.created_at).toBeDefined();
      expect(created.updated_at).toBeDefined();
      const originalUpdatedAt = created.updated_at;

      // Wait to ensure different timestamp (3 seconds to be safe)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update carrier
      const { data: updated, error: updateError } = await ownerClient
        .from('carriers')
        .update({ name: 'Updated Name' })
        .eq('id', created.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update carrier: ${updateError.message}`);
      }

      expect(updated.updated_at).not.toBe(originalUpdatedAt);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Timestamp test failed: ${error.message}`);
    }
  });

  test('Cannot create carrier with duplicate MC number', async () => {
    try {
      const ownerClient = await createAuthenticatedClient(ownerUser);

      // Create first carrier
      const { error: firstError } = await ownerClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Original Carrier',
          mc_number: 'MC44444',
          preferred_status: false,
          rating: 4.0
        });

      if (firstError) {
        throw new Error(`Failed to create first carrier: ${firstError.message}`);
      }

      // Attempt to create carrier with same MC number
      const { error } = await ownerClient
        .from('carriers')
        .insert({
          account_id: ownerAccount.id,
          name: 'Duplicate Carrier',
          mc_number: 'MC44444',
          preferred_status: false,
          rating: 4.0
        });

      expect(error).toBeDefined();
      if (error) {
        expect(error.message).toContain('duplicate');
      }
    } catch (err) {
      const error = err as Error;
      throw new Error(`Duplicate MC number test failed: ${error.message}`);
    }
  });

  test('Validates carrier data formats', async () => {
    try {
      const ownerClient = await createAuthenticatedClient(ownerUser);

      const invalidTests = [
        {
          data: { rating: 6.0 }, // Rating > 5.0
          errorCheck: (error: any) => expect(error?.message).toContain('check_rating')
        },
        {
          data: { rating: -1.0 }, // Rating < 0
          errorCheck: (error: any) => expect(error?.message).toContain('check_rating')
        },
        {
          data: { mc_number: '' }, // Empty MC number
          errorCheck: (error: any) => expect(error?.message).toContain('null value in column')
        }
      ];

      for (const test of invalidTests) {
        const { error } = await ownerClient
          .from('carriers')
          .insert({
            account_id: ownerAccount.id,
            name: 'Invalid Test Carrier',
            mc_number: 'MC55555',
            preferred_status: false,
            rating: 4.0,
            ...test.data
          });

        expect(error).toBeDefined();
        if (error) {
          test.errorCheck(error);
        }
      }
    } catch (err) {
      const error = err as Error;
      throw new Error(`Data validation test failed: ${error.message}`);
    }
  });
});
