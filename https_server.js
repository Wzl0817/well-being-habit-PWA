const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8766;
const DIR = __dirname;

const options = {
  key: fs.readFileSync(path.join(DIR, 'key.pem')),
  cert: fs.readFileSync(path.join(DIR, 'cert.pem'))
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = https.createServer(options, (req, res) => {
  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
  filePath = path.normalize(filePath).replace(/\/$/, '/index.html');

  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  // PWA headers
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const os = require('os');
const interfaces = os.networkInterfaces();
let localIP = '127.0.0.1';
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIP = iface.address;
      break;
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ✅ HTTPS 预览服务器已启动');
  console.log('  ─────────────────────────────────────');
  console.log(`  📱 手机访问:`);
  console.log(`     https://${localIP}:${PORT}/`);
  console.log('  ─────────────────────────────────────');
  console.log('  ⚠️  首次访问需接受证书安全警告');
  console.log('  ─────────────────────────────────────\n');
});
