import fetchProxy from "../utils/fetchProxy.js";
import crawlConfig from "../config/crawlConfig.js";
import rateLimit from "./rateLimiter.js";

const cache = new Map();

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
    const res = await fetchProxy(url, {
      retries: crawlConfig.fetchRetries,
      timeout: crawlConfig.fetchTimeout
    });

    const entry = {
      url,
      html: res.html || "",
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

export function clearFetchCache() {
  cache.clear();
}
