#!/usr/bin/env node
import { run } from './perfCrawl.mjs';

run().catch((err)=>{ console.error('Fatal from runPerfDirect:', err); process.exit(4); });
