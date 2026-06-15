import fetchProxy from "../utils/fetchProxy.js";
import crawlConfig from "../config/crawlConfig.js";
import rateLimit from "./rateLimiter.js";

const cache = new Map();
const telemetry = {
  totalRequests: 0,
  successes: 0,
  failures: 0,
  durations: [],
  slowUrls: [],
};

/**
 * Detect collection/inventory pages by URL patterns (common dealership/ecommerce patterns)
 */
function isCollectionLikeUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  return /\/(search|inventory|browse|shop|catalog|category|collection|products?|categories?|filter|results|listing)\b/i.test(pathname) ||
         /\b(inventory|stock|models|brands|categories)\b/i.test(pathname);
}

/**
 * Fetches multiple URLs concurrently with rate limiting and deduplication.
 */
export default async function fetchPool(urls, options = {}) {
  const {
    concurrency = crawlConfig.concurrency,
    onProgress = null,
    skipUrls = new Set(),
  } = options;

  const safeUrls = Array.isArray(urls) ? urls : [];
  const uniqueUrls = [...new Set(safeUrls)].filter((u) => u && !skipUrls.has(u));
  const results = [];
  let completed = 0;

  async function fetchOne(url) {
    if (cache.has(url)) {
      completed++;
      if (onProgress) onProgress(completed, uniqueUrls.length, url);
      return cache.get(url);
    }

    await rateLimit(crawlConfig.rateLimitMs);
    const start = performance.now();
    telemetry.totalRequests++;
    
    // Use longer timeout for collection/inventory pages
    const timeout = isCollectionLikeUrl(url) 
      ? (crawlConfig.collectionTimeoutMs || 25000)
      : crawlConfig.fetchTimeout;
    
    const res = await fetchProxy(url, {
      retries: crawlConfig.fetchRetries,
      timeout,
    });
    const dur = Math.round(performance.now() - start);
    telemetry.durations.push(dur);
    if (!res.ok) {
      telemetry.failures++;
      telemetry.slowUrls.push({ url, status: res.status, duration: dur, error: res.error });
    } else {
      telemetry.successes++;
      if (dur > (crawlConfig.slowThresholdMs || 2000)) {
        telemetry.slowUrls.push({ url, status: res.status, duration: dur });
      }
    }

    const entry = {
      url,
      html: res.html || "",
      duration: dur,
      status: res.status,
      ok: res.ok,
      error: res.error || null
    };

    cache.set(url, entry);
    completed++;
    if (onProgress) onProgress(completed, uniqueUrls.length, url);
    return entry;
  }

  const queue = [...uniqueUrls];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url) results.push(await fetchOne(url));
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Fetch a single URL using the pool logic so telemetry and cache are unified.
 * Implements a simple exponential backoff around `fetchProxy` to improve reliability.
 * Automatically applies longer timeout for collection/inventory pages.
 */
export async function fetchUrl(url, opts = {}) {
  const { retries = crawlConfig.fetchRetries, timeout = null } = opts;

  if (cache.has(url)) return cache.get(url);

  await rateLimit(crawlConfig.rateLimitMs);

  let attempt = 0;
  let lastRes = null;
  const start = performance.now();
  telemetry.totalRequests++;

  // Use provided timeout, or auto-detect based on URL pattern
  const effectiveTimeout = timeout || (
    isCollectionLikeUrl(url) 
      ? (crawlConfig.collectionTimeoutMs || 25000)
      : crawlConfig.fetchTimeout
  );

  while (attempt <= retries) {
    try {
      // Disable nested retries in fetchProxy since we implement our own attempts here
      lastRes = await fetchProxy(url, { retries: 0, timeout: effectiveTimeout });
    } catch (err) {
      lastRes = { ok: false, error: String(err), status: 0, html: '' };
    }

    if (lastRes && lastRes.ok) break;

    // backoff before next attempt
    attempt++;
    const backoffMs = 200 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  const dur = Math.round(performance.now() - start);
  telemetry.durations.push(dur);
  if (!lastRes || !lastRes.ok) {
    telemetry.failures++;
    telemetry.slowUrls.push({ url, status: lastRes?.status, duration: dur, error: lastRes?.error });
  } else {
    telemetry.successes++;
    if (dur > (crawlConfig.slowThresholdMs || 2000)) {
      telemetry.slowUrls.push({ url, status: lastRes.status, duration: dur });
    }
  }

  const entry = {
    url,
    html: lastRes?.html || "",
    duration: dur,
    status: lastRes?.status || 0,
    ok: !!(lastRes && lastRes.ok),
    error: lastRes?.error || null,
  };

  cache.set(url, entry);
  return entry;
}

export function clearFetchCache() {
  cache.clear();
}

export function getFetchTelemetry() {
  return { ...telemetry };
}

export function resetFetchTelemetry() {
  telemetry.totalRequests = 0;
  telemetry.successes = 0;
  telemetry.failures = 0;
  telemetry.durations.length = 0;
  telemetry.slowUrls.length = 0;
}
