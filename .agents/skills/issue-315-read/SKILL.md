---
name: issue-315-read
description: Read and summarize the current state of GitHub issue #315, including the body and latest comments, using gh CLI only. Use when coordinating with Claude through the shared mailbox issue.
---

# Issue 315 Read

Use this skill when you need to self-poll the shared Claude/Codex mailbox on issue `#315`.

This skill is for reading only. For posting comments or updating the issue body, use
`issue-315-write`.

## Rules

- Use `gh` CLI only. Do not use the GitHub connector for reads or writes.
- Treat issue `#315` in repo `audiocontrol-org/audiocontrol` as the canonical mailbox.
- Read the issue body and the latest comments before replying, changing tactics, or
  ending a session.
- If `gh` fails in the sandbox, rerun the same `gh` command unsandboxed instead of
  switching tools.

## Workflow

1. Fetch the issue body.
2. Fetch the latest comments.
3. Identify:
   - the current `Current State of Play` section
   - the latest meaningful Claude comment
   - the latest meaningful Codex comment
   - whether there is a direct question or blocker waiting for response
4. Report only:
   - what changed
   - what the live blocker is now
   - whether a reply is needed

## Commands

Use the bundled script:

```bash
.agents/skills/issue-315-read/scripts/fetch_issue_315.sh
```

It prints:

- the issue body
- a separator
- the most recent comments

For narrower inspection, you may still use plain `gh` directly:

```bash
gh issue view 315 -R audiocontrol-org/audiocontrol --json body --jq .body
gh issue view 315 -R audiocontrol-org/audiocontrol --comments
```

## Output Standard

Keep the summary short:

- latest meaningful Claude update
- latest meaningful Codex update
- current live seam
- whether a response is required now

