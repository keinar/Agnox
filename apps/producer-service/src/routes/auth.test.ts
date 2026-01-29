/**
 * Authentication Routes Test
 *
 * Tests the complete authentication flow:
 * - Signup (create organization + user)
 * - Login (authenticate and get JWT)
 * - Access protected route with valid token
 * - Access protected route without token (should fail)
 * - Get user info (/me endpoint)
 *
 * Run with: npx tsx src/routes/auth.test.ts
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function testAuthFlow() {
  console.log('\n🧪 Testing Authentication Flow...\n');

  try {
    // ========================================================================
    // Test 1: Signup - Create new organization and user
    // ========================================================================
    console.log('Test 1: POST /api/auth/signup');
    const signupData = {
      email: `test-${Date.now()}@example.com`,
      password: 'SecureP@ssw0rd!',
      name: 'Test User',
      organizationName: 'Test Organization'
    };

    const signupResponse = await axios.post(`${API_URL}/api/auth/signup`, signupData);

    if (signupResponse.status !== 201) {
      console.error('❌ FAILED: Expected status 201, got', signupResponse.status);
      process.exit(1);
    }

    if (!signupResponse.data.success) {
      console.error('❌ FAILED: Expected success=true');
      process.exit(1);
    }

    if (!signupResponse.data.token) {
      console.error('❌ FAILED: No token returned');
      process.exit(1);
    }

    if (!signupResponse.data.user) {
      console.error('❌ FAILED: No user data returned');
      process.exit(1);
    }

    if (signupResponse.data.user.role !== 'admin') {
      console.error('❌ FAILED: First user should be admin');
      process.exit(1);
    }

    console.log('✅ PASSED: Signup successful');
    console.log('  User:', signupResponse.data.user.email);
    console.log('  Organization:', signupResponse.data.user.organizationName);
    console.log('  Role:', signupResponse.data.user.role);

    const signupToken = signupResponse.data.token;

    // ========================================================================
    // Test 2: Login - Authenticate with credentials
    // ========================================================================
    console.log('\nTest 2: POST /api/auth/login');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: signupData.email,
      password: signupData.password
    });

    if (loginResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', loginResponse.status);
      process.exit(1);
    }

    if (!loginResponse.data.token) {
      console.error('❌ FAILED: No token returned');
      process.exit(1);
    }

    console.log('✅ PASSED: Login successful');
    console.log('  Token length:', loginResponse.data.token.length);

    const loginToken = loginResponse.data.token;

    // ========================================================================
    // Test 3: Access protected route WITH token
    // ========================================================================
    console.log('\nTest 3: GET /api/executions (with token)');
    const executionsResponse = await axios.get(`${API_URL}/api/executions`, {
      headers: {
        Authorization: `Bearer ${loginToken}`
      }
    });

    if (executionsResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', executionsResponse.status);
      process.exit(1);
    }

    console.log('✅ PASSED: Protected route accessible with valid token');
    console.log('  Executions count:', executionsResponse.data.length);

    // ========================================================================
    // Test 4: Access protected route WITHOUT token (should fail)
    // ========================================================================
    console.log('\nTest 4: GET /api/executions (without token)');
    try {
      await axios.get(`${API_URL}/api/executions`);
      console.error('❌ FAILED: Should have returned 401');
      process.exit(1);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ PASSED: Protected route rejected request without token');
        console.log('  Error:', error.response.data.error);
      } else {
        console.error('❌ FAILED: Expected 401, got', error.response?.status);
        process.exit(1);
      }
    }

    // ========================================================================
    // Test 5: Get current user info (/me endpoint)
    // ========================================================================
    console.log('\nTest 5: GET /api/auth/me');
    const meResponse = await axios.get(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginToken}`
      }
    });

    if (meResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', meResponse.status);
      process.exit(1);
    }

    if (!meResponse.data.success) {
      console.error('❌ FAILED: Expected success=true');
      process.exit(1);
    }

    if (!meResponse.data.data.organization) {
      console.error('❌ FAILED: No organization data');
      process.exit(1);
    }

    console.log('✅ PASSED: User info retrieved successfully');
    console.log('  User:', meResponse.data.data.email);
    console.log('  Organization:', meResponse.data.data.organization.name);
    console.log('  Plan:', meResponse.data.data.organization.plan);
    console.log('  Limits:', JSON.stringify(meResponse.data.data.organization.limits));

    // ========================================================================
    // Test 6: Access public routes without token
    // ========================================================================
    console.log('\nTest 6: GET / (public health check)');
    const healthResponse = await axios.get(`${API_URL}/`);

    if (healthResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', healthResponse.status);
      process.exit(1);
    }

    console.log('✅ PASSED: Public route accessible without token');
    console.log('  Response:', healthResponse.data.message);

    // ========================================================================
    // Test 7: Login with invalid credentials
    // ========================================================================
    console.log('\nTest 7: POST /api/auth/login (invalid credentials)');
    try {
      await axios.post(`${API_URL}/api/auth/login`, {
        email: signupData.email,
        password: 'WrongPassword123!'
      });
      console.error('❌ FAILED: Should have returned 401');
      process.exit(1);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ PASSED: Invalid credentials rejected');
        console.log('  Error:', error.response.data.error);
      } else {
        console.error('❌ FAILED: Expected 401, got', error.response?.status);
        process.exit(1);
      }
    }

    // ========================================================================
    // Test 8: Signup with weak password
    // ========================================================================
    console.log('\nTest 8: POST /api/auth/signup (weak password)');
    try {
      await axios.post(`${API_URL}/api/auth/signup`, {
        email: 'weak-test@example.com',
        password: 'weak',
        name: 'Weak Test',
        organizationName: 'Weak Org'
      });
      console.error('❌ FAILED: Should have returned 400');
      process.exit(1);
    } catch (error: any) {
      if (error.response?.status === 400) {
        console.log('✅ PASSED: Weak password rejected');
        console.log('  Error:', error.response.data.error);
      } else {
        console.error('❌ FAILED: Expected 400, got', error.response?.status);
        process.exit(1);
      }
    }

    // ========================================================================
    // Test 9: Signup with duplicate email
    // ========================================================================
    console.log('\nTest 9: POST /api/auth/signup (duplicate email)');
    try {
      await axios.post(`${API_URL}/api/auth/signup`, {
        email: signupData.email, // Same email as Test 1
        password: 'SecureP@ssw0rd!',
        name: 'Duplicate User',
        organizationName: 'Duplicate Org'
      });
      console.error('❌ FAILED: Should have returned 409');
      process.exit(1);
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log('✅ PASSED: Duplicate email rejected');
        console.log('  Error:', error.response.data.error);
      } else {
        console.error('❌ FAILED: Expected 409, got', error.response?.status);
        process.exit(1);
      }
    }

    // ========================================================================
    // Test 10: Logout
    // ========================================================================
    console.log('\nTest 10: POST /api/auth/logout');
    const logoutResponse = await axios.post(`${API_URL}/api/auth/logout`, {}, {
      headers: {
        Authorization: `Bearer ${loginToken}`
      }
    });

    if (logoutResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', logoutResponse.status);
      process.exit(1);
    }

    console.log('✅ PASSED: Logout successful');
    console.log('  Message:', logoutResponse.data.message);

    console.log('\n✅ All 10 tests passed!\n');
    console.log('=== Authentication Flow Summary ===');
    console.log('✅ Signup creates organization and admin user');
    console.log('✅ Login returns JWT token');
    console.log('✅ Protected routes require valid token');
    console.log('✅ Public routes accessible without token');
    console.log('✅ User info endpoint works correctly');
    console.log('✅ Invalid credentials rejected');
    console.log('✅ Weak passwords rejected');
    console.log('✅ Duplicate emails rejected');
    console.log('✅ Logout endpoint functional');
    console.log('\n🎉 Sprint 2 Complete!\n');

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
console.log('⚠️  Make sure the producer service is running on http://localhost:3000');
console.log('⚠️  Run: docker-compose up producer-service mongodb\n');

testAuthFlow().catch(console.error);
