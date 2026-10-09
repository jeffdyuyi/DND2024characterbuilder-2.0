import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const basePath = process.env.PAGES_BASE_PATH ?? (process.argv.includes('--pages') ? '/DND2024characterbuilder-2.0' : '');
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  stdio: 'inherit', env: { ...process.env, PAGES_BASE_PATH: basePath },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync('out/.nojekyll', '');
writeFileSync('out/.static-site.json', JSON.stringify({ basePath }));
