/**
 * 本地预览用的静态服务器（零依赖）
 * ------------------------------------------------------------
 * 只负责把 index.html 起在 localhost 上方便看效果，**不做任何中转**。
 * 启动：node preview.js   →   http://localhost:8788
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8788);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = decodeURIComponent(url.pathname);
  if (file === '/') file = '/index.html';
  const full = path.join(__dirname, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(__dirname)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('预览： http://localhost:' + PORT);
});
