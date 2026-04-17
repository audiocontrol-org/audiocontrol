# Tooling Survey — MESA II Static Disassembly

## 1. Current State Assessment

### Binaries

Two binaries are extracted and ready for disassembly:

- `binaries/sampler-editor-rsrc.bin` — 506,909 bytes. Contains all Sampler Editor 2.3
  68k code as a Mac OS 9 resource fork.
- `binaries/scsi-plug-rsrc.bin` — 12,053 bytes. Contains SCSI Plug 2.1.2 68k code.

### Key File Completeness

**`scsi-plug-SendData.asm`** (file offset 0x0df2–0x121e, 1,068 bytes):
458 lines total, of which 370 are `.word` placeholders and 88 are decoded
instructions. Roughly 19% decoded. The LINK/MOVEM prologue and the dispatch table
constants (file offset 0x0e58–0x0e80: `BOFF`, `SYSX`, `BULK`, `MIDI`, `SRAW`,
`SYSX`) are visible as data. The branch target for the BULK path (`0x0030` from
dispatch base, resolving to around file offset 0x0f20–0x0f80 based on the
scattered `BRA` targets visible) is not decoded. The `BULK` handler is the primary
unknown.

**`sampler-editor-SendAudioBufferToSampler.hex`** (file offset 0x030713–0x030cc9,
1,462 bytes): 96 lines, all hex dump format — no instruction decoding at all.
The raw bytes are present and annotated minimally. The `MOVE.L #'BULK',-(SP)`
push at file offset ~0x0308b0 (`2f 3c 42 55 4c 4b`) and `MOVE.L #'SRAW',-(SP)`
at ~0x030a53 (`2f 3c 53 52 41 57`) are visible in the hex but not decoded. The
sample-loop logic, SDS packet construction calls, and SLNGTH write (if any) are
entirely un-decoded.

**Other sampler-editor `.hex` files** — all are raw hex dumps with no decoded
instructions. They serve as byte references but are not yet analyzed.

**SCSI Plug `.asm` files** for non-BULK functions (BusyCursor, ChooseSCSI, Do,
etc.) are mostly decoded because those functions use only common opcodes the
hand-rolled decoder handles. The `scsi-plug-functions.txt` and
`scsi-plug-dispatch-table.txt` provide a reliable function map and transfer
mode table.

**`scsi-plug-functions.txt`**: Accurate. Eight functions in the 0x1240–0x2a58
range have no name (THINK C name strings not yet resolved for those). The
function boundaries are correct — confirmed by the SCSI-PROTOCOL.md which was
derived from deeper prior analysis.

### Root Cause of the Gaps

`disassemble.py` (331 lines) implements a partial 68k decoder. It handles LINK,
UNLK, RTS, NOP, JSR abs.L, BSR, and a limited subset of MOVEM, MOVE.B/W/L
immediate, PEA, CLR.B, TST.B, BEQ/BNE/BRA, and MOVEQ. It falls back to
`.word $xxxx` for everything else. The 68k instruction set is large and irregular;
the hand-rolled decoder has a low completeness ceiling without substantial
additional work.

---

## 2. What `mesa-plug-harness` Provides

`/Users/orion/work/scsi2pi-work/mesa-plug-harness/` contains:

- `musashi/` — a well-known, complete 68040 emulator (m68kcpu.c, m68kdasm.c,
  m68k_in.c, etc.). Musashi decodes and executes the full 68k ISA, including
  all addressing modes that the hand-rolled decoder misses.
- `harness/main.c` — a 1,177-line C harness that: loads `scsi-plug-rsrc.bin`
  into a 32 MB flat address space at `PLUG_CODE_BASE = 0x010000`; sets up a
  minimal Mac OS 9 environment (trap tables, unit table, low-memory globals);
  intercepts all A-line traps (Mac OS toolbox calls) in C via an instruction
  hook; and forwards `SCSIDispatch` (`$A089`) calls live to scsi2pi at
  `10.0.0.57:6868` via `scsi_bridge_exec`.
- `src/scsi_bridge.cpp` — the live SCSI forwarding layer.
- `Makefile` — builds `s3k-client` from `src/*.cpp`. Note: the harness
  entrypoint is `harness/main.c`, which is separate from the `src/` client and
  has its own build. The Makefile as written only covers the `src/` client, not
  the harness — the harness would need a separate build rule.

**Can it execute the SCSI Plug BULK path?** In principle, yes: the harness
loads the full plug binary, relocates absolute JSR/JMP references
(`+PLUG_CODE_BASE`), handles Mac memory allocation traps (NewPtr, NewHandle),
and has a `run_subroutine(entry, name)` that executes until RTS or cycle limit.
Musashi's built-in disassembler (`m68k_disassemble`) is invoked at each
instruction in the instruction hook, so a trace of every executed instruction
with register state is available.

**What it cannot do without modification:** The harness currently skips the
CSCSIPlug constructor and manually sets two A4-relative flags. It does not yet
set up the `IP_Data` struct (the argument to `SendData`) that represents an SDS
buffer. To trace the BULK path in `SendData`, a caller stub would need to
allocate a realistic `IP_Data` object in emulated memory with the `'BULK'` tag
and a valid audio buffer pointer, then call `SendData` (file offset 0x0df2,
loaded at `0x010000 + 0x0df2 = 0x01df2`). The harness already demonstrates how
to do this (the `run_subroutine` pattern in Phase 2/3).

**`SCSI-PROTOCOL.md`** documents the full CDB reference (all six opcodes with
byte-level layout), the `SCSIExecIO` parameter block structure, and the
complete `SendData` transaction flow. It is the most complete artifact already
produced — it was derived from earlier manual analysis and is reliable.

---

## 3. Disassembler Options

### A. Continue improving `disassemble.py`

Effort to reach 80% decode: high. The 68k has ~100 distinct instruction
encodings many with multiple addressing modes; each gap in the current decoder
requires reading the Motorola 68000 Programmer's Reference Manual and writing a
new branch. The completeness ceiling is whatever you implement — there is no
floor. Upside: output stays in the existing annotated `.asm` format with custom
comments. Downside: significant engineering time before the key BULK path is
readable.

### B. `m68k-elf-objdump`

`m68k-elf-objdump -D -m m68k:68020` decodes the full ISA. The resource fork
binaries are raw code with no ELF wrapper, so a thin wrapper (or `--target
binary`) would be needed. Branch targets will be numeric (no symbols), but all
instructions will decode correctly. Setup time: ~30 minutes to verify the
correct base-address flag (`--adjust-vma`) and produce annotated output.
Upside: no new code, complete ISA coverage. Downside: no Mac-specific
annotations (trap names, function names); branch targets require manual
cross-reference against the existing function maps.

### C. Ghidra

Full decompiler with 68k support, C pseudocode output, cross-reference graph,
and the ability to mark up Mac toolbox traps. Produces the highest-quality
analysis. Downside: requires a separate install (Java-based, ~500 MB), a
learning curve of several hours to configure the memory map and base address
correctly, and the output is not plain text.

### D. radare2 with m68k support

`r2 -a m68k -b 32 -m 0x0000 scsi-plug-rsrc.bin` works for flat binaries.
`r2` has a complete 68k decoder and scriptable analysis via `aaa`. Output is
less readable than Ghidra pseudocode but more automatable. Setup time: ~1 hour.
Intermediate option between objdump and Ghidra.

### E. Musashi harness — dynamic tracing instead of static disassembly

Rather than improving the static decoder, instrument the existing harness to
call `SendData` with a mock `IP_Data` containing `'BULK'` tag and a small audio
buffer, then log every instruction Musashi executes. This produces a linear
trace of exactly what the BULK path does at runtime, including register values
and memory reads. The harness already calls `m68k_disassemble` in its
instruction hook; the log just needs to be enabled for the `SendData` address
range. Zero new tooling required.

---

## 4. Recommendation

**Use the musashi harness for dynamic tracing (Option E).**

It requires the least new infrastructure. The harness already exists, already
loads and relocates the correct binary, and already intercepts all Mac OS traps.
The single missing piece is a caller stub that:

1. Allocates an `IP_Data` struct in emulated memory with `tag = 'BULK'`, a
   sample number, and a pointer to a small synthetic audio buffer.
2. Calls `run_subroutine(0x01df2, "SendData")` (file offset 0x0df2 +
   PLUG_CODE_BASE).
3. Widens the instruction trace range in `plug_instruction_hook` to cover the
   full `SendData` body (0x010df2–0x01121e).

This will produce a complete execution trace showing every instruction the BULK
path executes, every SCSI CDB dispatched (already logged via the `$A089`
handler), and the exact byte sequences written to the device — directly
answering the SLNGTH question.

**Concrete first steps:**

1. Build the harness: add a Makefile rule for `harness/main.c` linking against
   `musashi/` and `src/scsi_bridge.cpp`.
2. Determine the `IP_Data` struct layout from the Sampler Editor source context
   (field at offset `+0x0B` checked by `TST.B` at 0x0e9e in SendData, field at
   `+0x0E3C` used as the SDS buffer pointer).
3. Add a Phase 4 block in `main.c` that constructs `IP_Data`, pushes it as
   argument, and calls `run_subroutine` on `SendData`.
4. Redirect `SCSIDispatch` forwarding to a local mock if hardware is not
   available (return success + empty read buffer), so the trace can run
   offline.

If the harness hits an insurmountable blocker (e.g., a required Mac toolbox
call the harness doesn't stub), fall back to `m68k-elf-objdump` with
`--adjust-vma` to get a static full decode of `scsi-plug-rsrc.bin` and
`sampler-editor-rsrc.bin` as a reference, then annotate by hand.
