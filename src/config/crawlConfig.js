/**
 * Centralized crawl configuration sourced from Vite environment variables.
 */
const crawlConfig = {
  corsProxyUrl: import.meta.env.VITE_CORS_PROXY_URL || "https://api.allorigins.win/raw?url=",
  maxCrawlPages: Number(import.meta.env.VITE_MAX_CRAWL_PAGES) || 80,
  rateLimitMs: Number(import.meta.env.VITE_CRAWL_RATE_LIMIT_MS) || 150,
  concurrency: Number(import.meta.env.VITE_CRAWL_CONCURRENCY) || 4,
  appTitle: import.meta.env.VITE_APP_TITLE || "MaxOpp Intelligence Crawler",
  fetchTimeout: 15000,
  fetchRetries: 2,
  productPageBudget: 15,
  collectionPageBudget: 8,
};

export default crawlConfig;
