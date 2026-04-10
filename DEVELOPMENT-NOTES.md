# Development Notes

Session journal for the audiocontrol project. Documents what we tried, what worked, what didn't, and — most importantly — how the user course-corrected the agent's approach.

---

## 2026-04-09 / 2026-04-10: Library UX, Disk Browser, SDS Speed

### Session goal
Improve the S3000XL editor's library UX: disk browser, drag-and-drop, sample transfer speed.

### What we accomplished
- SCSI disk browser with lazy metadata loading, collapsible volumes, context menus
- Drag-and-drop between disk browser, library, and device memory
- Three-section library (Samples, Programs, Akai Programs) with expandable programs
- NavLink query param preservation (real app bug, not just test issue)
- SDS upload 9x faster via packet batching (227ms/packet → 25ms/packet)
- Bridge hardening: disconnect cancellation, exponential backoff, dynamic timeouts
- ASPACK discovery: 23.4 KB/s proprietary transfer (10x faster than batched SDS)
- Protocol documentation, SCSI travel log, exploration plan for ASPACK

### What worked well
- **Node.js test scripts for hardware experiments.** Writing 50-line tsx scripts to probe SCSI behavior was dramatically faster than debugging through the web app. The batch SDS and ASPACK throughput measurements would have been impossible without this approach.
- **Reading the MESA II analysis.** The CDB flag byte discovery came directly from the mesa-plug-harness SCSI-PROTOCOL.md document. Prior art matters.
- **Incremental deployment.** `make deploy-scsi-bridge` → test → iterate. Short feedback loops on real hardware.

### What didn't work
- **Streaming port 6870.** Spent time investigating, writing a test, connecting — it doesn't relay device ACKs. Dead end.
- **Guessing at fixes without data.** Added sleeps, blamed stale data, assumed TCP overhead — all wrong. The timing instrumentation (`send_ms`/`recv_ms`) was the only thing that revealed the truth.
- **Pre-loading all files for save.** Tried to load all 27 samples in a volume before opening the save dialog. Hung the UI for minutes. Should have loaded on demand.

### Course corrections (user feedback)

**"STOP TRYING TO ADD DELAYS"**
I kept adding defensive sleeps between SCSI operations — 50ms here, 100ms there, 3-second "commit" waits. The user had to say this multiple times before I internalized it. The device ACK is definitive. If it ACKs, it's ready. Sleeps are never the first answer.

**"Why are you using pixel values instead of the 12-column layout system?"**
I hardcoded pixel widths (`w-72`, `width: 230px`) for layout columns. The user pointed out this is bad for responsive design. Switched to proportional flex ratios (2:2:3:2). Also: the user noted my pixel changes didn't visibly take effect because of caching — I should have verified the change was visible.

**"Why didn't you interrogate the actual sample file?"**
When encountering `sampleRate: 0` in WAV files, I fell back to a hardcoded `44100` default. The user correctly asked why I'd guess instead of reading the actual data. The WAV was written with rate 0 (pre-fix bug), so the error should surface to the user, not be silently papered over.

**"Double-click on list items is super not standard"**
I added double-click-to-download on disk browser items. The user pointed out this is non-standard UX. Also, "Download as WAV" was wrong for a library context — the primary action should be "Save to Library" via context menu.

**"The download seems stuck" / "No progress indicator"**
Multiple times I implemented operations with no loading indicators. The disk browser scan, disk data loading, and sample transfers all launched with no visible feedback. The user had to ask for progress indicators repeatedly before I started treating them as a first-class requirement.

**"Why does it take so long to start showing disk contents?"**
I was reading the entire first partition (60MB+) before displaying anything. The user's question prompted lazy metadata loading — read only FAT + volume directory (~50KB), load file data on demand.

**"Don't blame the device / Don't make things up"**
I said the S3000XL needed time to recover after a failed transfer. I said MESA II used direct SCSI block writes to sampler memory. Both were fabrications. The user called me out each time. The rule: every claim needs hardware evidence or documentation.

**"Why don't you just try a larger packet and see if it works?"**
I was theorizing about whether the S3000XL could accept larger SDS packets or ASPACK chunks. Instead of reasoning about it, the user said to just try it. The experiments took seconds and answered the question definitively.

**"The current sysex channel is meant for the control plane, not the data plane"**
I tested ASPACK throughput via the bridge's HTTP `/sds/send` endpoint (control plane) and got 0.6 KB/s. The user pointed out this was the wrong path — data transfer needs to go through raw SCSI CDBs with MIDI mode kept enabled. On the data plane, ASPACK achieved 23.4 KB/s.

**"File an issue" / "Document your findings" / "Write it to the feature documentation"**
The user consistently asked me to persist findings in the right places — issues for future work, docs for protocol knowledge, plan files for exploration strategies. My instinct was to keep moving; the user's instinct was to document first.

**"Can you also make sure you add dates?"**
I wrote the SCSI travel log without specific timestamps. The user wanted a timeline for future reference and blog writing. Added timestamps reconstructed from git history.

### Patterns observed

1. **I default to complexity.** The user repeatedly pushed for simpler approaches — try it before theorizing, use raw CDBs before building abstractions, test from Node before touching React.

2. **I underinvest in UX feedback.** Loading spinners, progress bars, error messages — I treat these as afterthoughts. The user treats them as requirements equal to the feature itself.

3. **I make things up when I don't know.** When uncertain, I generate plausible-sounding explanations instead of saying "I don't know, let me check." The user catches this every time.

4. **I don't document proactively.** Left to my own devices, I'd keep coding. The user consistently asks for documentation, issues, plans. The documentation produced in this session (protocol reference, travel log, exploration plan) is arguably more valuable than the code.
