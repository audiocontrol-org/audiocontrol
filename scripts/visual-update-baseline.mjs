import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const modulePath = process.argv[2];
if (!modulePath) {
  console.error('Usage: node scripts/visual-update-baseline.mjs <module-path>');
  process.exit(2);
}

const baselineDir = path.join(modulePath, 'artifacts/visual/baseline');
const currentDir = path.join(modulePath, 'test-results/visual/current');

await rm(baselineDir, { recursive: true, force: true });
await mkdir(path.dirname(baselineDir), { recursive: true });
await cp(currentDir, baselineDir, { recursive: true });

console.log(`[visual:baseline:update] Updated baseline from current for ${modulePath}`);
