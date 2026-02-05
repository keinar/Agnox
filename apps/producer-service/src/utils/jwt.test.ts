/**
 * JWT Utilities Test
 *
 * Simple test to verify JWT functions work correctly
 * Run with: npx tsx src/utils/jwt.test.ts
 */

import { signToken, verifyToken, extractTokenFromHeader, isTokenExpired, getTokenExpirationTime } from './jwt';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('❌ FAILED:', message);
    process.exit(1);
  }
  console.log('✅ PASSED:', message);
}

console.log('\n🧪 Testing JWT Utilities...\n');

// Test 1: Sign Token
console.log('Test 1: Sign Token');
const token = signToken({
  userId: '507f1f77bcf86cd799439011',
  email: 'admin@example.com',
  organizationId: '507f191e810c19729de860ea',
  role: 'admin'
});
assert(typeof token === 'string' && token.length > 0, 'Token should be a non-empty string');
assert(token.split('.').length === 3, 'Token should have 3 parts (header.payload.signature)');
console.log('  Token:', token.substring(0, 50) + '...\n');

// Test 2: Verify Valid Token
console.log('Test 2: Verify Valid Token');
const payload = verifyToken(token);
assert(payload !== null, 'Should verify valid token');
assert(payload!.userId === '507f1f77bcf86cd799439011', 'userId should match');
assert(payload!.organizationId === '507f191e810c19729de860ea', 'organizationId should match');
assert(payload!.role === 'admin', 'role should match');
assert(typeof payload!.iat === 'number', 'Should have iat (issued at)');
assert(typeof payload!.exp === 'number', 'Should have exp (expiration)');
console.log('  Payload:', payload, '\n');

// Test 3: Verify Invalid Token
console.log('Test 3: Verify Invalid Token');
const invalidPayload = verifyToken('invalid.token.here');
assert(invalidPayload === null, 'Should return null for invalid token\n');

// Test 4: Extract Token from Header
console.log('Test 4: Extract Token from Header');
const extractedToken = extractTokenFromHeader(`Bearer ${token}`);
assert(extractedToken === token, 'Should extract token from Bearer header');
console.log('  Extracted:', extractedToken?.substring(0, 30) + '...\n');

// Test 5: Extract from Invalid Headers
console.log('Test 5: Extract from Invalid Headers');
assert(extractTokenFromHeader(undefined) === null, 'Should return null for undefined header');
assert(extractTokenFromHeader('') === null, 'Should return null for empty header');
assert(extractTokenFromHeader('InvalidScheme token') === null, 'Should return null for non-Bearer scheme');
assert(extractTokenFromHeader('Bearer ') === null, 'Should return null for empty token\n');

// Test 6: Token Expiration Check
console.log('Test 6: Token Expiration Check');
const expiresIn = getTokenExpirationTime(token);
assert(expiresIn !== null && expiresIn > 0, 'Token should not be expired');
assert(!isTokenExpired(token), 'isTokenExpired should return false');
console.log('  Expires in:', expiresIn, 'seconds\n');

// Test 7: Sign Token with Missing Fields
console.log('Test 7: Sign Token with Missing Fields');
try {
  signToken({ userId: '', organizationId: '', role: '' } as any);
  assert(false, 'Should throw error for missing fields');
} catch (error) {
  assert(true, 'Should throw error for empty payload fields\n');
}

// Test 8: Multiple Tokens
console.log('Test 8: Multiple Tokens (different users)');
const token1 = signToken({
  userId: 'user1',
  email: 'user1@example.com',
  organizationId: 'org1',
  role: 'admin'
});
const token2 = signToken({
  userId: 'user2',
  email: 'user2@example.com',
  organizationId: 'org2',
  role: 'developer'
});
assert(token1 !== token2, 'Different tokens for different users');

const payload1 = verifyToken(token1);
const payload2 = verifyToken(token2);
assert(payload1!.userId === 'user1', 'Token 1 has correct userId');
assert(payload2!.userId === 'user2', 'Token 2 has correct userId');
assert(payload1!.organizationId === 'org1', 'Token 1 has correct organizationId');
assert(payload2!.organizationId === 'org2', 'Token 2 has correct organizationId');
console.log('  Token 1 user:', payload1!.userId, '/', payload1!.organizationId);
console.log('  Token 2 user:', payload2!.userId, '/', payload2!.organizationId, '\n');

console.log('✅ All tests passed!\n');
