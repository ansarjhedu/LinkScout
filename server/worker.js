const Redis = require('ioredis');
const fetchProxy = require('./proxy');
let orchestrateCrawl = null;
async function loadCrawlModule() {
  if (!orchestrateCrawl) {
    orchestrateCrawl = (await import('../src/crawler/index.js')).default;
  }
  return orchestrateCrawl;
}

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
redis.on('error', (err) => console.error('[redis] error', err && err.message));

const DEFAULT_MAX_ATTEMPTS = Number(process.env.MAX_FETCH_ATTEMPTS || 3);
const DEFAULT_BASE_TIMEOUT_MS = Number(process.env.BASE_FETCH_TIMEOUT_MS || 15000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetries(url, opts = {}) {
  const attempts = Math.max(1, opts.attempts || DEFAULT_MAX_ATTEMPTS);
  let lastError = null;
  let attemptResult = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await fetchProxy(url, {
        timeoutMs: opts.timeoutMs || DEFAULT_BASE_TIMEOUT_MS,
      });
      attemptResult = {
        success: result.ok,
        status: result.status,
        body: result.html || result.body || null,
        headers: result.headers || {},
        proxyUsed: result.proxyUsed || null,
        duration: result.duration || null,
      };

      if (result.ok) {
        return { result: attemptResult, attempts: attempt };
      }

      lastError = new Error(`HTTP ${result.status} ${result.error || 'fetch failure'}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < attempts) {
      const backoff = 1000 * attempt;
      await delay(backoff);
    }
  }

  throw lastError || new Error('Unknown fetch failure');
}

async function processJob(job) {
  const { id, url, opts = {} } = job;
  await redis.hset(
    `crawl:meta:${id}`,
    'status', 'processing',
    'startTs', Date.now(),
    'attempts', 0,
    'lastError', ''
  );

  try {
    const orchestrate = await loadCrawlModule();
    const result = await orchestrate(url, null, {
      maxCrawlPages: Number(opts.maxCrawlPages || 15),
      enableReCrawl: opts.enableReCrawl !== false,
    });

    await redis.set(`crawl:results:${id}`, JSON.stringify(result), 'EX', 60 * 60 * 24);
    await redis.hset(
      `crawl:meta:${id}`,
      'status', 'done',
      'doneTs', Date.now(),
      'attempts', 1,
      'lastError', ''
    );
    console.log('done', id, url, `pages=${result.meta?.totalPagesVisited || 0}`);
  } catch (err) {
    await redis.hset(
      `crawl:meta:${id}`,
      'status', 'error',
      'error', String(err),
      'doneTs', Date.now(),
      'attempts', opts.attempts || DEFAULT_MAX_ATTEMPTS,
      'lastError', String(err)
    );
    console.error('job error', id, url, err && err.message);
  }
}

async function main() {
  console.log('worker started, listening for jobs');
  while (true) {
    try {
      const payload = await redis.brpop('crawl:queue', 0);
      if (!payload) continue;
      const [, data] = payload;
      const job = JSON.parse(data);
      await processJob(job);
    } catch (err) {
      console.error('worker loop error', err && err.message);
      await delay(2000);
    }
  }
}

main().catch((e) => {
  console.error('worker fatal', e && e.message);
  process.exit(1);
});
