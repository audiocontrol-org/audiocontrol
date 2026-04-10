---
name: session-end
description: "Wrap up a Claude Code session by updating feature docs, writing a journal entry, and committing documentation changes."
user_invocable: true
---

# Session End

Perform all end-of-session documentation updates:

1. **Update feature README.md** status table:
   - Read: `docs/1.0/001-IN-PROGRESS/<feature-slug>/README.md`
   - Update phase statuses based on what was accomplished this session

2. **Update workplan.md**:
   - Check off completed acceptance criteria
   - Add any new tasks discovered during the session
   - Note any phase changes

3. **Write DEVELOPMENT-NOTES.md entry** using the template:
   ```
   ## YYYY-MM-DD: [Session Title]
   ### Feature: [feature-slug]
   ### Worktree: audiocontrol-<slug>
   ### Goal / Accomplished / Didn't Work / Course Corrections / Quantitative / Insights
   ```
   - Tag each course correction: [COMPLEXITY] [UX] [FABRICATION] [DOCUMENTATION] [PROCESS]
   - Include approximate quantitative data (messages, commits, corrections)
   - Be honest about mistakes

4. **Update device notes** if hardware work was done:
   - Add dated entry to `SCSI-NOTES.md` with findings

5. **Update/close GitHub issues**:
   - Comment on issues that had progress
   - Close issues that are complete

6. **Commit all documentation changes**:
   - Stage: README.md, workplan.md, DEVELOPMENT-NOTES.md, SCSI-NOTES.md
   - Commit message: `docs: session end — [brief summary]`
   - Push to feature branch
