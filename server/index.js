const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const fetchProxy = require('./proxy');
let orchestrateCrawl = null;
async function loadCrawlModule() {
  if (!orchestrateCrawl) {
    orchestrateCrawl = (await import('../src/crawler/index.js')).default;
  }
  return orchestrateCrawl;
}

const app = express();
const useLocalQueue = process.env.USE_LOCAL_QUEUE === 'true';
const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const redis = useLocalQueue ? null : new Redis(redisUrl);
let redisReady = false;
if (redis) {
  redis.on('ready', () => {
    redisReady = true;
    console.log('[redis] ready');
  });
  redis.on('error', (err) => {
    redisReady = false;
    console.error('[redis] error', err && err.message);
  });
}

const localQueue = [];
const localMeta = new Map();
const localResults = new Map();
let processingLocal = false;

function usingLocalQueue() {
  return useLocalQueue || !redis || !redisReady;
}

app.use(cors());
app.use(morgan('tiny'));
app.use(bodyParser.json({ limit: '1mb' }));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Enqueue a crawl job: { url: string, opts?: {} }
app.post('/api/crawl', async (req, res) => {
  const { url, opts } = req.body || {};
  if (!url) return res.status(400).json({ error: 'missing url' });
  const id = uuidv4();
  const job = { id, url, opts: opts || {}, ts: Date.now() };

  if (usingLocalQueue()) {
    localQueue.push(job);
    localMeta.set(id, { status: 'queued', ts: Date.now(), attempts: 0 });
  } else {
    await redis.lpush('crawl:queue', JSON.stringify(job));
    await redis.hset(`crawl:meta:${id}`, 'status', 'queued', 'ts', Date.now());
  }

  res.json({ id });
});

// Check job status/result
app.get('/api/result/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing id' });
  if (usingLocalQueue()) {
    const meta = localMeta.get(id) || {};
    const data = localResults.has(id) ? localResults.get(id) : null;
    if (!data && Object.keys(meta).length === 0) return res.status(404).json({ error: 'not found' });
    return res.json({ meta, data });
  }

  const data = await redis.get(`crawl:results:${id}`);
  const meta = await redis.hgetall(`crawl:meta:${id}`);
  if (!data && Object.keys(meta).length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ meta, data: data ? JSON.parse(data) : null });
});

// Simple proxy fetch (immediately fetch and return) — useful for quick tests
app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('missing url');
  try {
    const result = await fetchProxy(target, { timeoutMs: 30000 });
    res.status(result.status || 200).set(result.headers || {}).send(result.body || result.html || '');
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001);

async function processLocalQueue() {
  if (processingLocal) return;
  processingLocal = true;
  while (localQueue.length > 0) {
    const job = localQueue.shift();
    const id = job.id;
    localMeta.set(id, { ...(localMeta.get(id) || {}), status: 'processing', startTs: Date.now(), attempts: 0, error: '' });
    try {
      const orchestrate = await loadCrawlModule();
      const result = await orchestrate(job.url, null, {
        maxCrawlPages: Number(job.opts?.maxCrawlPages || 15),
        enableReCrawl: job.opts?.enableReCrawl !== false,
      });
      localResults.set(id, result);
      localMeta.set(id, {
        ...(localMeta.get(id) || {}),
        status: 'done',
        doneTs: Date.now(),
        attempts: 1,
      });
      console.log('local queue done', id, job.url);
    } catch (err) {
      localMeta.set(id, {
        ...(localMeta.get(id) || {}),
        status: 'error',
        doneTs: Date.now(),
        attempts: job.opts?.attempts || 1,
        error: String(err),
      });
      console.error('local queue error', id, job.url, err && err.message);
    }
  }
  processingLocal = false;
}

if (!redis || useLocalQueue) {
  setInterval(processLocalQueue, 1000);
}

app.listen(PORT, () => {
  console.log(`LinkScout server listening on ${PORT}`);
  if (useLocalQueue) {
    console.log('Running in local fallback mode; no Redis required.');
  }
});
