const fetch = require('node-fetch');
const { URL } = require('url');
const http = require('http');
const https = require('https');

const keepaliveAgent = {
  http: new http.Agent({ keepAlive: true }),
  https: new https.Agent({ keepAlive: true }),
};

module.exports = async function fetchProxy(targetUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs || 20000;
  const startTime = Date.now();
  let resBody = null;
  let status = 0;
  const headersOut = {};
  try {
    const url = new URL(targetUrl);
    const agent = url.protocol === 'http:' ? keepaliveAgent.http : keepaliveAgent.https;
    const response = await fetch(targetUrl, { timeout: timeoutMs, agent, redirect: 'follow' });
    status = response.status;
    const ct = response.headers.get('content-type') || '';
    headersOut['content-type'] = ct;
    if (ct.includes('text') || ct.includes('html') || ct.includes('json')) {
      resBody = await response.text();
    } else {
      const buf = await response.buffer();
      resBody = buf.toString('base64');
    }
    return {
      ok: response.ok,
      status,
      html: resBody,
      headers: headersOut,
      duration: Date.now() - startTime,
      proxyUsed: opts.proxyName || 'direct',
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    throw Object.assign(err, { duration });
  }
};
