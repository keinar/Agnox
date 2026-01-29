/**
 * Password Utilities Test
 *
 * Tests password hashing, comparison, and validation functions
 * Run with: npx tsx src/utils/password.test.ts
 */

import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  meetsMinimumRequirements,
  calculatePasswordStrength,
  getPasswordStrengthLabel,
  containsCommonPatterns,
  generateSecurePassword
} from './password';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('❌ FAILED:', message);
    process.exit(1);
  }
  console.log('✅ PASSED:', message);
}

async function runTests() {
  console.log('\n🧪 Testing Password Utilities...\n');

  // ========================================================================
  // Test 1: Hash Password
  // ========================================================================
  console.log('Test 1: Hash Password');
  const password = 'MySecurePass123!';
  const hash = await hashPassword(password);

  assert(typeof hash === 'string', 'Hash should be a string');
  assert(hash.startsWith('$2b$'), 'Hash should start with $2b$ (bcrypt)');
  assert(hash.length >= 60, 'Hash should be at least 60 characters');
  assert(hash !== password, 'Hash should not equal plain password');
  console.log('  Hash:', hash.substring(0, 30) + '...\n');

  // ========================================================================
  // Test 2: Compare Password (correct)
  // ========================================================================
  console.log('Test 2: Compare Password (correct)');
  const isMatch = await comparePassword(password, hash);
  assert(isMatch === true, 'Should return true for correct password\n');

  // ========================================================================
  // Test 3: Compare Password (incorrect)
  // ========================================================================
  console.log('Test 3: Compare Password (incorrect)');
  const isWrong = await comparePassword('WrongPassword123!', hash);
  assert(isWrong === false, 'Should return false for incorrect password\n');

  // ========================================================================
  // Test 4: Validate Password Strength (valid)
  // ========================================================================
  console.log('Test 4: Validate Password Strength (valid)');
  const validResult = validatePasswordStrength('SecurePass123!');
  assert(validResult.valid === true, 'Should validate strong password');
  assert(validResult.errors.length === 0, 'Should have no errors');
  console.log('  Valid password accepted\n');

  // ========================================================================
  // Test 5: Validate Password Strength (too short)
  // ========================================================================
  console.log('Test 5: Validate Password Strength (too short)');
  const shortResult = validatePasswordStrength('Pass1!');
  assert(shortResult.valid === false, 'Should reject short password');
  assert(shortResult.errors.length > 0, 'Should have errors');
  assert(
    shortResult.errors.some(e => e.includes('8 characters')),
    'Should mention minimum length'
  );
  console.log('  Errors:', shortResult.errors.join(', '), '\n');

  // ========================================================================
  // Test 6: Validate Password Strength (no uppercase)
  // ========================================================================
  console.log('Test 6: Validate Password Strength (no uppercase)');
  const noUpperResult = validatePasswordStrength('securepass123!');
  assert(noUpperResult.valid === false, 'Should reject password without uppercase');
  assert(
    noUpperResult.errors.some(e => e.includes('uppercase')),
    'Should mention uppercase requirement'
  );
  console.log('  Errors:', noUpperResult.errors.join(', '), '\n');

  // ========================================================================
  // Test 7: Validate Password Strength (no lowercase)
  // ========================================================================
  console.log('Test 7: Validate Password Strength (no lowercase)');
  const noLowerResult = validatePasswordStrength('SECUREPASS123!');
  assert(noLowerResult.valid === false, 'Should reject password without lowercase');
  assert(
    noLowerResult.errors.some(e => e.includes('lowercase')),
    'Should mention lowercase requirement'
  );
  console.log('  Errors:', noLowerResult.errors.join(', '), '\n');

  // ========================================================================
  // Test 8: Validate Password Strength (no number)
  // ========================================================================
  console.log('Test 8: Validate Password Strength (no number)');
  const noNumberResult = validatePasswordStrength('SecurePass!');
  assert(noNumberResult.valid === false, 'Should reject password without number');
  assert(
    noNumberResult.errors.some(e => e.includes('number')),
    'Should mention number requirement'
  );
  console.log('  Errors:', noNumberResult.errors.join(', '), '\n');

  // ========================================================================
  // Test 9: Validate Password Strength (no special char)
  // ========================================================================
  console.log('Test 9: Validate Password Strength (no special char)');
  const noSpecialResult = validatePasswordStrength('SecurePass123');
  assert(noSpecialResult.valid === false, 'Should reject password without special char');
  assert(
    noSpecialResult.errors.some(e => e.includes('special character')),
    'Should mention special character requirement'
  );
  console.log('  Errors:', noSpecialResult.errors.join(', '), '\n');

  // ========================================================================
  // Test 10: Meets Minimum Requirements
  // ========================================================================
  console.log('Test 10: Meets Minimum Requirements');
  assert(
    meetsMinimumRequirements('Password123') === true,
    'Should accept password with letters and numbers'
  );
  assert(
    meetsMinimumRequirements('password') === false,
    'Should reject password without numbers'
  );
  assert(
    meetsMinimumRequirements('12345678') === false,
    'Should reject password without letters'
  );
  assert(
    meetsMinimumRequirements('Pass1') === false,
    'Should reject password that is too short'
  );
  console.log('  Minimum requirements validation working\n');

  // ========================================================================
  // Test 11: Calculate Password Strength
  // ========================================================================
  console.log('Test 11: Calculate Password Strength');
  const scores = {
    weak: calculatePasswordStrength('short'),
    fair: calculatePasswordStrength('password123'),
    good: calculatePasswordStrength('Password123'),
    strong: calculatePasswordStrength('Password123!'),
    veryStrong: calculatePasswordStrength('VerySecurePassword123!')
  };

  assert(scores.weak === 0, 'Very weak password should score 0');
  assert(scores.fair >= 1, 'Fair password should score 1+');
  assert(scores.good >= 2, 'Good password should score 2+');
  assert(scores.strong >= 3, 'Strong password should score 3+');
  assert(scores.veryStrong >= 4, 'Very strong password should score 4+');

  console.log('  Scores:', scores, '\n');

  // ========================================================================
  // Test 12: Get Password Strength Label
  // ========================================================================
  console.log('Test 12: Get Password Strength Label');
  const labels = {
    weak: getPasswordStrengthLabel('short'),
    fair: getPasswordStrengthLabel('password123'),
    good: getPasswordStrengthLabel('Password123'),
    strong: getPasswordStrengthLabel('Password123!'),
    veryStrong: getPasswordStrengthLabel('VerySecurePassword123!')
  };

  assert(labels.weak === 'Very Weak', 'Should label weak password correctly');
  assert(labels.veryStrong.includes('Strong'), 'Should label strong password correctly');

  console.log('  Labels:', labels, '\n');

  // ========================================================================
  // Test 13: Contains Common Patterns
  // ========================================================================
  console.log('Test 13: Contains Common Patterns');
  assert(
    containsCommonPatterns('password123abc') === true,
    'Should detect "abc" pattern'
  );
  assert(
    containsCommonPatterns('password123456') === true,
    'Should detect "123456" pattern'
  );
  assert(
    containsCommonPatterns('qwerty123') === true,
    'Should detect "qwerty" pattern'
  );
  assert(
    containsCommonPatterns('passwordaaa') === true,
    'Should detect repeated characters'
  );
  assert(
    containsCommonPatterns('SecureP@ssw0rd!') === false,
    'Should not detect patterns in secure password'
  );
  console.log('  Pattern detection working\n');

  // ========================================================================
  // Test 14: Generate Secure Password
  // ========================================================================
  console.log('Test 14: Generate Secure Password');
  const generated = generateSecurePassword();
  const generatedValidation = validatePasswordStrength(generated);

  assert(generated.length === 16, 'Default generated password should be 16 chars');
  assert(generatedValidation.valid === true, 'Generated password should be valid');
  assert(/[a-z]/.test(generated), 'Should contain lowercase');
  assert(/[A-Z]/.test(generated), 'Should contain uppercase');
  assert(/[0-9]/.test(generated), 'Should contain number');
  assert(/[!@#$%^&*(),.?]/.test(generated), 'Should contain special char');

  console.log('  Generated password:', generated);
  console.log('  Strength:', getPasswordStrengthLabel(generated), '\n');

  // ========================================================================
  // Test 15: Generate Custom Length Password
  // ========================================================================
  console.log('Test 15: Generate Custom Length Password');
  const customGenerated = generateSecurePassword(24);
  assert(customGenerated.length === 24, 'Custom length should be respected');
  console.log('  Generated 24-char password:', customGenerated, '\n');

  // ========================================================================
  // Test 16: Hash Different Passwords
  // ========================================================================
  console.log('Test 16: Hash Different Passwords (salting)');
  const hash1 = await hashPassword('SamePassword123!');
  const hash2 = await hashPassword('SamePassword123!');

  assert(hash1 !== hash2, 'Same password should produce different hashes (salted)');
  assert(
    await comparePassword('SamePassword123!', hash1) === true,
    'Should verify against first hash'
  );
  assert(
    await comparePassword('SamePassword123!', hash2) === true,
    'Should verify against second hash'
  );
  console.log('  Hash 1:', hash1.substring(0, 30) + '...');
  console.log('  Hash 2:', hash2.substring(0, 30) + '...');
  console.log('  Hashes are different (salt working)\n');

  // ========================================================================
  // Test 17: Empty Password Handling
  // ========================================================================
  console.log('Test 17: Empty Password Handling');
  try {
    await hashPassword('');
    assert(false, 'Should throw error for empty password');
  } catch (error: any) {
    assert(error.message.includes('empty'), 'Should mention empty password');
  }

  const emptyCompare = await comparePassword('', hash);
  assert(emptyCompare === false, 'Should return false for empty password comparison');

  const emptyValidation = validatePasswordStrength('');
  assert(emptyValidation.valid === false, 'Should reject empty password');
  console.log('  Empty password handling working\n');

  // ========================================================================
  // Test 18: Very Long Password
  // ========================================================================
  console.log('Test 18: Very Long Password');
  const longPassword = 'A'.repeat(200);
  try {
    await hashPassword(longPassword);
    assert(false, 'Should throw error for password exceeding max length');
  } catch (error: any) {
    assert(error.message.includes('128'), 'Should mention max length');
  }
  console.log('  Max length validation working\n');

  console.log('✅ All 18 test groups passed!\n');
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
