import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const origin = process.argv[2] || 'http://localhost:4173';
const { basePath } = JSON.parse(await readFile('out/.static-site.json', 'utf8'));
const assets = new Set();
let pages = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '_next') await walk(file); continue; }
    if (entry.name !== 'index.html') continue;
    const route = relative('out', directory).replaceAll('\\', '/');
    const url = `${origin}${basePath}/${route ? route + '/' : ''}`;
    const response = await fetch(url);
    assert.equal(response.status, 200, url);
    const html = await response.text();
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const value = match[1];
      if (!value.includes('/_next/')) continue;
      assert.ok(value.startsWith(`${basePath}/_next/`), `Asset escapes deployment path: ${value}`);
      assets.add(value);
    }
    pages++;
  }
}
await walk('out');
assert.ok(pages > 0, 'No exported pages');
assert.ok(assets.size > 0, 'No compiled assets');
for (const asset of assets) {
  assert.equal((await fetch(origin + asset)).status, 200, asset);
}
assert.equal((await fetch(`${origin}${basePath}/sheet/view/?id=static-preview-test`)).status, 200);
assert.equal((await fetch(`${origin}${basePath}/unknown-static-route/`)).status, 404);
if (basePath) assert.equal((await fetch(`${origin}/_next/invalid.js`)).status, 404);
console.log(`Verified ${pages} exported pages, ${assets.size} assets, query-based sheet URL and 404 handling at ${origin}${basePath}/`);
