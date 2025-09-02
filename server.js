const http = require('http');                      // 1 - built-in HTTP server module (for /health endpoint)
const https = require('https');                    // 2 - built-in HTTPS client module (for outgoing requests)
const { URL } = require('url');                    // 3 - tiny helper to parse URLs cleanly

const PORT = process.env.PORT || 3000;             // 4 - port where our health server will listen (default 3000)
const POLL_INTERVAL = 10_000;                      // 5 - how often we poll endpoints (milliseconds). 10_000 = 10s
const REQUEST_TIMEOUT = 5_000;                     // 6 - timeout for each monitored request (milliseconds). 5s

// 7 - list of endpoints to monitor
const endpoints = [
  "https://salak-codes.github.io/Simon-Game/",
  "https://api.github.com/",
  "https://pokeapi.co/api/v2/"
];

// 8 - state array that will hold metrics for each monitored endpoint
const state = endpoints.map(url => ({
  url,
  up: null,
  lastChecked: null,
  responseTimeMs: null,
  failures: 0,
  successes: 0,
  priority: "high",
}));

// 9 - helper that sends a GET request
function httpRequest(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: { 'User-Agent': 'simple-health-check/1.0' }
    };

    const start = Date.now();

    const req = lib.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const duration = Date.now() - start;
        const body = Buffer.concat(chunks).toString();
        resolve({ statusCode: res.statusCode, duration, body });
      });
    });

    req.on('error', err => reject(err));

    req.setTimeout(timeoutMs, () => {
      req.abort();
      reject(new Error('request-timeout'));
    });

    req.end();
  });
}

// 10 - single check
async function checkOnce(entry) {
  try {
    const { statusCode, duration } = await httpRequest(entry.url, REQUEST_TIMEOUT);
    entry.lastChecked = new Date().toISOString();
    entry.responseTimeMs = duration;

    if (statusCode >= 200 && statusCode < 400) {
      entry.up = true;
      entry.failures = 0;
      entry.successes += 1;
      delete entry.error;
    } else {
      entry.up = false;
      entry.failures += 1;
      entry.error = status-${statusCode};
    }
  } catch (err) {
    entry.up = false;
    entry.lastChecked = new Date().toISOString();
    entry.responseTimeMs = null;
    entry.failures += 1;
    entry.error = err && err.message ? err.message : String(err);
  }
}

// 11 - run all checks
async function runChecks() {
  await Promise.all(state.map(entry => checkOnce(entry)));
}

// 12 - start periodic polling
runChecks();
setInterval(runChecks, POLL_INTERVAL);

// 13 - create the HTTP server
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    // Root route - simple welcome
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('✅ Health check service is running. Go to /health for details.');
  }
  else if (req.method === 'GET' && req.url === '/health') {
    const allUp = state.every(s => s.up === true);
    const someUp = state.some(s => s.up === true);
    const overall = allUp ? 'up' : (someUp ? 'degraded' : 'down');

    const payload = {
      overall,
      timestamp: new Date().toISOString(),
      services: state
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

// 14 - start listening
server.listen(PORT, () => {
  console.log(Health server listening on port ${PORT}. GET /health to see results);
});