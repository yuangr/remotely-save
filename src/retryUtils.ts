/**
 * Unified retry utility with exponential backoff and jitter.
 * Provides a generic retry mechanism for HTTP requests across all cloud adapters.
 */

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 4) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in ms between retries (default: 16000) */
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /** Optional hint for log messages */
  extraHint?: string;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 4,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  retryableStatuses: [429, 500, 502, 503, 504],
  extraHint: "",
};

/**
 * Returns a random number between min and max (inclusive).
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts HTTP status code from various error shapes.
 * Supports Dropbox, fetch, and generic error objects.
 */
function getErrorStatus(err: unknown): number | undefined {
  if (err === null || err === undefined) return undefined;
  const e = err as any;
  // Dropbox-style errors
  if (typeof e.status === "number") return e.status;
  // fetch Response-like
  if (typeof e.statusCode === "number") return e.statusCode;
  // Nested error objects
  if (e.response && typeof e.response.status === "number")
    return e.response.status;
  return undefined;
}

/**
 * Extracts retry-after header value in seconds from various error shapes.
 */
function getRetryAfterSeconds(err: unknown): number | undefined {
  if (err === null || err === undefined) return undefined;
  const e = err as any;

  // Check headers directly
  if (e.headers) {
    const headers =
      typeof e.headers.get === "function"
        ? { "retry-after": e.headers.get("retry-after") }
        : e.headers;
    const retryAfter = headers["retry-after"] || headers["Retry-After"];
    if (retryAfter) {
      const parsed = Number.parseInt(retryAfter, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  // Dropbox-style nested error
  if (e.error?.error?.retry_after) {
    return e.error.error.retry_after;
  }

  return undefined;
}

/**
 * Retries an async operation with exponential backoff and jitter.
 *
 * @param fn - The async function to retry
 * @param config - Optional retry configuration
 * @returns The result of the successful function call
 * @throws The last error if all retries are exhausted, or immediately for non-retryable errors
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, extraHint: 'fetching data' }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  const prefix = cfg.extraHint ? `${cfg.extraHint}: ` : "";

  let lastError: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.warn(
          `${prefix}Retry attempt ${attempt}/${cfg.maxRetries} at ${Date.now()}`
        );
      }
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = getErrorStatus(err);

      // If we can't determine status, or it's not retryable, throw immediately
      if (status === undefined || !cfg.retryableStatuses.includes(status)) {
        throw err;
      }

      // If this was the last attempt, throw
      if (attempt >= cfg.maxRetries) {
        throw new Error(
          `${prefix}Failed after ${cfg.maxRetries} retries. Last error status: ${status}`
        );
      }

      // Calculate delay with exponential backoff + jitter
      const retryAfterSec = getRetryAfterSeconds(err);
      const exponentialDelay = cfg.baseDelayMs * 2 ** attempt;
      const baseDelay = retryAfterSec
        ? Math.max(retryAfterSec * 1000, exponentialDelay)
        : exponentialDelay;
      const cappedDelay = Math.min(baseDelay, cfg.maxDelayMs);
      const jitteredDelay = randomBetween(
        Math.floor(cappedDelay * 0.8),
        Math.floor(cappedDelay * 1.2)
      );

      console.warn(
        `${prefix}Retryable error (status=${status}) on attempt ${
          attempt + 1
        }. Waiting ${jitteredDelay}ms before retry.`
      );

      await delay(jitteredDelay);
    }
  }

  // Should not reach here, but just in case
  throw lastError;
}
