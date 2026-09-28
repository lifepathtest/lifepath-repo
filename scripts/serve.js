const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT !== undefined ? Number(process.env.PORT) : 3456;
const FILE = path.join(__dirname, '..', 'lifepath-test.html');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/lifepath-test.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(FILE).pipe(res);
    return;
  }
  // Other static files from public/ (e.g. /terms.html); anything resolving outside public/ is refused.
  const filePath = path.join(PUBLIC_DIR, req.url.split('?')[0]);
  if (filePath.startsWith(PUBLIC_DIR + path.sep) && TYPES[path.extname(filePath)] &&
      fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${server.address().port}`);
});
