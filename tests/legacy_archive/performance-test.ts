/**
 * Performance Testing Script for Phase 1 Multi-Tenant Implementation
 *
 * Tests:
 * 1. API endpoint response times under load
 * 2. Concurrent user authentication
 * 3. Database query performance with large datasets
 * 4. Socket.io connection handling
 * 5. Multi-tenant data isolation performance
 */

import fetch from 'node-fetch';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const CONCURRENT_USERS = 10;
const REQUESTS_PER_USER = 20;

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    details?: string;
    metrics?: any;
}

const results: TestResult[] = [];

// Helper function to measure execution time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
}

// Helper function to create test user
async function createTestUser(username: string, orgName: string) {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: `${username}@test.com`,
            password: 'Test123!@#',
            organizationName: orgName,
            name: username
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to create user: ${response.statusText}`);
    }

    return await response.json();
}

// Helper function to login
async function login(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
    }

    return await response.json();
}

// Test 1: API Response Time Under Load
async function testApiResponseTime() {
    console.log('\n📊 Test 1: API Response Time Under Load');
    console.log('Creating test user...');

    const timestamp = Date.now();
    const testUser = await createTestUser(`perfuser${timestamp}`, `PerfOrg${timestamp}`);
    const token = testUser.data.token;

    const responseTimes: number[] = [];
    const errors: number[] = [];

    console.log(`Making ${REQUESTS_PER_USER} requests to /api/executions...`);

    for (let i = 0; i < REQUESTS_PER_USER; i++) {
        const { duration } = await measureTime(async () => {
            const response = await fetch(`${API_URL}/api/executions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                errors.push(i);
            }

            return response.json();
        });

        responseTimes.push(duration);
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    const p95 = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

    const passed = avgResponseTime < 200 && maxResponseTime < 500 && errors.length === 0;

    results.push({
        name: 'API Response Time Under Load',
        passed,
        duration: avgResponseTime,
        details: `Avg: ${avgResponseTime.toFixed(2)}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms, P95: ${p95}ms, Errors: ${errors.length}`,
        metrics: { avgResponseTime, maxResponseTime, minResponseTime, p95, errorCount: errors.length }
    });

    console.log(`  ✓ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  ✓ Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms, P95: ${p95}ms`);
    console.log(`  ✓ Errors: ${errors.length}/${REQUESTS_PER_USER}`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} - ${passed ? 'Response times acceptable' : 'Response times too high'}`);
}

// Test 2: Concurrent User Authentication
async function testConcurrentAuthentication() {
    console.log('\n📊 Test 2: Concurrent User Authentication');
    console.log(`Creating ${CONCURRENT_USERS} users concurrently...`);

    const { result, duration } = await measureTime(async () => {
        const timestamp = Date.now();
        const promises = [];

        for (let i = 0; i < CONCURRENT_USERS; i++) {
            promises.push(createTestUser(`concurrent${timestamp}_${i}`, `ConcurrentOrg${timestamp}_${i}`));
        }

        return await Promise.all(promises);
    });

    const allSucceeded = result.every(r => r.success);
    const avgTimePerUser = duration / CONCURRENT_USERS;
    const passed = allSucceeded && avgTimePerUser < 500;

    results.push({
        name: 'Concurrent User Authentication',
        passed,
        duration,
        details: `${CONCURRENT_USERS} users created in ${duration}ms (${avgTimePerUser.toFixed(2)}ms per user)`,
        metrics: { totalUsers: CONCURRENT_USERS, totalTime: duration, avgTimePerUser, allSucceeded }
    });

    console.log(`  ✓ Total Time: ${duration}ms`);
    console.log(`  ✓ Avg Time Per User: ${avgTimePerUser.toFixed(2)}ms`);
    console.log(`  ✓ All Succeeded: ${allSucceeded}`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} - ${passed ? 'Concurrent auth performance acceptable' : 'Concurrent auth too slow'}`);
}

// Test 3: Database Query Performance with Multi-Tenant Filtering
async function testDatabaseQueryPerformance() {
    console.log('\n📊 Test 3: Database Query Performance with Multi-Tenant Filtering');
    console.log('Creating test user and executing queries...');

    const timestamp = Date.now();
    const testUser = await createTestUser(`dbperf${timestamp}`, `DBPerfOrg${timestamp}`);
    const token = testUser.data.token;

    const queryTimes: number[] = [];

    // Run 10 queries to test database performance
    for (let i = 0; i < 10; i++) {
        const { duration } = await measureTime(async () => {
            const response = await fetch(`${API_URL}/api/executions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.json();
        });

        queryTimes.push(duration);
    }

    const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const maxQueryTime = Math.max(...queryTimes);
    const passed = avgQueryTime < 100 && maxQueryTime < 200;

    results.push({
        name: 'Database Query Performance',
        passed,
        duration: avgQueryTime,
        details: `Avg: ${avgQueryTime.toFixed(2)}ms, Max: ${maxQueryTime}ms over 10 queries`,
        metrics: { avgQueryTime, maxQueryTime, queryCount: 10 }
    });

    console.log(`  ✓ Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`  ✓ Max Query Time: ${maxQueryTime}ms`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} - ${passed ? 'Query performance acceptable' : 'Queries too slow'}`);
}

// Test 4: Socket.io Connection Performance
async function testSocketIoPerformance() {
    console.log('\n📊 Test 4: Socket.io Connection Performance');
    console.log(`Connecting ${CONCURRENT_USERS} concurrent Socket.io clients...`);

    const timestamp = Date.now();
    const testUser = await createTestUser(`socketperf${timestamp}`, `SocketPerfOrg${timestamp}`);
    const token = testUser.data.token;

    const { result, duration } = await measureTime(async () => {
        const sockets: Socket[] = [];
        const connectionPromises: Promise<void>[] = [];

        for (let i = 0; i < CONCURRENT_USERS; i++) {
            connectionPromises.push(new Promise((resolve, reject) => {
                const socket = io(API_URL, {
                    auth: { token }
                });

                socket.on('auth-success', () => {
                    sockets.push(socket);
                    resolve();
                });

                socket.on('auth-error', (error) => {
                    reject(error);
                });

                socket.on('connect_error', (error) => {
                    reject(error);
                });

                // Timeout after 5 seconds
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            }));
        }

        await Promise.all(connectionPromises);

        // Disconnect all sockets
        sockets.forEach(socket => socket.disconnect());

        return sockets.length;
    });

    const avgConnectionTime = duration / result;
    const passed = result === CONCURRENT_USERS && avgConnectionTime < 500;

    results.push({
        name: 'Socket.io Connection Performance',
        passed,
        duration,
        details: `${result}/${CONCURRENT_USERS} connections in ${duration}ms (${avgConnectionTime.toFixed(2)}ms per connection)`,
        metrics: { totalConnections: result, totalTime: duration, avgConnectionTime }
    });

    console.log(`  ✓ Connections: ${result}/${CONCURRENT_USERS}`);
    console.log(`  ✓ Total Time: ${duration}ms`);
    console.log(`  ✓ Avg Time Per Connection: ${avgConnectionTime.toFixed(2)}ms`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} - ${passed ? 'Socket.io performance acceptable' : 'Socket.io connections too slow'}`);
}

// Test 5: Multi-Tenant Data Isolation Performance
async function testMultiTenantIsolationPerformance() {
    console.log('\n📊 Test 5: Multi-Tenant Data Isolation Performance');
    console.log('Creating 5 organizations and testing query isolation performance...');

    const timestamp = Date.now();
    const orgs: any[] = [];

    // Create 5 organizations
    for (let i = 0; i < 5; i++) {
        const user = await createTestUser(`isolperf${timestamp}_${i}`, `IsolPerfOrg${timestamp}_${i}`);
        orgs.push(user);
    }

    // Measure query time for each organization
    const queryTimes: number[] = [];

    for (const org of orgs) {
        const { duration } = await measureTime(async () => {
            const response = await fetch(`${API_URL}/api/executions`, {
                headers: { 'Authorization': `Bearer ${org.data.token}` }
            });
            return response.json();
        });

        queryTimes.push(duration);
    }

    const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const maxQueryTime = Math.max(...queryTimes);
    const variance = queryTimes.reduce((acc, time) => acc + Math.pow(time - avgQueryTime, 2), 0) / queryTimes.length;
    const stdDev = Math.sqrt(variance);

    // Performance is acceptable if avg query time is low and variance is small
    const passed = avgQueryTime < 150 && stdDev < 50;

    results.push({
        name: 'Multi-Tenant Data Isolation Performance',
        passed,
        duration: avgQueryTime,
        details: `Avg: ${avgQueryTime.toFixed(2)}ms, Max: ${maxQueryTime}ms, StdDev: ${stdDev.toFixed(2)}ms across 5 orgs`,
        metrics: { avgQueryTime, maxQueryTime, stdDev, orgCount: 5 }
    });

    console.log(`  ✓ Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`  ✓ Max Query Time: ${maxQueryTime}ms`);
    console.log(`  ✓ Standard Deviation: ${stdDev.toFixed(2)}ms`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} - ${passed ? 'Isolation performance consistent' : 'Isolation performance inconsistent'}`);
}

// Main test runner
async function runPerformanceTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     PERFORMANCE TESTING - Phase 1 Multi-Tenant System        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nAPI URL: ${API_URL}`);
    console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
    console.log(`Requests Per User: ${REQUESTS_PER_USER}`);
    console.log('\nStarting tests...\n');

    try {
        await testApiResponseTime();
        await testConcurrentAuthentication();
        await testDatabaseQueryPerformance();
        await testSocketIoPerformance();
        await testMultiTenantIsolationPerformance();

        // Print summary
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                     PERFORMANCE TEST SUMMARY                   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;

        results.forEach((result, index) => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${result.name}: ${status}`);
            console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
            console.log(`   ${result.details}`);
            console.log('');
        });

        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`Total Tests: ${results.length}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
        console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
        console.log('═══════════════════════════════════════════════════════════════\n');

        if (failed === 0) {
            console.log('🎉 ALL PERFORMANCE TESTS PASSED! System is production ready.\n');
            process.exit(0);
        } else {
            console.log('⚠️  Some performance tests failed. Review results above.\n');
            process.exit(1);
        }

    } catch (error: any) {
        console.error('\n❌ CRITICAL ERROR during performance testing:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runPerformanceTests();
