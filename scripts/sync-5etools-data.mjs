/**
 * 5etools-cn 离线数据同步脚本
 * 用法: node scripts/sync-5etools-data.mjs [--core-only]
 *
 * 将 tjliqy/5etools-cn (cn2.0 分支) 数据镜像同步下载至 public/5etools-data/，
 * 彻底消除外部 CDN 依赖和 CORS 风险。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT_DIR, 'public', '5etools-data');

const RAW_BASE_URL = 'https://raw.githubusercontent.com/tjliqy/5etools-cn/cn2.0';

async function fetchJson(relPath) {
  const url = `${RAW_BASE_URL}/${relPath.replace(/^\//, '')}`;
  console.log(`[Fetching] ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveJson(relPath, data) {
  const targetPath = path.join(TARGET_DIR, relPath);
  ensureDir(targetPath);
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[Saved] ${relPath}`);
}

async function syncIndexFiles(indexRelPath, prefix) {
  const indexData = await fetchJson(indexRelPath);
  saveJson(indexRelPath, indexData);

  const fileList = Object.values(indexData);
  for (const file of fileList) {
    const fileRelPath = `${prefix}/${file}`;
    try {
      const fileData = await fetchJson(fileRelPath);
      saveJson(fileRelPath, fileData);
    } catch (err) {
      console.warn(`[Warning] Skipping ${fileRelPath}: ${err.message}`);
    }
  }
}

async function syncSingleFile(relPath) {
  try {
    const data = await fetchJson(relPath);
    saveJson(relPath, data);
  } catch (err) {
    console.warn(`[Warning] Skipping ${relPath}: ${err.message}`);
  }
}

async function main() {
  console.log(`=== 开始同步 5etools-cn 数据至: ${TARGET_DIR} ===`);

  // 1. 法术
  console.log('\n--- 同步法术数据 ---');
  await syncIndexFiles('data/spells/index.json', 'data/spells');

  // 2. 职业
  console.log('\n--- 同步职业数据 ---');
  await syncIndexFiles('data/class/index.json', 'data/class');

  // 3. 核心单文件
  console.log('\n--- 同步核心规则单文件 ---');
  await syncSingleFile('data/feats.json');
  await syncSingleFile('data/races.json');
  await syncSingleFile('data/backgrounds.json');
  await syncSingleFile('data/items-base.json');
  await syncSingleFile('data/items.json');

  console.log('\n=== 同步完成！数据已就绪。 ===');
}

main().catch((err) => {
  console.error('[Error]', err);
  process.exit(1);
});
