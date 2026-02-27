import type { Logger } from "./logger";

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  logger?: Logger;
}

function isTransientError(status: number): boolean {
  if (status === 429) return true; // Rate limit
  if (status >= 500) return true;  // Server error
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("fetch")) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return false;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 1000, timeoutMs = 15000, logger } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (res.ok || !isTransientError(res.status)) {
        return res;
      }

      // Transient error — retry if attempts remain
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        logger?.warn(`Retrying fetch (attempt ${attempt + 1}/${maxRetries})`, {
          url,
          status: res.status,
          delayMs: delay,
        });
        await new Promise((r) => setTimeout(r, delay));
      } else {
        return res; // Return last failed response
      }
    } catch (error) {
      if (attempt < maxRetries && isNetworkError(error)) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        logger?.warn(`Retrying fetch after network error (attempt ${attempt + 1}/${maxRetries})`, {
          url,
          error: error instanceof Error ? error.message : String(error),
          delayMs: delay,
        });
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  // Should never reach here, but TypeScript requires it
  throw new Error(`fetchWithRetry: exhausted ${maxRetries} retries for ${url}`);
}
