/**
 * Verify that the current worktree, branch, feature slug, and docs path are
 * aligned before feature setup or implementation work proceeds.
 *
 * Usage:
 *   tsx tools/verify-feature-context.ts --slug codex-draggable-zones
 *   tsx tools/verify-feature-context.ts --slug codex-draggable-zones --require-docs
 */

import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execSync } from "node:child_process";

interface Options {
  slug: string | null;
  requireDocs: boolean;
}

interface WorktreeEntry {
  path: string;
  branch: string | null;
  isCurrent: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let slug: string | null = null;
  let requireDocs = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--slug" && args[i + 1]) {
      slug = args[i + 1];
      i++;
    } else if (args[i] === "--require-docs") {
      requireDocs = true;
    }
  }

  return { slug, requireDocs };
}

function run(command: string): string {
  return execSync(command, { encoding: "utf8" }).trim();
}

function inferSlugFromBranch(branch: string): string | null {
  if (!branch.startsWith("feature/")) {
    return null;
  }

  return branch.slice("feature/".length);
}

function parseWorktreeList(output: string, cwd: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  const blocks = output.trim().split("\n\n").filter(Boolean);

  for (const block of blocks) {
    let path = "";
    let branch: string | null = null;

    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) {
        path = line.slice("worktree ".length);
      } else if (line.startsWith("branch ")) {
        branch = line.slice("branch ".length).replace("refs/heads/", "");
      }
    }

    if (!path) {
      continue;
    }

    entries.push({
      path,
      branch,
      isCurrent: resolve(path) === resolve(cwd),
    });
  }

  return entries;
}

function findOtherWorktreesWithDocs(worktrees: WorktreeEntry[], currentPath: string, slug: string): string[] {
  const docsRelativePath = join("docs", "1.0", "001-IN-PROGRESS", slug);

  return worktrees
    .filter((entry) => resolve(entry.path) !== resolve(currentPath))
    .filter((entry) => existsSync(join(entry.path, docsRelativePath)))
    .map((entry) => entry.path);
}

function fail(message: string, details: string[]): never {
  console.error(`Feature context verification failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function main(): void {
  const options = parseArgs();
  const cwd = resolve(process.cwd());
  const topLevel = resolve(run("git rev-parse --show-toplevel"));
  const branch = run("git rev-parse --abbrev-ref HEAD");
  const inferredSlug = inferSlugFromBranch(branch);
  const slug = options.slug ?? inferredSlug;

  if (!slug) {
    fail("could not determine feature slug", [
      `cwd: ${cwd}`,
      `branch: ${branch}`,
      "Pass --slug <feature-slug> when the branch name does not encode the feature.",
    ]);
  }

  const expectedBranch = `feature/${slug}`;
  if (branch !== expectedBranch) {
    fail("current branch does not match the target feature slug", [
      `cwd: ${cwd}`,
      `branch: ${branch}`,
      `expected branch: ${expectedBranch}`,
    ]);
  }

  const worktrees = parseWorktreeList(run("git worktree list --porcelain"), cwd);
  const currentWorktree = worktrees.find((entry) => entry.isCurrent);
  const primaryWorktree = worktrees[0];

  if (!currentWorktree) {
    fail("could not identify the current worktree", [
      `cwd: ${cwd}`,
    ]);
  }

  if (resolve(currentWorktree.path) === resolve(primaryWorktree.path)) {
    fail("feature work is running in the primary worktree", [
      `current worktree: ${currentWorktree.path}`,
      `branch: ${branch}`,
      "Switch into the feature-specific worktree before creating docs or implementation changes.",
    ]);
  }

  const docsPath = join(topLevel, "docs", "1.0", "001-IN-PROGRESS", slug);
  const docsExist = existsSync(docsPath);
  const docsInOtherWorktrees = findOtherWorktreesWithDocs(worktrees, currentWorktree.path, slug);

  if (options.requireDocs && !docsExist) {
    const details = [
      `current worktree: ${currentWorktree.path}`,
      `docs path: ${docsPath}`,
      "Expected feature docs are missing from the current feature worktree.",
    ];

    if (docsInOtherWorktrees.length > 0) {
      details.push(`docs exist in other worktrees: ${docsInOtherWorktrees.join(", ")}`);
      details.push("Prefer a git-native transfer into this feature branch over manual recreation.");
    }

    fail("feature docs are missing from the active feature worktree", details);
  }

  console.log("Feature context verified.");
  console.log(`- cwd: ${cwd}`);
  console.log(`- worktree: ${currentWorktree.path}`);
  console.log(`- branch: ${branch}`);
  console.log(`- slug: ${slug}`);
  console.log(`- docs path: ${docsPath}`);
  console.log(`- docs present: ${docsExist ? "yes" : "no"}`);

  if (!docsExist && docsInOtherWorktrees.length > 0) {
    console.log(`- docs also found in other worktrees: ${docsInOtherWorktrees.join(", ")}`);
  }
}

main();
