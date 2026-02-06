/**
 * Email Retry Utility
 *
 * Provides retry logic with exponential backoff for handling
 * transient email sending failures (network issues, rate limits, etc.)
 *
 * Features:
 * - Exponential backoff (1s, 2s, 4s, 8s...)
 * - Configurable max retries
 * - Skip retry on client errors (4xx)
 * - Detailed error logging
 */

// ===================================================================
// Configuration
// ===================================================================

const DEFAULT_MAX_RETRIES = parseInt(process.env.EMAIL_RETRY_MAX_ATTEMPTS || '3', 10);
const DEFAULT_INITIAL_DELAY = parseInt(process.env.EMAIL_RETRY_INITIAL_DELAY || '1000', 10);

// ===================================================================
// Types
// ===================================================================

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

// ===================================================================
// Retry Logic
// ===================================================================

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result with success status and metadata
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => sendEmail(params),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 *
 * if (result.success) {
 *   console.log('Email sent:', result.result);
 * } else {
 *   console.error('Failed after retries:', result.error);
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelay = DEFAULT_INITIAL_DELAY,
    onRetry
  } = options;

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;

    try {
      const result = await fn();

      return {
        success: true,
        result,
        attempts
      };

    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const shouldRetry = isRetryableError(error);

      if (!shouldRetry) {
        console.error(`❌ Non-retryable error (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        return {
          success: false,
          error: lastError,
          attempts
        };
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        console.error(`❌ Max retries reached (${maxRetries + 1} attempts):`, error.message);
        break;
      }

      // Calculate exponential backoff delay
      const delay = calculateBackoff(attempt, initialDelay);

      console.warn(
        `⏳ Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})...`
      );
      console.warn(`   Error: ${error.message}`);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts
  };
}

/**
 * Determine if an error is retryable
 *
 * Retryable errors:
 * - Network errors (ECONNRESET, ETIMEDOUT, etc.)
 * - 5xx server errors (SendGrid temporary issues)
 * - 429 Too Many Requests (rate limiting)
 *
 * Non-retryable errors:
 * - 4xx client errors (invalid API key, bad request, etc.)
 * - Authentication errors
 * - Validation errors
 *
 * @param error - Error object
 * @returns True if error should be retried
 */
function isRetryableError(error: any): boolean {
  // Network errors (common codes)
  const networkErrors = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'ENOTFOUND',
    'EAI_AGAIN'
  ];

  if (error.code && networkErrors.includes(error.code)) {
    return true;
  }

  // SendGrid API errors
  if (error.response?.statusCode) {
    const statusCode = error.response.statusCode;

    // 5xx: Server errors (retry)
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }

    // 429: Too Many Requests (rate limiting, retry)
    if (statusCode === 429) {
      return true;
    }

    // 408: Request Timeout (retry)
    if (statusCode === 408) {
      return true;
    }

    // 4xx: Client errors (do not retry)
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
  }

  // Default: retry on unknown errors (conservative approach)
  return true;
}

/**
 * Calculate exponential backoff delay
 *
 * Formula: initialDelay * (2 ^ attempt)
 * - Attempt 0: 1s * 2^0 = 1s
 * - Attempt 1: 1s * 2^1 = 2s
 * - Attempt 2: 1s * 2^2 = 4s
 * - Attempt 3: 1s * 2^3 = 8s
 *
 * Max delay capped at 30 seconds
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelay - Base delay in milliseconds
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, initialDelay: number): number {
  const MAX_DELAY = 30000; // 30 seconds
  const delay = initialDelay * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY);
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================================================================
// Specialized Email Retry Functions
// ===================================================================

/**
 * Send email with automatic retry on failure
 *
 * Convenience wrapper for common email sending use case.
 *
 * @param sendFn - Email sending function
 * @param emailType - Type of email (for logging)
 * @param recipient - Recipient email (for logging)
 * @returns Email send result with retry metadata
 *
 * @example
 * ```typescript
 * import { sendEmailWithRetry } from './emailRetry';
 * import { sendInvitationEmail } from './email';
 *
 * const result = await sendEmailWithRetry(
 *   () => sendInvitationEmail(params),
 *   'invitation',
 *   params.recipientEmail
 * );
 *
 * if (!result.success) {
 *   console.error('Failed to send invitation email after retries');
 * }
 * ```
 */
export async function sendEmailWithRetry<T>(
  sendFn: () => Promise<T>,
  emailType: string,
  recipient: string
): Promise<RetryResult<T>> {
  console.log(`📧 Sending ${emailType} email to ${recipient}...`);

  const result = await retryWithBackoff(
    sendFn,
    {
      maxRetries: DEFAULT_MAX_RETRIES,
      initialDelay: DEFAULT_INITIAL_DELAY,
      onRetry: (attempt, error) => {
        console.warn(`   Retry ${attempt} for ${emailType} email to ${recipient}`);
      }
    }
  );

  if (result.success) {
    console.log(`✅ ${emailType} email sent to ${recipient} (${result.attempts} attempt${result.attempts > 1 ? 's' : ''})`);
  } else {
    console.error(`❌ Failed to send ${emailType} email to ${recipient} after ${result.attempts} attempts`);
    console.error(`   Error: ${result.error?.message}`);
  }

  return result;
}

// ===================================================================
// Logging
// ===================================================================

console.log('🔄 Email Retry Utility Loaded');
console.log(`   Max Retries: ${DEFAULT_MAX_RETRIES}`);
console.log(`   Initial Delay: ${DEFAULT_INITIAL_DELAY}ms`);
console.log(`   Backoff Strategy: Exponential (1s, 2s, 4s, 8s...)`);
