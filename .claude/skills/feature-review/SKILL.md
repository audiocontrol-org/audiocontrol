---
name: feature-review
description: "Delegate code review of recent changes to code-reviewer agent and report findings."
user_invocable: true
---

# Feature Review

This skill delegates code review to specialized agents and reports findings. When invoked:

1. **Determine review scope:**
   - Check for uncommitted changes: `git diff --stat`
   - Check for staged changes: `git diff --cached --stat`
   - If no local changes, review commits since branch point: `git log main..HEAD --oneline`
   - Determine the set of changed files: `git diff --name-only main..HEAD`

2. **Gather context:**
   - Read the changed files to understand what was modified
   - Read `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md` for acceptance criteria context
   - Note the relevant module(s) from file paths

3. **Delegate to code-reviewer:**
   - Launch code-reviewer agent with:
     - List of changed files with full paths
     - What the changes are trying to accomplish (from workplan)
     - Project guidelines: reference `.claude/CLAUDE.md` for standards
     - Specific concerns: type safety, no `any`, no class inheritance, composition over inheritance, files under 500 lines, no mock data outside tests
   - Instruct agent to report: issues found, severity (critical/warning/info), specific file and line, recommendation

4. **Optionally delegate to codebase-auditor:**
   - If changes touch multiple modules or create new files
   - Check for: DRY violations, nucleation sites, dead code, backward-compat shims
   - Same reporting format

5. **Report findings:**
   - Summary: N issues found (X critical, Y warnings, Z info)
   - For each issue: file, line, description, recommendation
   - Overall assessment: ready to ship / needs fixes
   - If fixes needed: suggest delegating to appropriate implementation agent

6. **Do NOT fix issues:**
   - This skill only reports -- it does not modify code
   - The feature-orchestrator decides whether and how to address findings
