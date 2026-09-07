const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const FILE = path.join(__dirname, '..', 'lifepath-test.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/lifepath-test.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(FILE).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
