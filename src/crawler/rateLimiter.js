let lastRequestTime = 0;

/**
 * Enforces a minimum rate limit spacing between sequential asynchronous operations.
 * If less than the specified delay (default 300ms) has elapsed since the last 
 * call, this function pauses execution for the remaining duration.
 * 
 * @param {number} [minDelayMs=300] - The minimum allowed gap between requests in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the rate limit duration is satisfied.
 */
export default async function rateLimit(minDelayMs = 300) {
  try {
    const now = Date.now();
    const elapsed = now - lastRequestTime;

    if (elapsed < minDelayMs) {
      const waitTime = minDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  } catch (error) {
    console.error("Rate limiter experienced an unexpected sleep error", error);
  } finally {
    // Record the termination time of this request sequence to anchor the next call
    lastRequestTime = Date.now();
  }
}