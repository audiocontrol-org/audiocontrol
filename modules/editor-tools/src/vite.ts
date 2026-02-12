/**
 * Vite build configuration helpers for injecting build metadata
 */

import { execSync } from 'child_process';

export interface GitInfo {
  commitHash: string;
  commitDate: string;
  branch: string;
  isDirty: boolean;
}

/**
 * Get git info for build metadata
 */
export function getGitInfo(): GitInfo {
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

/**
 * Create Vite define config for build metadata
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { getBuildDefines } from '@audiocontrol/editor-tools/vite';
 *
 * export default defineConfig({
 *   define: getBuildDefines(),
 *   // ... other config
 * });
 * ```
 */
export function getBuildDefines(): Record<string, string> {
  const gitInfo = getGitInfo();
  const buildTime = new Date().toISOString();

  return {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_COMMIT__: JSON.stringify(gitInfo.commitHash),
    __GIT_BRANCH__: JSON.stringify(gitInfo.branch),
    __GIT_DATE__: JSON.stringify(gitInfo.commitDate),
    __GIT_DIRTY__: JSON.stringify(gitInfo.isDirty),
  };
}
