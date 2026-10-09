import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

const root = resolve('out');
let basePath;
try {
  ({ basePath } = JSON.parse(readFileSync(resolve(root, '.static-site.json'), 'utf8')));
} catch {
  throw new Error('Static export missing. Run npm run build or npm run build:pages first.');
}
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === basePath && basePath) {
      response.writeHead(308, { Location: `${basePath}/` });
      response.end();
      return;
    }
    if (basePath && !pathname.startsWith(`${basePath}/`)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const local = pathname.slice(basePath.length);
    let file = resolve(root, `.${local}`);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(
      request.method === 'HEAD'
        ? undefined
        : await readFile(resolve(root, '404.html')).catch(() => 'Not found'),
    );
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Static preview: http://localhost:${port}${basePath}/`),
);
