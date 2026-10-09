import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Check tracked files, not local files: ignored documents may stay on disk.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 5_000_000 })
  .split('\0')
  .filter(Boolean);
const trackedIgnored = execFileSync('git', ['ls-files', '-ci', '--exclude-standard', '-z'], {
  encoding: 'utf8',
  maxBuffer: 5_000_000,
})
  .split('\0')
  .filter(Boolean);
assert.equal(
  trackedIgnored.length,
  0,
  `Ignored local files must not be tracked:\n${trackedIgnored.join('\n')}`,
);
const rootFiles = new Set([
  '.env.example',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'README.md',
  'next.config.mjs',
  'package.json',
  'package-lock.json',
  'postcss.config.mjs',
  'tailwind.config.ts',
  'tsconfig.json',
  'vitest.config.ts',
]);
const scripts = new Set([
  'build-static.mjs',
  'predev.mjs',
  'preview-static.mjs',
  'verify-static.mjs',
  'verify-repository.mjs',
]);
const unexpected = files.filter(
  (file) =>
    !(
      rootFiles.has(file) ||
      file.startsWith('src/') ||
      file.startsWith('tests/') ||
      file.startsWith('.github/workflows/') ||
      (file.startsWith('scripts/') && scripts.has(file.slice('scripts/'.length)))
    ),
);
assert.equal(unexpected.length, 0, `Unexpected tracked files:\n${unexpected.join('\n')}`);
console.log(
  `Repository scope verified: ${files.length} tracked files; local documents and utilities excluded.`,
);
