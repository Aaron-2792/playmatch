const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/**
 * Retries an asynchronous operation after exponentially increasing delays.
 *
 * @param {() => Promise<unknown>} operation API operation to retry.
 * @param {number} [maxAttempts=3] Total attempts, including the first.
 * @param {number} [baseDelayMs=500] First retry delay in milliseconds.
 * @returns {Promise<unknown>} The operation result.
 */
async function withExponentialBackoff(operation, maxAttempts = 3, baseDelayMs = 500) {
  if (typeof operation !== 'function') {
    throw new TypeError('operation must be a function.');
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive integer.');
  }

  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new TypeError('baseDelayMs must be a non-negative number.');
  }

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts - 1) {
        break;
      }

      await delay(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}

module.exports = { withExponentialBackoff };
