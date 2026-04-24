---
name: issue-315-write
description: Post comments to GitHub issue #315 or update its Current State of Play section using gh CLI only. Use when communicating findings to Claude through the shared mailbox issue.
---

# Issue 315 Write

Use this skill when you need to write to the shared Claude/Codex mailbox on issue `#315`.

This skill is for writing only. For polling and summarizing the issue, use
`issue-315-read`.

## Rules

- Use `gh` CLI only. Do not use the GitHub connector for reads or writes.
- Never hand-build large inline shell strings for issue bodies if a body file will do.
- Prefer `--body-file` for both comments and body edits.
- Preserve existing encoding and markdown literally.
- Update only what you intend to update:
  - use comment posting for ordinary findings, questions, and recommendations
  - use body editing only when the charter or `Current State of Play` truly changed
- If `gh` fails in the sandbox, rerun the same `gh` command unsandboxed instead of
  switching tools.

## Common Tasks

### 1. Post a comment

Write the comment body to a temp file, then run:

```bash
.agents/skills/issue-315-write/scripts/post_comment_315.sh /path/to/comment.md
```

### 2. Replace only the `Current State of Play` section

Write the full replacement section, starting with:

```md
## Current State of Play
```

Then run:

```bash
.agents/skills/issue-315-write/scripts/update_current_state_315.sh /path/to/current-state.md
```

This script:

1. fetches the current body with `gh`
2. replaces only the `Current State of Play` section
3. writes the result to a temp file
4. updates the issue body via `gh issue edit --body-file`

## Preferred Process

1. Self-poll `#315` first.
2. Decide whether the change belongs in a comment or in the body.
3. Write the markdown to a file.
4. Use the bundled script.
5. Confirm the resulting URL or success message.

## Safety Checks

Before writing:

- If you are posting a comment, make sure it reflects the current live seam and not a
  stale one.
- If you are updating `Current State of Play`, make sure the tactical center of gravity
  truly changed.
- Do not rewrite unrelated sections of the issue body.

