import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const modulePath = process.argv[2];
if (!modulePath) {
  console.error('Usage: node scripts/visual-compare.mjs <module-path>');
  process.exit(2);
}

const baselineDir = path.join(modulePath, 'artifacts/visual/baseline');
const currentDir = path.join(modulePath, 'artifacts/visual/current');

async function listPngs(dir) {
  try {
    const entries = await readdir(dir);
    return entries.filter((entry) => entry.endsWith('.png')).sort();
  } catch {
    return [];
  }
}

async function hashFile(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

const baselineFiles = await listPngs(baselineDir);
const currentFiles = await listPngs(currentDir);

if (baselineFiles.length === 0) {
  console.error(`[visual:compare] No baseline PNGs found in ${baselineDir}`);
  process.exit(1);
}

if (currentFiles.length === 0) {
  console.error(`[visual:compare] No current PNGs found in ${currentDir}`);
  process.exit(1);
}

const errors = [];

for (const file of baselineFiles) {
  if (!currentFiles.includes(file)) {
    errors.push(`Missing current image for baseline: ${file}`);
    continue;
  }

  const baselinePath = path.join(baselineDir, file);
  const currentPath = path.join(currentDir, file);
  const [baselineHash, currentHash] = await Promise.all([hashFile(baselinePath), hashFile(currentPath)]);
  if (baselineHash !== currentHash) {
    const [baselineStat, currentStat] = await Promise.all([stat(baselinePath), stat(currentPath)]);
    errors.push(
      `Mismatch: ${file} (baseline ${baselineStat.size} bytes vs current ${currentStat.size} bytes)`
    );
  }
}

for (const file of currentFiles) {
  if (!baselineFiles.includes(file)) {
    errors.push(`Extra current image without baseline: ${file}`);
  }
}

if (errors.length > 0) {
  console.error(`[visual:compare] FAILED for ${modulePath}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[visual:compare] PASS for ${modulePath} (${baselineFiles.length} images)`);
