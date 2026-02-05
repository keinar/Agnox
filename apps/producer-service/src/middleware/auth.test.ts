/**
 * Authentication Middleware Test
 *
 * Tests authentication and authorization middleware
 * Run with: npx tsx src/middleware/auth.test.ts
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  authMiddleware,
  requireRole,
  adminOnly,
  developerOrAdmin,
  optionalAuth,
  IUserContext
} from './auth';
import { signToken } from '../utils/jwt';

// Mock FastifyRequest
class MockRequest {
  headers: Record<string, string> = {};
  user?: IUserContext;
  ip: string = '127.0.0.1';

  constructor(authHeader?: string) {
    if (authHeader) {
      this.headers.authorization = authHeader;
    }
  }
}

// Mock FastifyReply
class MockReply {
  statusCode: number = 200;
  responseBody: any = null;
  headers: Record<string, string> = {};

  code(status: number) {
    this.statusCode = status;
    return this;
  }

  send(body: any) {
    this.responseBody = body;
    return this;
  }

  header(key: string, value: string) {
    this.headers[key] = value;
    return this;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('❌ FAILED:', message);
    process.exit(1);
  }
  console.log('✅ PASSED:', message);
}

async function runTests() {
  console.log('\n🧪 Testing Authentication Middleware...\n');

  // ========================================================================
  // Test 1: authMiddleware - No token provided
  // ========================================================================
  console.log('Test 1: authMiddleware - No token provided');
  const req1 = new MockRequest() as unknown as FastifyRequest;
  const reply1 = new MockReply() as unknown as FastifyReply;

  await authMiddleware(req1, reply1);

  assert(
    (reply1 as any).statusCode === 401,
    'Should return 401 for missing token'
  );
  assert(
    (reply1 as any).responseBody.error === 'Authentication required',
    'Should return authentication required error'
  );
  console.log('  Response:', (reply1 as any).responseBody, '\n');

  // ========================================================================
  // Test 2: authMiddleware - Invalid token
  // ========================================================================
  console.log('Test 2: authMiddleware - Invalid token');
  const req2 = new MockRequest('Bearer invalid.token.here') as unknown as FastifyRequest;
  const reply2 = new MockReply() as unknown as FastifyReply;

  await authMiddleware(req2, reply2);

  assert(
    (reply2 as any).statusCode === 401,
    'Should return 401 for invalid token'
  );
  assert(
    (reply2 as any).responseBody.error === 'Invalid token',
    'Should return invalid token error'
  );
  console.log('  Response:', (reply2 as any).responseBody, '\n');

  // ========================================================================
  // Test 3: authMiddleware - Valid token (admin)
  // ========================================================================
  console.log('Test 3: authMiddleware - Valid token (admin)');
  const adminToken = signToken({
    userId: 'user123',
    email: 'admin@example.com',
    organizationId: 'org456',
    role: 'admin'
  });

  const req3 = new MockRequest(`Bearer ${adminToken}`) as unknown as FastifyRequest;
  const reply3 = new MockReply() as unknown as FastifyReply;

  await authMiddleware(req3, reply3);

  assert(
    (reply3 as any).statusCode === 200,
    'Should return 200 for valid token'
  );
  assert(
    req3.user !== undefined,
    'Should inject user context'
  );
  assert(
    req3.user!.userId === 'user123',
    'Should have correct userId'
  );
  assert(
    req3.user!.organizationId === 'org456',
    'Should have correct organizationId'
  );
  assert(
    req3.user!.role === 'admin',
    'Should have correct role'
  );
  console.log('  User context:', req3.user, '\n');

  // ========================================================================
  // Test 4: requireRole - Admin accessing admin-only route
  // ========================================================================
  console.log('Test 4: requireRole - Admin accessing admin-only route');
  const req4 = new MockRequest() as unknown as FastifyRequest;
  req4.user = {
    userId: 'user123',
    email: 'admin@example.com',
    organizationId: 'org456',
    role: 'admin'
  };
  const reply4 = new MockReply() as unknown as FastifyReply;

  const adminOnlyMiddleware = requireRole('admin');
  await adminOnlyMiddleware(req4, reply4);

  assert(
    (reply4 as any).statusCode === 200,
    'Admin should access admin-only route'
  );
  console.log('  Access granted\n');

  // ========================================================================
  // Test 5: requireRole - Developer accessing admin-only route
  // ========================================================================
  console.log('Test 5: requireRole - Developer accessing admin-only route');
  const req5 = new MockRequest() as unknown as FastifyRequest;
  req5.user = {
    userId: 'user456',
    email: 'dev@example.com',
    organizationId: 'org456',
    role: 'developer'
  };
  const reply5 = new MockReply() as unknown as FastifyReply;

  await adminOnlyMiddleware(req5, reply5);

  assert(
    (reply5 as any).statusCode === 403,
    'Developer should not access admin-only route'
  );
  assert(
    (reply5 as any).responseBody.error === 'Insufficient permissions',
    'Should return insufficient permissions error'
  );
  console.log('  Response:', (reply5 as any).responseBody, '\n');

  // ========================================================================
  // Test 6: requireRole - Developer accessing developer route
  // ========================================================================
  console.log('Test 6: requireRole - Developer accessing developer route');
  const req6 = new MockRequest() as unknown as FastifyRequest;
  req6.user = {
    userId: 'user456',
    email: 'dev@example.com',
    organizationId: 'org456',
    role: 'developer'
  };
  const reply6 = new MockReply() as unknown as FastifyReply;

  const devOrAdminMiddleware = developerOrAdmin;
  await devOrAdminMiddleware(req6, reply6);

  assert(
    (reply6 as any).statusCode === 200,
    'Developer should access developer-or-admin route'
  );
  console.log('  Access granted\n');

  // ========================================================================
  // Test 7: requireRole - Viewer accessing developer route
  // ========================================================================
  console.log('Test 7: requireRole - Viewer accessing developer route');
  const req7 = new MockRequest() as unknown as FastifyRequest;
  req7.user = {
    userId: 'user789',
    email: 'viewer@example.com',
    organizationId: 'org456',
    role: 'viewer'
  };
  const reply7 = new MockReply() as unknown as FastifyReply;

  await devOrAdminMiddleware(req7, reply7);

  assert(
    (reply7 as any).statusCode === 403,
    'Viewer should not access developer route'
  );
  console.log('  Access denied\n');

  // ========================================================================
  // Test 8: requireRole - Multiple allowed roles
  // ========================================================================
  console.log('Test 8: requireRole - Multiple allowed roles');
  const multiRoleMiddleware = requireRole('admin', 'developer', 'viewer');

  const req8a = new MockRequest() as unknown as FastifyRequest;
  req8a.user = { userId: 'u1', email: 'u1@example.com', organizationId: 'o1', role: 'admin' };
  const reply8a = new MockReply() as unknown as FastifyReply;
  await multiRoleMiddleware(req8a, reply8a);
  assert((reply8a as any).statusCode === 200, 'Admin should be allowed');

  const req8b = new MockRequest() as unknown as FastifyRequest;
  req8b.user = { userId: 'u2', email: 'u2@example.com', organizationId: 'o1', role: 'developer' };
  const reply8b = new MockReply() as unknown as FastifyReply;
  await multiRoleMiddleware(req8b, reply8b);
  assert((reply8b as any).statusCode === 200, 'Developer should be allowed');

  const req8c = new MockRequest() as unknown as FastifyRequest;
  req8c.user = { userId: 'u3', email: 'u3@example.com', organizationId: 'o1', role: 'viewer' };
  const reply8c = new MockReply() as unknown as FastifyReply;
  await multiRoleMiddleware(req8c, reply8c);
  assert((reply8c as any).statusCode === 200, 'Viewer should be allowed');

  console.log('  All roles allowed\n');

  // ========================================================================
  // Test 9: optionalAuth - With valid token
  // ========================================================================
  console.log('Test 9: optionalAuth - With valid token');
  const token9 = signToken({
    userId: 'user999',
    organizationId: 'org999',
    role: 'developer',
    email: 'test@example.com'
  });

  const req9 = new MockRequest(`Bearer ${token9}`) as unknown as FastifyRequest;
  const reply9 = new MockReply() as unknown as FastifyReply;

  await optionalAuth(req9, reply9);

  assert(
    (reply9 as any).statusCode === 200,
    'Should succeed even with token'
  );
  assert(
    req9.user !== undefined,
    'Should inject user context when token is valid'
  );
  assert(
    req9.user!.userId === 'user999',
    'Should have correct userId'
  );
  console.log('  User context:', req9.user, '\n');

  // ========================================================================
  // Test 10: optionalAuth - Without token
  // ========================================================================
  console.log('Test 10: optionalAuth - Without token');
  const req10 = new MockRequest() as unknown as FastifyRequest;
  const reply10 = new MockReply() as unknown as FastifyReply;

  await optionalAuth(req10, reply10);

  assert(
    (reply10 as any).statusCode === 200,
    'Should succeed without token'
  );
  assert(
    req10.user === undefined,
    'Should not inject user context when no token'
  );
  console.log('  No user context (anonymous request)\n');

  // ========================================================================
  // Test 11: optionalAuth - With invalid token
  // ========================================================================
  console.log('Test 11: optionalAuth - With invalid token');
  const req11 = new MockRequest('Bearer invalid.token') as unknown as FastifyRequest;
  const reply11 = new MockReply() as unknown as FastifyReply;

  await optionalAuth(req11, reply11);

  assert(
    (reply11 as any).statusCode === 200,
    'Should succeed even with invalid token'
  );
  assert(
    req11.user === undefined,
    'Should not inject user context when token is invalid'
  );
  console.log('  Invalid token ignored (anonymous request)\n');

  // ========================================================================
  // Test 12: Different roles have different permissions
  // ========================================================================
  console.log('Test 12: Different roles have different permissions');

  const testCases = [
    { role: 'admin', canAccessAdmin: true, canAccessDev: true },
    { role: 'developer', canAccessAdmin: false, canAccessDev: true },
    { role: 'viewer', canAccessAdmin: false, canAccessDev: false }
  ];

  for (const testCase of testCases) {
    const reqAdmin = new MockRequest() as unknown as FastifyRequest;
    reqAdmin.user = {
      userId: 'test',
      email: 'test@example.com',
      organizationId: 'test',
      role: testCase.role as any
    };
    const replyAdmin = new MockReply() as unknown as FastifyReply;
    await adminOnly(reqAdmin, replyAdmin);

    const adminAccess = (replyAdmin as any).statusCode === 200;
    assert(
      adminAccess === testCase.canAccessAdmin,
      `${testCase.role} admin access: expected ${testCase.canAccessAdmin}, got ${adminAccess}`
    );

    const reqDev = new MockRequest() as unknown as FastifyRequest;
    reqDev.user = {
      userId: 'test',
      email: 'test@example.com',
      organizationId: 'test',
      role: testCase.role as any
    };
    const replyDev = new MockReply() as unknown as FastifyReply;
    await developerOrAdmin(reqDev, replyDev);

    const devAccess = (replyDev as any).statusCode === 200;
    assert(
      devAccess === testCase.canAccessDev,
      `${testCase.role} developer access: expected ${testCase.canAccessDev}, got ${devAccess}`
    );
  }

  console.log('  Role permissions verified\n');

  // ========================================================================
  // Test 13: Token with different organizations
  // ========================================================================
  console.log('Test 13: Token with different organizations');
  const org1Token = signToken({
    userId: 'user1',
    email: 'user1@org1.com',
    organizationId: 'org1',
    role: 'admin'
  });

  const org2Token = signToken({
    userId: 'user2',
    email: 'user2@org2.com',
    organizationId: 'org2',
    role: 'admin'
  });

  const req13a = new MockRequest(`Bearer ${org1Token}`) as unknown as FastifyRequest;
  const reply13a = new MockReply() as unknown as FastifyReply;
  await authMiddleware(req13a, reply13a);

  const req13b = new MockRequest(`Bearer ${org2Token}`) as unknown as FastifyRequest;
  const reply13b = new MockReply() as unknown as FastifyReply;
  await authMiddleware(req13b, reply13b);

  assert(
    req13a.user!.organizationId === 'org1',
    'Token 1 should have org1'
  );
  assert(
    req13b.user!.organizationId === 'org2',
    'Token 2 should have org2'
  );
  assert(
    req13a.user!.organizationId !== req13b.user!.organizationId,
    'Different organizations should be isolated'
  );

  console.log('  Org 1:', req13a.user!.organizationId);
  console.log('  Org 2:', req13b.user!.organizationId);
  console.log('  Organizations isolated\n');

  console.log('✅ All 13 test groups passed!\n');
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
