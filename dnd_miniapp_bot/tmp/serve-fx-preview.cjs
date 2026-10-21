const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(path.join(__dirname, '..', 'frontend', 'cosmetics-preview'));
const prefix = '/cosmetics-preview/';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' };
const port = Number(process.argv[2] || 8000);

http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/cosmetics-preview') {
      res.writeHead(302, { Location: prefix });
      res.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method) || !url.pathname.startsWith(prefix)) {
      res.writeHead(404); res.end(); return;
    }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const candidate = path.resolve(root, relative);
    if (!candidate.startsWith(root + path.sep) || !fs.existsSync(candidate)) {
      res.writeHead(404); res.end(); return;
    }
    const file = fs.realpathSync(candidate);
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`FX preview: http://127.0.0.1:${port}${prefix}`);
});
