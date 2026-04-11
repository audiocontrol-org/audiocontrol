---
name: feature-implement
description: "Core implementation loop: select next workplan task, choose appropriate agent, delegate with full context, review output, update progress."
user_invocable: true
---

# Feature Implement

This skill codifies the feature-orchestrator's core loop. When invoked, execute:

## 1. Identify current feature

- Run: `basename $(pwd)` to get worktree name, extract feature slug
- Run: `git rev-parse --abbrev-ref HEAD` to confirm branch

## 2. Find next task

- Read: `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md`
- Scan phases in order — find the first task with unchecked acceptance criteria
- If all tasks are complete, report "all workplan tasks complete" and stop

## 3. Analyze task

- Read the task's acceptance criteria
- Identify relevant source files (use Grep/Glob to find related code)
- Identify relevant interfaces and patterns
- Determine which test suite covers this area

## 4. Select agent

- TypeScript logic/interfaces/types -> typescript-pro
- UI components/styling -> ui-engineer
- Library browser/tree views -> library-ux-engineer
- Device protocols/MIDI/SCSI -> hardware-protocol-engineer
- Tests -> test-automator
- Documentation -> documentation-engineer

## 5. Delegate

Launch the selected agent with:

- Task description and acceptance criteria
- File paths to read and modify
- Relevant interfaces and patterns to follow
- Test command to run for verification
- Explicit instruction: "Use the Write/Edit tool to persist all changes to disk"

## 6. Review

- Read modified files
- Run tests: `pnpm --filter <module> test`
- If tests fail: re-delegate with error output
- If code quality concerns: delegate to code-reviewer

## 7. Update progress

- Check off completed acceptance criteria in workplan
- If all criteria for a task are met: `gh issue close <number>`
- Report to user: what was done, what's next

## 8. Repeat or stop

- If more tasks remain in the current phase: continue to step 3
- If phase is complete: report phase completion, ask user to confirm before starting next phase
- If all phases complete: report feature implementation complete
