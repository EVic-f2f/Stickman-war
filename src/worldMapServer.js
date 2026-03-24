const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 8000;
const ROOT = path.resolve(__dirname, '..');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const requestedPath = url.pathname === '/' ? '/web/index.html' : decodeURIComponent(url.pathname);

  // Keep all requests rooted in the repository directory.
  const relativePath = `.${path.posix.normalize(requestedPath)}`;
  const fullPath = path.resolve(ROOT, relativePath);

  if (!fullPath.startsWith(ROOT)) {
    send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
    return;
  }

  fs.stat(fullPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (readErr, content) => {
      if (readErr) {
        send(res, 500, 'text/plain; charset=utf-8', 'Internal Server Error');
        return;
      }
      send(res, 200, contentType, content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`World map server started on http://localhost:${PORT}`);
});
