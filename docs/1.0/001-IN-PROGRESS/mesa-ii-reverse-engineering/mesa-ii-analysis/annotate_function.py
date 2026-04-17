#!/usr/bin/env python3
"""
Disassemble a 68k function from a raw binary using m68k-elf-objdump
and annotate with THINK C name strings.

Usage:
  python3 annotate_function.py <binary> <start_offset_hex> <end_offset_hex> [output_file]

Example:
  python3 annotate_function.py binaries/sampler-editor-rsrc.bin 0x030713 0x030cc6 \
    disassembly-full/SendAudioBufferToSampler.annotated.txt
"""

import sys
import os
import re
import struct
import subprocess
import tempfile

OBJDUMP = '/opt/homebrew/bin/m68k-elf-objdump'

# The sampler-editor-rsrc.bin contains a Mac EDIT-type resource.
# The EDIT code data starts at file offset 0x027f57 (after 4-byte length header
# at 0x027f53). The absolute JSR addresses in the code are relative to this base.
# To convert: file_offset = EDIT_CODE_BASE + absolute_jsr_addr
SAMPLER_EDIT_CODE_BASE = 0x027f57

# ---------------------------------------------------------------------------
# THINK C name string extraction
# ---------------------------------------------------------------------------
# After UNLK A6 / RTS (4e 5e 4e 75), THINK C emits a length byte with
# high bit set (0x80 + length), followed by the mangled name string.

def read_thinkc_name(data, j):
    """
    Read a THINK C Pascal-style name string starting at offset j.
    Two encodings:
      1. Single byte with high bit set: 0x80|len, then len bytes of name
         (works for names up to 127 chars, but only if len != 0)
      2. Two-byte: 0x80 (as sentinel marker, low 7 = 0), then a plain
         length byte, then len bytes of name
         (used when name > 63 chars or len would have high bit clear)
    Returns (name, consumed_bytes) or (None, 0) on failure.
    """
    if j >= len(data):
        return None, 0
    b0 = data[j]
    if not (b0 & 0x80):
        return None, 0

    name_len = b0 & 0x7f
    if name_len == 0:
        # Two-byte form: next byte is the actual length
        if j + 1 >= len(data):
            return None, 0
        name_len = data[j + 1]
        name_start = j + 2
    else:
        name_start = j + 1

    if name_len == 0 or name_start + name_len > len(data):
        return None, 0

    try:
        name = data[name_start:name_start + name_len].decode('ascii', errors='replace')
        # Filter: must contain only printable identifier chars
        if not all(c.isalnum() or c in '_:' for c in name):
            return None, 0
        return name, name_start + name_len - j
    except Exception:
        return None, 0


def find_thinkc_names(binary_bytes):
    """
    Scan binary for THINK C name strings: 4e 5e 4e 75 <length_byte(s)> <name...>
    Returns dict: function_name -> list of approximate end-of-function offsets.
    Also returns offset_to_name: abs_offset_of_UNLK -> name.
    """
    names = {}
    offset_to_name = {}
    i = 0
    data = binary_bytes
    while i < len(data) - 6:
        # Look for UNLK A6 / RTS
        if data[i] == 0x4e and data[i+1] == 0x5e and data[i+2] == 0x4e and data[i+3] == 0x75:
            j = i + 4
            # May be padding NOPs (4e 71) or directly the length byte
            while j + 1 < len(data) and data[j] == 0x4e and data[j+1] == 0x71:
                j += 2
            name, _ = read_thinkc_name(data, j)
            if name:
                if name not in names:
                    names[name] = []
                names[name].append(i)
                offset_to_name[i] = name   # keyed by UNLK offset
            i += 4
        else:
            i += 1
    return names, offset_to_name

def find_function_starts(binary_bytes, offset_to_name):
    """
    For each named function (keyed by UNLK A6 offset), find the corresponding
    LINK A6 (4e 56 xx xx) that precedes it.  Scan backwards from the UNLK.
    Returns dict: link_offset -> name
    """
    data = binary_bytes
    link_to_name = {}
    for unlk_off, name in offset_to_name.items():
        # Search backwards for LINK A6 (4e 56)
        # Don't scan more than ~8 KB back
        limit = max(0, unlk_off - 0x2000)
        found = False
        for j in range(unlk_off - 2, limit, -2):
            if j >= 0 and data[j] == 0x4e and data[j+1] == 0x56:
                link_to_name[j] = name
                found = True
                break
        # If no LINK found (leaf function), just mark the UNLK offset
        if not found:
            link_to_name[unlk_off] = name
    return link_to_name

# ---------------------------------------------------------------------------
# Disassemble a byte range
# ---------------------------------------------------------------------------

def disassemble_range(binary_path, start, end):
    """
    Extract bytes [start, end) from binary_path, disassemble with objdump,
    return list of (offset, raw_bytes_hex, mnemonic, operands) tuples.
    """
    with open(binary_path, 'rb') as f:
        f.seek(start)
        chunk = f.read(end - start)

    with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as tmp:
        tmp.write(chunk)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [OBJDUMP, '-D', '-b', 'binary', '-m', 'm68k:68020',
             f'--adjust-vma={start}', tmp_path],
            capture_output=True, text=True, timeout=30
        )
        return result.stdout, result.stderr
    finally:
        os.unlink(tmp_path)

# ---------------------------------------------------------------------------
# Parse objdump output
# ---------------------------------------------------------------------------

LINE_RE = re.compile(
    r'^\s+([0-9a-f]+):\s+((?:[0-9a-f]{2} ?)+)\s+(.+)$'
)

def parse_objdump(text):
    """
    Parse objdump output.
    Returns list of (offset_int, raw_hex, full_instruction_str).
    """
    insns = []
    for line in text.splitlines():
        m = LINE_RE.match(line)
        if m:
            offset = int(m.group(1), 16)
            raw = m.group(2).strip()
            insn = m.group(3).strip()
            insns.append((offset, raw, insn))
    return insns

# ---------------------------------------------------------------------------
# JSR/BSR target extraction
# ---------------------------------------------------------------------------

JSR_ABS_RE = re.compile(r'jsr\s+0x([0-9a-f]+)')
BSR_RE = re.compile(r'bsrs?\s+0x([0-9a-f]+)')
JMP_ABS_RE = re.compile(r'jmp\s+0x([0-9a-f]+)')
BRA_RE = re.compile(r'bras?\s+0x([0-9a-f]+)|bral\s+0x([0-9a-f]+)')

def extract_call_target(insn_str):
    """Return target offset if this is a JSR/BSR, else None."""
    m = JSR_ABS_RE.search(insn_str.lower())
    if m:
        return int(m.group(1), 16)
    m = BSR_RE.search(insn_str.lower())
    if m:
        return int(m.group(1), 16)
    return None

# ---------------------------------------------------------------------------
# THINK C name demangling (light)
# ---------------------------------------------------------------------------

def demangle(name):
    """
    Light demangler for THINK C mangled names.
    e.g. SendAudioBufferToSampler__14CSamplerModuleFP16MESAAudioHeader2
    -> SendAudioBufferToSampler (CSamplerModule::)(MESAAudioHeader2*)
    Just strip the __NN... suffix for readability.
    """
    if '__' in name:
        base, rest = name.split('__', 1)
        # strip leading digits from class name
        m = re.match(r'^(\d+)(.+)$', rest)
        if m:
            cls = m.group(2)
            return f'{cls}::{base}'
        return f'{base}'
    return name

# ---------------------------------------------------------------------------
# Annotations
# ---------------------------------------------------------------------------

KNOWN_TAGS = {
    0x42554c4b: 'BULK',
    0x53524157: 'SRAW',
    0x53595358: 'SYSX',
    0x424f4646: 'BOFF',
    0x4d494449: 'MIDI',
    0x55505247: 'UPRG',
    0x4b505247: 'KPRG',
    0x55414c4c: 'UALL',
}

def decode_tag(val_str):
    """Try to decode a 32-bit immediate as a 4-char tag."""
    try:
        val = int(val_str, 16) if val_str.startswith('0x') else int(val_str, 16)
        if val in KNOWN_TAGS:
            return KNOWN_TAGS[val]
    except Exception:
        pass
    return None

RUNTIME_FUNCS = {
    0x000116: '__divsi3 (32-bit signed divide, D0/D1 -> D0)',
    0x0001a6: '__mulsi3 (32-bit multiply, D0*D1 -> D0)',
    0x0464aa: 'UExtractFromAEDesc::TheInt32 (entry mid-function, file:0x06e401)',
    0x046664: 'UExtractFromAEDesc::TheInt32 (LINK entry, file:0x06e5bb)',
}

VTABLE_OFFSETS = {
    0x0014: 'SendData (SCSI Plug vtable, tag/arg3/arg2/arg1)',
    0x0028: 'SomeCall (vtable +0x28)',
    0x0030: 'SetSampleHeader (vtable +0x30, SDS dump header opcode 0x01)',
    0x0a20: 'SendProgressUpdate (vtable +0xa20, pushes IP_Data with UPRG/KPRG tag)',
}


def annotate_line(offset, raw_hex, insn_str, link_to_name, all_names_by_offset,
                  code_base=None):
    """
    Return an annotation string for a disassembly line, or empty string.
    code_base: if provided, resolve absolute JSR addresses via file_offset = code_base + jsr_addr
    """
    annotations = []

    insn_lower = insn_str.lower()

    # Check for tag pushes: movel #0xXXXXXXXX,%sp@-
    tag_match = re.search(r'movel?\s+#(0x[0-9a-f]+|[0-9]+)', insn_lower)
    if tag_match:
        try:
            val = int(tag_match.group(1), 16) if '0x' in tag_match.group(1) else int(tag_match.group(1))
            if val in KNOWN_TAGS:
                annotations.append(f'TAG={KNOWN_TAGS[val]}')
        except Exception:
            pass

    # SDS dump header opcode push: moveb #1,... (SDS dump header = 0x01)
    if re.search(r'moveb?\s+#1[^0-9]', insn_lower) or re.search(r'movew?\s+#0x0100', insn_lower):
        # Look for byte push to stack
        if '-(sp)' in insn_lower or 'sp@-' in insn_lower or 'sp@' in insn_lower:
            annotations.append('SDS-OPCODE-PUSH (opcode=0x01 = SDS dump header)')

    # JSR/BSR targets
    target = extract_call_target(insn_str)
    if target is not None:
        # Check runtime functions first
        if target in RUNTIME_FUNCS:
            annotations.append(f'-> {RUNTIME_FUNCS[target]}')
        else:
            # Translate absolute JSR address to file offset via code_base
            file_target = (code_base + target) if code_base is not None else target
            callee = None
            for k in sorted(link_to_name.keys()):
                if abs(k - file_target) <= 4:
                    callee = link_to_name[k]
                    break
            if callee:
                annotations.append(f'-> {demangle(callee)}')
            else:
                annotations.append(f'-> 0x{target:06x}/file:0x{file_target:06x} (name unknown)')

    # Vtable call annotations: jsr %a0@ or jsr %a1@
    if re.search(r'jsr\s+%a[0-9]@$', insn_lower):
        # We can't easily know vtable offset from the instruction itself,
        # but we can note that this is a vtable dispatch
        annotations.append('vtable dispatch (indirect)')

    return '  ; ' + ', '.join(annotations) if annotations else ''

# ---------------------------------------------------------------------------
# Callee extraction for call graph
# ---------------------------------------------------------------------------

def extract_callees(insns, link_to_name, code_base=None):
    """Return list of (call_offset, jsr_target, file_target, callee_name_or_None) for all JSR/BSR."""
    callees = []
    seen = set()
    for offset, raw, insn in insns:
        target = extract_call_target(insn)
        if target is not None and target not in seen:
            seen.add(target)
            file_target = (code_base + target) if code_base is not None else target
            # Check runtime funcs first
            if target in RUNTIME_FUNCS:
                callees.append((offset, target, file_target, RUNTIME_FUNCS[target]))
                continue
            callee = None
            for k in sorted(link_to_name.keys()):
                if abs(k - file_target) <= 4:
                    callee = link_to_name[k]
                    break
            callees.append((offset, target, file_target, callee))
    return callees

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    binary_path = sys.argv[1]
    start = int(sys.argv[2], 16)
    end = int(sys.argv[3], 16)
    output_path = sys.argv[4] if len(sys.argv) > 4 else None

    print(f'Loading binary {binary_path}...')
    with open(binary_path, 'rb') as f:
        binary_bytes = f.read()

    print(f'Scanning for THINK C name strings...')
    names, offset_to_name = find_thinkc_names(binary_bytes)
    print(f'  Found {len(names)} distinct function names')

    print(f'Finding function start addresses (LINK A6)...')
    link_to_name = find_function_starts(binary_bytes, offset_to_name)
    print(f'  Mapped {len(link_to_name)} function starts')

    # Find name of target function from its LINK offset
    func_name = link_to_name.get(start, 'unknown')
    print(f'Target function at 0x{start:06x}: {demangle(func_name)}')

    print(f'Disassembling 0x{start:06x} - 0x{end:06x} ({end-start} bytes)...')
    raw_output, stderr = disassemble_range(binary_path, start, end)
    if stderr.strip():
        print(f'  objdump stderr: {stderr[:200]}')

    insns = parse_objdump(raw_output)
    print(f'  Decoded {len(insns)} instructions/data words')

    # Build annotated output
    lines = []
    lines.append(f'; ============================================================')
    lines.append(f'; Function: {demangle(func_name)}')
    lines.append(f';   Mangled: {func_name}')
    lines.append(f';   File offset: 0x{start:06x} - 0x{end:06x} ({end-start} bytes)')
    lines.append(f';   Binary: {os.path.basename(binary_path)}')
    lines.append(f'; ============================================================')
    lines.append('')

    # Detect code base if binary matches the sampler editor
    code_base = None
    if 'sampler-editor' in os.path.basename(binary_path):
        code_base = SAMPLER_EDIT_CODE_BASE

    for offset, raw, insn in insns:
        insn_lower = insn.lower()

        # Build annotation
        ann = annotate_line(offset, raw, insn, link_to_name, offset_to_name,
                            code_base=code_base)

        # Known anchor markers
        anchor = ''
        if re.search(r'movel?\s+#0x42554c4b', insn_lower):
            anchor = '  ; *** ANCHOR: MOVE.L #BULK,-(SP) ***'
        elif re.search(r'movel?\s+#0x53524157', insn_lower):
            anchor = '  ; *** ANCHOR: MOVE.L #SRAW,-(SP) ***'
        elif re.search(r'movel?\s+#0x55505247', insn_lower):
            anchor = '  ; *** ANCHOR: MOVE.L #UPRG,-(SP) ***'
        elif re.search(r'movel?\s+#0x4b505247', insn_lower):
            anchor = '  ; *** ANCHOR: MOVE.L #KPRG,-(SP) ***'
        elif re.search(r'movel?\s+#0x424f4646', insn_lower):
            anchor = '  ; *** ANCHOR: MOVE.L #BOFF,-(SP) ***'
        elif re.search(r'movel?\s+#0x55414c4c', insn_lower):
            anchor = '  ; UALL tag push'

        # Check for 0x01 byte push to stack (SDS dump header opcode)
        sds_marker = ''
        if ('0x1' in insn or '#1,' in insn or '#0x1,' in insn) and ('sp@-' in insn_lower or '-(sp)' in insn_lower):
            # More precise: moveb #1 to stack or movel with low byte 1
            if re.search(r'moveb?\s+#0x1[,\s]', insn_lower) or re.search(r'movew?\s+#0x1[,\s]', insn_lower):
                sds_marker = '  ; *** SDS dump header opcode push (0x01) ***'

        annotation = anchor or sds_marker or ann
        raw_padded = raw.ljust(20)
        line = f'  {offset:06x}:  {raw_padded}  {insn}{annotation}'
        lines.append(line)

    # Call graph summary
    callees = extract_callees(insns, link_to_name, code_base=code_base)
    lines.append('')
    lines.append('; ============================================================')
    lines.append('; CALL GRAPH (all JSR/BSR targets)')
    lines.append('; ============================================================')
    for call_offset, target, file_target, callee_name in callees:
        if callee_name:
            lines.append(f';   0x{call_offset:06x}  jsr 0x{target:06x} (file:0x{file_target:06x})  ->  {demangle(callee_name)}')
        else:
            lines.append(f';   0x{call_offset:06x}  jsr 0x{target:06x} (file:0x{file_target:06x})  ->  (name not found)')

    # Print nearby function names for context
    lines.append('')
    lines.append('; ============================================================')
    lines.append('; NEARBY FUNCTIONS (within 0x5000 of target range)')
    lines.append('; ============================================================')
    for k in sorted(link_to_name.keys()):
        if abs(k - start) < 0x5000:
            lines.append(f';   0x{k:06x}  {demangle(link_to_name[k])}  [{link_to_name[k]}]')

    text = '\n'.join(lines) + '\n'

    if output_path:
        with open(output_path, 'w') as f:
            f.write(text)
        print(f'Written to {output_path}')
    else:
        print(text)

if __name__ == '__main__':
    main()
