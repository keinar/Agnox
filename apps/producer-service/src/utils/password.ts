/**
 * Password Utilities
 *
 * Handles secure password hashing, comparison, and validation
 * using bcrypt for the multi-tenant authentication system.
 */

import bcrypt from 'bcrypt';

// Configuration from environment
const SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10);

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Password validation result
 */
export interface IPasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Hash a plain text password using bcrypt
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string (bcrypt hash)
 *
 * @example
 * const hashed = await hashPassword('MySecurePass123!');
 * // Returns: "$2b$10$..."
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password cannot exceed ${PASSWORD_MAX_LENGTH} characters`);
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Failed to hash password:', error);
    throw new Error('Password hashing failed');
  }
}

/**
 * Compare a plain text password with a hashed password
 *
 * @param password - Plain text password to verify
 * @param hashedPassword - Bcrypt hashed password from database
 * @returns true if passwords match, false otherwise
 *
 * @example
 * const isValid = await comparePassword('MySecurePass123!', user.hashedPassword);
 * if (isValid) {
 *   console.log('Password correct');
 * }
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || !hashedPassword) {
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('Failed to compare password:', error);
    return false;
  }
}

/**
 * Validate password strength according to security requirements
 *
 * Requirements:
 * - At least 8 characters long
 * - At most 128 characters
 * - Contains at least one uppercase letter (A-Z)
 * - Contains at least one lowercase letter (a-z)
 * - Contains at least one number (0-9)
 * - Contains at least one special character (!@#$%^&*(),.?":{}|<>)
 *
 * @param password - Password to validate
 * @returns Validation result with errors if invalid
 *
 * @example
 * const result = validatePasswordStrength('weak');
 * if (!result.valid) {
 *   console.log('Errors:', result.errors);
 * }
 */
export function validatePasswordStrength(password: string): IPasswordValidation {
  const errors: string[] = [];

  // Check if password exists
  if (!password) {
    return {
      valid: false,
      errors: ['Password is required']
    };
  }

  // Check minimum length
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  // Check maximum length
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password cannot exceed ${PASSWORD_MAX_LENGTH} characters`);
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  // Check for special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a password meets minimum security requirements
 * (less strict than validatePasswordStrength)
 *
 * Requirements:
 * - At least 8 characters
 * - Contains at least one letter
 * - Contains at least one number
 *
 * @param password - Password to check
 * @returns true if meets minimum requirements
 */
export function meetsMinimumRequirements(password: string): boolean {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return false;
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return hasLetter && hasNumber;
}

/**
 * Calculate password strength score (0-5)
 *
 * @param password - Password to evaluate
 * @returns Strength score:
 *   0 - Very weak (< 8 chars)
 *   1 - Weak (8+ chars, letters only)
 *   2 - Fair (8+ chars, letters + numbers)
 *   3 - Good (8+ chars, letters + numbers + uppercase)
 *   4 - Strong (8+ chars, all requirements met)
 *   5 - Very strong (12+ chars, all requirements met)
 */
export function calculatePasswordStrength(password: string): number {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return 0;
  }

  let score = 1;

  // Has numbers
  if (/[0-9]/.test(password)) {
    score++;
  }

  // Has uppercase
  if (/[A-Z]/.test(password)) {
    score++;
  }

  // Has special characters
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++;
  }

  // Extra length bonus (12+ chars)
  if (password.length >= 12) {
    score++;
  }

  return Math.min(score, 5);
}

/**
 * Get password strength label
 *
 * @param password - Password to evaluate
 * @returns Strength label
 */
export function getPasswordStrengthLabel(password: string): string {
  const score = calculatePasswordStrength(password);

  const labels = [
    'Very Weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
    'Very Strong'
  ];

  return labels[score];
}

/**
 * Check if a password contains common patterns
 * (sequential characters, repeated characters, etc.)
 *
 * @param password - Password to check
 * @returns true if contains common patterns (weak)
 */
export function containsCommonPatterns(password: string): boolean {
  if (!password) {
    return false;
  }

  const lowerPassword = password.toLowerCase();

  // Check for sequential characters (abc, 123, etc.)
  const sequences = ['abc', '123', '456', '789', 'qwerty', 'asdf', 'zxcv'];
  for (const seq of sequences) {
    if (lowerPassword.includes(seq)) {
      return true;
    }
  }

  // Check for repeated characters (aaa, 111, etc.)
  if (/(.)\1{2,}/.test(password)) {
    return true;
  }

  return false;
}

/**
 * Generate a random password that meets all requirements
 *
 * @param length - Desired password length (default: 16)
 * @returns Random secure password
 *
 * @example
 * const password = generateSecurePassword();
 * console.log('Temporary password:', password);
 */
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*(),.?';

  const allChars = lowercase + uppercase + numbers + special;

  // Ensure at least one of each type
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Log configuration on module load
console.log('🔒 Password Configuration:');
console.log(`  - Salt Rounds: ${SALT_ROUNDS}`);
console.log(`  - Min Length: ${PASSWORD_MIN_LENGTH} chars`);
console.log(`  - Max Length: ${PASSWORD_MAX_LENGTH} chars`);
console.log(`  - Requirements: Uppercase, lowercase, number, special char`);

// Warn if using low salt rounds
if (SALT_ROUNDS < 10) {
  console.warn(`⚠️  WARNING: Salt rounds (${SALT_ROUNDS}) is lower than recommended (10+)`);
}
