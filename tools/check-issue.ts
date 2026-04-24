#!/usr/bin/env tsx
/**
 * Check the last N comments on a GitHub issue.
 *
 * Created in response to a specific failure mode: when polling an issue for
 * updates, I (Claude) was using a remembered timestamp as a `created_at >`
 * filter and treating that timestamp as ground truth. The remembered value
 * drifted from reality, hiding real comments behind a fabricated cutoff.
 *
 * This tool exists so that "check for updates" never depends on a
 * remembered timestamp again. It shows the actual last N comments,
 * unconditionally.
 *
 * Usage:
 *   tsx tools/check-issue.ts <issue_number> [count]
 *   tsx tools/check-issue.ts 315 5
 *   tsx tools/check-issue.ts 315          # default count = 3
 *
 * Defaults to repo `audiocontrol-org/audiocontrol`. Override with
 * GH_REPO env var if needed.
 */
import { execSync } from 'node:child_process';

const REPO = process.env.GH_REPO ?? 'audiocontrol-org/audiocontrol';
const issueArg = process.argv[2];
const countArg = process.argv[3];

if (!issueArg) {
  console.error('usage: tsx tools/check-issue.ts <issue_number> [count]');
  process.exit(2);
}

const issueNumber = parseInt(issueArg, 10);
if (Number.isNaN(issueNumber) || issueNumber <= 0) {
  console.error(`invalid issue number: ${issueArg}`);
  process.exit(2);
}

const count = countArg ? parseInt(countArg, 10) : 3;
if (Number.isNaN(count) || count <= 0 || count > 50) {
  console.error(`invalid count (must be 1..50): ${countArg}`);
  process.exit(2);
}

interface GhComment {
  id: number;
  created_at: string;
  updated_at: string;
  user: { login: string };
  body: string;
  html_url: string;
}

// `gh api --paginate` concatenates JSON arrays as `]\n[`. Splitting on the
// literal `][` boundary across newlines is brittle — use jq via a child
// process to do the flattening, since jq handles concatenated JSON natively.
let comments: GhComment[];
try {
  const flat = execSync(
    `gh api "repos/${REPO}/issues/${issueNumber}/comments" --paginate | jq -s 'add'`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: '/bin/bash' },
  );
  comments = JSON.parse(flat);
} catch (e) {
  console.error('failed to fetch/parse gh api output:', (e as Error).message);
  process.exit(1);
}

const last = comments.slice(-count);
console.log(`Repo: ${REPO}  Issue: #${issueNumber}  Total comments: ${comments.length}  Showing last: ${last.length}`);
console.log('---');

for (const c of last) {
  const updated = c.updated_at !== c.created_at ? `  (edited ${c.updated_at})` : '';
  console.log(`[${c.created_at}]${updated}  ${c.user.login}  id=${c.id}`);
  console.log(`  ${c.html_url}`);
  const head = c.body.length > 800 ? c.body.slice(0, 800) + '...' : c.body;
  // Indent body for readability
  const indented = head
    .split('\n')
    .map((l) => '    ' + l)
    .join('\n');
  console.log(indented);
  console.log();
}
