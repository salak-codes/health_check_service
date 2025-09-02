const http = require('http');
const https = require('https');
const url = require('url');

const services = [
  { name: 'Users API', url: 'https://salak-codes.github.io/Simon-Game/'},
  { name: 'Posts API', url: 'https://pokeapi.co/api/v2/pokemon/pikachu'},
  { name: 'Invalid API', url:  'https://api.adviceslip.com/advice'}
];

const checkIntervalMs = 30000; 
const timeoutMs = 5000; 
let healthStatus = {};

function httpRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'GET'
    };

    const req = protocol.request(options, res => {
      res.resume(); 
      resolve(res.statusCode);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('request-timeout'));
    });

    req.on('error', err => reject(err));

    req.end();
  });
}

async function checkService(service) {
  const start = Date.now();
  try {
    const statusCode = await httpRequest(service.url);
    const responseTime = Date.now() - start;
    healthStatus[service.name] = {
      status: statusCode === 200 ? 'UP' : 'DOWN',
      statusCode,
      responseTime: `${responseTime}ms`,
      lastChecked: new Date().toISOString()
    };
  } catch (err) {
    healthStatus[service.name] = {
      status: 'DOWN',
      error: err.message,
      lastChecked: new Date().toISOString()
    };
  }
}

async function runChecks() {
  await Promise.all(services.map(svc => checkService(svc)));
  console.log(`[${new Date().toISOString()}] Health check complete`);
  console.table(healthStatus);
}

setInterval(runChecks, checkIntervalMs);
runChecks();

http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthStatus, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}).listen(3000, () => {
  console.log('Health check server running on port 3000');
});