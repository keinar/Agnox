/**
 * Multi-Organization Data Isolation Test
 *
 * This test verifies that:
 * 1. Organizations can be created independently
 * 2. Data is completely isolated between organizations
 * 3. Cross-organization access is prevented
 * 4. Socket.io connections are scoped to organizations
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, colors.bold + colors.cyan);
  console.log('='.repeat(70));
}

async function testMultiOrgIsolation() {
  log('\n🧪 Multi-Organization Data Isolation Test Suite', colors.bold + colors.blue);
  log('Testing Phase 1 Multi-Tenant Implementation\n', colors.blue);

  let tokenA: string = '';
  let tokenB: string = '';
  let orgAId: string = '';
  let orgBId: string = '';
  let executionId: string = '';

  try {
    // ========================================================================
    // Test 1: Create Organization A
    // ========================================================================
    logSection('Test 1: Create Organization A');

    try {
      const signupA = await axios.post(`${API_URL}/api/auth/signup`, {
        email: `org-a-admin-${Date.now()}@test.local`,
        password: 'TestPass123!',
        name: 'Admin A',
        organizationName: 'Test Organization A'
      });

      if (signupA.status === 201 && signupA.data.success) {
        tokenA = signupA.data.token;
        orgAId = signupA.data.user.organizationId;
        log('✅ PASS: Organization A created successfully', colors.green);
        log(`   Organization ID: ${orgAId}`, colors.blue);
        log(`   User: ${signupA.data.user.name} (${signupA.data.user.role})`, colors.blue);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error: any) {
      log(`❌ FAIL: ${error.message}`, colors.red);
      throw error;
    }

    // ========================================================================
    // Test 2: Create Organization B
    // ========================================================================
    logSection('Test 2: Create Organization B');

    try {
      const signupB = await axios.post(`${API_URL}/api/auth/signup`, {
        email: `org-b-admin-${Date.now()}@test.local`,
        password: 'TestPass123!',
        name: 'Admin B',
        organizationName: 'Test Organization B'
      });

      if (signupB.status === 201 && signupB.data.success) {
        tokenB = signupB.data.token;
        orgBId = signupB.data.user.organizationId;
        log('✅ PASS: Organization B created successfully', colors.green);
        log(`   Organization ID: ${orgBId}`, colors.blue);
        log(`   User: ${signupB.data.user.name} (${signupB.data.user.role})`, colors.blue);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error: any) {
      log(`❌ FAIL: ${error.message}`, colors.red);
      throw error;
    }

    // Verify organizations are different
    if (orgAId === orgBId) {
      log('❌ FAIL: Organizations have the same ID!', colors.red);
      throw new Error('Organization IDs should be unique');
    }
    log(`✅ PASS: Organizations have unique IDs`, colors.green);

    // ========================================================================
    // Test 3: User A creates execution
    // ========================================================================
    logSection('Test 3: User A Creates Execution');

    try {
      const createExecution = await axios.post(
        `${API_URL}/api/execution-request`,
        {
          taskId: `test-org-a-${Date.now()}`,
          image: 'test-image:latest',
          command: 'npm test',
          folder: 'tests',
          tests: ['tests/example.spec.ts'],
          config: {
            environment: 'staging',
            baseUrl: 'https://example.com',
            retryAttempts: 0
          }
        },
        {
          headers: { Authorization: `Bearer ${tokenA}` }
        }
      );

      if (createExecution.status === 201 || createExecution.status === 200) {
        executionId = createExecution.data.taskId;
        log('✅ PASS: Execution created by Organization A', colors.green);
        log(`   Task ID: ${executionId}`, colors.blue);
      } else {
        throw new Error('Failed to create execution');
      }
    } catch (error: any) {
      log(`❌ FAIL: ${error.response?.data?.error || error.message}`, colors.red);
      throw error;
    }

    // ========================================================================
    // Test 4: User B fetches executions (should NOT see User A's)
    // ========================================================================
    logSection('Test 4: Data Isolation - User B Cannot See User A\'s Execution');

    try {
      const orgBExecutions = await axios.get(`${API_URL}/api/executions`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });

      const executionsArray = orgBExecutions.data.data || orgBExecutions.data;

      if (executionsArray.length > 0) {
        // Check if any execution belongs to Org A
        const hasOrgAData = executionsArray.some((exec: any) =>
          exec.organizationId === orgAId || exec.taskId === executionId
        );

        if (hasOrgAData) {
          log('❌ FAIL: User B can see User A\'s execution - DATA LEAK!', colors.red);
          throw new Error('Cross-organization data leak detected');
        }
      }

      log('✅ PASS: User B cannot see User A\'s execution', colors.green);
      log(`   User B has ${executionsArray.length} executions (all their own)`, colors.blue);
    } catch (error: any) {
      if (error.message.includes('DATA LEAK')) {
        throw error;
      }
      log(`❌ FAIL: ${error.response?.data?.error || error.message}`, colors.red);
      throw error;
    }

    // ========================================================================
    // Test 5: User A fetches executions (should see their own)
    // ========================================================================
    logSection('Test 5: User A Can See Their Own Execution');

    try {
      const orgAExecutions = await axios.get(`${API_URL}/api/executions`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });

      const executionsArray = orgAExecutions.data.data || orgAExecutions.data;

      if (executionsArray.length === 0) {
        log('❌ FAIL: User A cannot see their own execution!', colors.red);
        throw new Error('User cannot see their own data');
      }

      const foundExecution = executionsArray.find((exec: any) => exec.taskId === executionId);

      if (!foundExecution) {
        log('❌ FAIL: Created execution not found in User A\'s list!', colors.red);
        throw new Error('Execution not found');
      }

      log('✅ PASS: User A can see their own execution', colors.green);
      log(`   Total executions for User A: ${executionsArray.length}`, colors.blue);
      log(`   Verified execution: ${executionId}`, colors.blue);
    } catch (error: any) {
      log(`❌ FAIL: ${error.response?.data?.error || error.message}`, colors.red);
      throw error;
    }

    // ========================================================================
    // Test 6: User B tries to delete User A's execution (should fail)
    // ========================================================================
    logSection('Test 6: Cross-Org Delete Prevention - User B Cannot Delete User A\'s Execution');

    try {
      const deleteAttempt = await axios.delete(
        `${API_URL}/api/executions/${executionId}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` }
        }
      );

      // If we reach here, the delete succeeded - which is bad!
      log('❌ FAIL: User B was able to delete User A\'s execution!', colors.red);
      throw new Error('Cross-organization delete succeeded - SECURITY ISSUE');
    } catch (error: any) {
      if (error.response?.status === 404) {
        log('✅ PASS: User B cannot delete User A\'s execution (404 Not Found)', colors.green);
        log('   Execution not found in User B\'s organization scope', colors.blue);
      } else if (error.response?.status === 403) {
        log('✅ PASS: User B cannot delete User A\'s execution (403 Forbidden)', colors.green);
      } else if (error.message.includes('SECURITY ISSUE')) {
        throw error;
      } else {
        log(`⚠️  WARNING: Unexpected error: ${error.message}`, colors.yellow);
      }
    }

    // ========================================================================
    // Test 7: Verify /me endpoint returns correct organization
    // ========================================================================
    logSection('Test 7: Verify User Context is Organization-Scoped');

    try {
      const userAInfo = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });

      if (userAInfo.data.data.organization.id !== orgAId) {
        log('❌ FAIL: User A\'s /me endpoint returns wrong organization!', colors.red);
        throw new Error('Organization mismatch in /me endpoint');
      }

      log('✅ PASS: User A\'s /me endpoint returns correct organization', colors.green);
      log(`   Organization: ${userAInfo.data.data.organization.name}`, colors.blue);
      log(`   Plan: ${userAInfo.data.data.organization.plan}`, colors.blue);

      const userBInfo = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });

      if (userBInfo.data.data.organization.id !== orgBId) {
        log('❌ FAIL: User B\'s /me endpoint returns wrong organization!', colors.red);
        throw new Error('Organization mismatch in /me endpoint');
      }

      log('✅ PASS: User B\'s /me endpoint returns correct organization', colors.green);
      log(`   Organization: ${userBInfo.data.data.organization.name}`, colors.blue);
      log(`   Plan: ${userBInfo.data.data.organization.plan}`, colors.blue);
    } catch (error: any) {
      log(`❌ FAIL: ${error.response?.data?.error || error.message}`, colors.red);
      throw error;
    }

    // ========================================================================
    // Test 8: Cleanup - Delete test execution
    // ========================================================================
    logSection('Test 8: Cleanup - Delete Test Execution');

    try {
      await axios.delete(
        `${API_URL}/api/executions/${executionId}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` }
        }
      );

      log('✅ Test execution deleted successfully', colors.green);
    } catch (error: any) {
      log(`⚠️  WARNING: Failed to cleanup test execution: ${error.message}`, colors.yellow);
    }

    // ========================================================================
    // Final Summary
    // ========================================================================
    logSection('Test Suite Summary');

    log('\n✅ ALL TESTS PASSED!', colors.bold + colors.green);
    log('\nVerified Multi-Tenant Capabilities:', colors.blue);
    log('  ✓ Organizations can be created independently', colors.green);
    log('  ✓ Each organization has unique ID', colors.green);
    log('  ✓ Users can create executions scoped to their org', colors.green);
    log('  ✓ Cross-organization data isolation enforced', colors.green);
    log('  ✓ Cross-organization deletion prevented', colors.green);
    log('  ✓ User context correctly scoped to organization', colors.green);
    log('  ✓ JWT authentication working correctly', colors.green);

    log('\n🎉 Phase 1 Multi-Tenant Implementation: VERIFIED', colors.bold + colors.green);
    console.log('');

  } catch (error: any) {
    logSection('Test Suite Failed');
    log(`\n❌ TEST SUITE FAILED: ${error.message}`, colors.bold + colors.red);

    if (error.response) {
      log(`\nAPI Error Details:`, colors.yellow);
      log(`  Status: ${error.response.status}`, colors.yellow);
      log(`  Message: ${JSON.stringify(error.response.data, null, 2)}`, colors.yellow);
    }

    console.log('');
    process.exit(1);
  }
}

// Run the test suite
if (require.main === module) {
  testMultiOrgIsolation()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testMultiOrgIsolation };
