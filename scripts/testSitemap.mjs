#!/usr/bin/env node
import fetchProxy from '../src/utils/fetchProxy.js';

const url = process.argv[2] || 'https://www.columbiatnpowersports.com/sitemap.xml';

console.log(`Testing sitemap fetch for: ${url}`);
const start = Date.now();

try {
  const response = await fetchProxy(url, { retries: 2, timeout: 15000 });
  const duration = Date.now() - start;
  
  console.log(`Status: ${response.status}`);
  console.log(`OK: ${response.ok}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`HTML length: ${response.html?.length || 0} bytes`);
  console.log(`Proxy used: ${response.proxyUsed || 'direct'}`);
  
  if (response.html) {
    const locMatches = response.html.match(/<loc>/gi);
    console.log(`Found ${locMatches?.length || 0} <loc> tags`);
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error);
}
