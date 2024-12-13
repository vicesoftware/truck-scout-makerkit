import { test, expect } from '@playwright/test';
import {
  supabaseAdmin,
  createTestAccountWithUser,
  createAuthenticatedClient,
  cleanupTestAccount,
  generateTestCarrier,
  generateTestFactoringCompany,
  hasPermission,
  TestUser
} from '../utils/supabase';

// Configure test to run sequentially
test.describe.configure({ mode: 'serial' });

test.describe('Carrier CRUD Operations', () => {
  let ownerAccount: { id: string; name: string };
  let adminUser: TestUser;
  let testFactoringCompanyId: string;
  let testCarrier: any;

  // Setup before all tests
  test.beforeAll(async () => {
    try {
      console.log('Starting test setup...');

      // Create owner account (for factoring company)
      const ownerSetup = await createTestAccountWithUser({
        email: `owner-carrier-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'owner'
      });

      if (!ownerSetup?.account?.id) {
        throw new Error('Owner account creation failed: ' + JSON.stringify(ownerSetup));
      }

      ownerAccount = ownerSetup.account;
      console.log('Owner account created:', ownerAccount);

      // Create admin user
      const adminSetup = await createTestAccountWithUser({
        email: `admin-carrier-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'admin'
      });

      if (!adminSetup?.user?.id) {
        throw new Error('Admin user creation failed: ' + JSON.stringify(adminSetup));
      }

      adminUser = adminSetup.user;
      console.log('Admin user created:', adminUser);

      // Link admin to owner's account
      const { error: linkError } = await supabaseAdmin
        .from('account_user')
        .insert({
          user_id: adminUser.id,
          account_id: ownerAccount.id,
          role: 'admin'
        });

      if (linkError) {
        console.error('Error linking admin to account:', linkError);
        throw new Error('Failed to link admin to account');
      }

      console.log('Admin linked to account successfully');

      // Create a test factoring company
      const factoringCompanyData = generateTestFactoringCompany(ownerAccount.id);
      const { data: factoringCompany, error: factoringCompanyError } = await supabaseAdmin
        .from('factoring_companies')
        .insert(factoringCompanyData)
        .select('id')
        .single();

      if (factoringCompanyError || !factoringCompany) {
        console.error('Factoring Company Creation Error:', factoringCompanyError);
        throw new Error('Failed to create factoring company');
      }

      testFactoringCompanyId = factoringCompany.id;
      console.log('Factoring company created:', testFactoringCompanyId);
    } catch (error) {
      console.error('Carrier Test Setup Error:', error);
      throw error;
    }
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    try {
      if (ownerAccount?.id) {
        await cleanupTestAccount(ownerAccount.id);
        console.log('Test account cleanup completed');
      }
    } catch (error) {
      console.error('Cleanup Error:', error);
    }
  });

  test('Admin should be able to create carriers', async () => {
    // Authenticate admin client
    const adminClient = await createAuthenticatedClient(adminUser);

    // Log detailed permission check
    console.log('Checking admin permissions...');
    const hasCarrierManagePermission = await hasPermission(
      adminClient,
      ownerAccount.id,
      'carriers.manage'
    );
    console.log('Admin Carrier Manage Permission:', hasCarrierManagePermission);
    expect(hasCarrierManagePermission).toBe(true);

    // Generate carrier data
    const carrierData = generateTestCarrier(ownerAccount.id, testFactoringCompanyId);
    console.log('Carrier Data to Insert:', JSON.stringify(carrierData, null, 2));

    // Attempt to create carrier
    const { data, error } = await adminClient
      .from('carriers')
      .insert(carrierData)
      .select('*')
      .single();

    // Log detailed error if insertion fails
    if (error) {
      console.error('Carrier Insertion Error:', JSON.stringify(error, null, 2));
    }

    // Assertions
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.name).toBe(carrierData.name);
    expect(data.account_id).toBe(ownerAccount.id);
    expect(data.factoring_company_id).toBe(testFactoringCompanyId);

    // Store carrier for subsequent tests
    testCarrier = data;
    console.log('Carrier created successfully:', JSON.stringify(data, null, 2));
  });

  test('Admin should be able to read carriers', async () => {
    const adminClient = await createAuthenticatedClient(adminUser);

    // Verify carrier read permission
    const hasReadPermission = await hasPermission(
      adminClient,
      ownerAccount.id,
      'carriers.read'
    );
    expect(hasReadPermission).toBe(true);

    // Attempt to read carrier
    const { data, error } = await adminClient
      .from('carriers')
      .select('*')
      .eq('id', testCarrier.id)
      .single();

    // Assertions
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.id).toBe(testCarrier.id);
    expect(data.name).toBe(testCarrier.name);
    expect(data.account_id).toBe(ownerAccount.id);
  });

  test('Admin should be able to update carriers', async () => {
    const adminClient = await createAuthenticatedClient(adminUser);

    // Verify carrier update permission
    const hasUpdatePermission = await hasPermission(
      adminClient,
      ownerAccount.id,
      'carriers.manage'
    );
    expect(hasUpdatePermission).toBe(true);

    // Update carrier data
    const updatedName = `Updated Carrier ${Date.now()}`;
    const { error: updateError } = await adminClient
      .from('carriers')
      .update({ name: updatedName })
      .eq('id', testCarrier.id);

    expect(updateError).toBeNull();

    // Verify update
    const { data: verifyData, error: verifyError } = await adminClient
      .from('carriers')
      .select('*')
      .eq('id', testCarrier.id)
      .single();

    expect(verifyError).toBeNull();
    expect(verifyData.name).toBe(updatedName);
  });

  test('Admin should be able to delete carriers', async () => {
    const adminClient = await createAuthenticatedClient(adminUser);

    // Verify carrier delete permission
    const hasDeletePermission = await hasPermission(
      adminClient,
      ownerAccount.id,
      'carriers.manage'
    );
    expect(hasDeletePermission).toBe(true);

    // Delete carrier
    const { error: deleteError } = await adminClient
      .from('carriers')
      .delete()
      .eq('id', testCarrier.id);

    expect(deleteError).toBeNull();

    // Verify deletion
    const { data: verifyData, error: verifyError } = await adminClient
      .from('carriers')
      .select('*')
      .eq('id', testCarrier.id);

    expect(verifyError).toBeNull();
    expect(verifyData).toHaveLength(0);
  });
});
