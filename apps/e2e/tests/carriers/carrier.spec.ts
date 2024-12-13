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

test.describe('Carrier CRUD Operations', () => {
  let ownerAccount: { id: string; name: string };
  let adminUser: TestUser;
  let testFactoringCompanyId: string;

  // Setup before all tests
  test.beforeAll(async () => {
    try {
      // Create owner account (for factoring company)
      const ownerSetup = await createTestAccountWithUser({
        email: `owner-carrier-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'owner'
      });
      ownerAccount = ownerSetup.account;

      // Create admin user
      const adminSetup = await createTestAccountWithUser({
        email: `admin-carrier-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'admin'
      });
      adminUser = adminSetup.user;

      // Create a test factoring company
      const factoringCompanyData = generateTestFactoringCompany(ownerAccount.id);
      const { data: factoringCompany, error: factoringCompanyError } = await supabaseAdmin
        .from('factoring_companies')
        .insert(factoringCompanyData)
        .select('id')
        .single();

      if (factoringCompanyError) {
        console.error('Factoring Company Creation Error:', JSON.stringify(factoringCompanyError, null, 2));
        throw factoringCompanyError;
      }

      testFactoringCompanyId = factoringCompany.id;
    } catch (error) {
      console.error('Carrier Test Setup Error:', error);
      throw error;
    }
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupTestAccount(ownerAccount.id);
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

    console.log('Carrier created successfully:', JSON.stringify(data, null, 2));
  });
});
