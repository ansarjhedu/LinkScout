# LinkScout Minimal Server

This folder contains a minimal Node/Express server and worker to run crawls server-side using Redis as a job queue.

Quick start (requires Docker):

1. Start services:

```bash
docker-compose up --build
```

If Docker is unavailable, run the server directly in local fallback mode:

```bash
cd server
npm install
node index.js
```

Then submit the URL with:

```bash
curl -X POST http://localhost:3000/api/crawl -H "Content-Type: application/json" -d '{"url":"https://example.com"}'
```

Use local fallback mode by setting `USE_LOCAL_QUEUE=true` if you want a Redis-free test.

2. Enqueue a job:

```bash
curl -X POST http://localhost:3000/api/crawl -H "Content-Type: application/json" -d '{"url":"https://example.com"}'
```

3. Check result (replace <id> with returned id):

```bash
curl http://localhost:3000/api/result/<id>
```

Run the worker directly (without Docker):

```bash
cd server
npm install
node worker.js
```

Notes:
- This is a minimal scaffold intended for local testing and as a starting point for production hardening (rate-limiting, auth, retries, storage).
- For production, run workers in a managed environment and add authentication to `/api/crawl`.
