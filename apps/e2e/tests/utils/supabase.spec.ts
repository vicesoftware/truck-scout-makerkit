import { test, expect } from '@playwright/test';
import { supabase, supabaseAdmin } from './supabase';

test.describe('Supabase DB Access', () => {
  test('should be able to connect to Supabase', async () => {
    // Test basic connection by querying the roles table
    const { data, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .limit(1);
    
    // Log any error for debugging
    if (error) {
      console.error('Error connecting to Supabase:', error);
    }

    // Verify we can connect and get a response
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });
});
