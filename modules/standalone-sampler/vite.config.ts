import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    const commitDate = execSync('git log -1 --format=%ci').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const isDirty = execSync('git status --porcelain').toString().trim().length > 0;
    return { commitHash, commitDate, branch, isDirty };
  } catch {
    return { commitHash: 'unknown', commitDate: '', branch: 'unknown', isDirty: false };
  }
}

const gitInfo = getGitInfo();
const buildTime = new Date().toISOString();

export default defineConfig({
  base: '/sampler/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_COMMIT__: JSON.stringify(gitInfo.commitHash),
    __GIT_BRANCH__: JSON.stringify(gitInfo.branch),
    __GIT_DATE__: JSON.stringify(gitInfo.commitDate),
    __GIT_DIRTY__: JSON.stringify(gitInfo.isDirty),
  },
  server: {
    port: 3200,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
