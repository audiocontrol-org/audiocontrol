#!/usr/bin/env python3
"""
Disassemble key functions from MESA II Sampler Editor and SCSI Plug.

Outputs annotated hex dumps with 68k instruction decoding for the functions
relevant to sample upload. Run from the mesa-ii-analysis directory.

Usage:
    python3 disassemble.py
"""

import struct
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLER_EDITOR = os.path.join(SCRIPT_DIR, 'binaries', 'sampler-editor-rsrc.bin')
SCSI_PLUG = os.path.join(SCRIPT_DIR, 'binaries', 'scsi-plug-rsrc.bin')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'disassembly')

# ---------------------------------------------------------------------------
# 68k instruction decoder (subset — enough for analysis)
# ---------------------------------------------------------------------------

def decode_68k(data: bytes, offset: int, base_addr: int) -> tuple[str, int]:
    """Decode one 68k instruction. Returns (mnemonic, byte_count)."""
    if offset + 2 > len(data):
        return ('???', 2)

    word = struct.unpack_from('>H', data, offset)[0]

    # LINK A6,#xx
    if word == 0x4E56:
        if offset + 4 <= len(data):
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            return (f'LINK    A6,#${disp & 0xFFFF:04X} ({disp})', 4)

    # UNLK A6
    if word == 0x4E5E:
        return ('UNLK    A6', 2)

    # RTS
    if word == 0x4E75:
        return ('RTS', 2)

    # NOP
    if word == 0x4E71:
        return ('NOP', 2)

    # JSR abs.L
    if word == 0x4EB9:
        if offset + 6 <= len(data):
            target = struct.unpack_from('>I', data, offset + 2)[0]
            return (f'JSR     ${target:08X}', 6)

    # BSR.W
    if (word & 0xFF00) == 0x6100:
        disp = struct.unpack_from('>h', data, offset + 2)[0] if (word & 0xFF) == 0 else struct.unpack_from('>b', data, offset + 1)[0]
        size = 4 if (word & 0xFF) == 0 else 2
        target = base_addr + offset + 2 + (struct.unpack_from('>h', data, offset + 2)[0] if size == 4 else (word & 0xFF) if (word & 0xFF) < 0x80 else (word & 0xFF) - 256)
        return (f'BSR     ${target:06X}', size)

    # MOVE.L #imm,-(SP) = 2F3C xxxx xxxx
    if word == 0x2F3C:
        if offset + 6 <= len(data):
            imm = struct.unpack_from('>I', data, offset + 2)[0]
            ascii_repr = ''
            try:
                chars = imm.to_bytes(4, 'big')
                if all(32 <= c < 127 for c in chars):
                    ascii_repr = f'  ; "{chars.decode()}"'
            except:
                pass
            return (f'MOVE.L  #${imm:08X},-(SP){ascii_repr}', 6)

    # MOVE.B #xx,-(SP) = 1F3C 00xx
    if word == 0x1F3C:
        if offset + 4 <= len(data):
            val = data[offset + 3]
            comment = ''
            if val == 0x01: comment = '  ; SDS Dump Header'
            elif val == 0x02: comment = '  ; SDS Data Packet'
            elif val == 0x0A: comment = '  ; RSDATA'
            elif val == 0x0B: comment = '  ; SDATA'
            elif val == 0x0C: comment = '  ; RSPACK'
            elif val == 0x0D: comment = '  ; ASPACK'
            elif val == 0x04: comment = '  ; RSLIST'
            return (f'MOVE.B  #${val:02X},-(SP){comment}', 4)

    # MOVE.W #imm,-(SP) = 3F3C xxxx
    if word == 0x3F3C:
        if offset + 4 <= len(data):
            val = struct.unpack_from('>H', data, offset + 2)[0]
            return (f'MOVE.W  #${val:04X},-(SP) (={val})', 4)

    # CLR.L -(SP) = 42A7
    if word == 0x42A7:
        return ('CLR.L   -(SP)', 2)

    # CLR.B -(SP) = 4227
    if word == 0x4227:
        return ('CLR.B   -(SP)', 2)

    # CLR.W -(SP) = 4267
    if word == 0x4267:
        return ('CLR.W   -(SP)', 2)

    # PEA $xxxx.W = 4878 xxxx
    if word == 0x4878:
        if offset + 4 <= len(data):
            val = struct.unpack_from('>H', data, offset + 2)[0]
            return (f'PEA     ${val:04X}.W (={val})', 4)

    # PEA abs.L = 4879 xxxx xxxx
    if word == 0x4879:
        if offset + 6 <= len(data):
            val = struct.unpack_from('>I', data, offset + 2)[0]
            return (f'PEA     ${val:08X}.L', 6)

    # PEA d(An) = 4868+reg xxxx (A0-A7)
    if (word & 0xFFF8) == 0x4868:
        if offset + 4 <= len(data):
            reg = word & 7
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            return (f'PEA     {disp}(A{reg})', 4)

    # MOVE.L d(An),-(SP) = 2F28+... complex
    if word == 0x2F28:
        if offset + 4 <= len(data):
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            return (f'MOVE.L  {disp}(A0),-(SP)', 4)

    # MOVEA.L d(A6),An = 206E/226E/246E/266E/286E/2A6E/2C6E/2E6E + disp
    if (word & 0xF1FF) == 0x206E:
        if offset + 4 <= len(data):
            reg = (word >> 9) & 7
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            return (f'MOVEA.L {disp}(A6),A{reg}', 4)

    # MOVE.L d(An),D0 etc — too many variants, skip

    # BRA.W = 6000 xxxx
    if word == 0x6000:
        if offset + 4 <= len(data):
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            target = base_addr + offset + 2 + disp
            return (f'BRA     ${target:06X}', 4)

    # BEQ.W = 6700 xxxx
    if word == 0x6700:
        if offset + 4 <= len(data):
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            target = base_addr + offset + 2 + disp
            return (f'BEQ     ${target:06X}', 4)

    # BNE.W = 6600 xxxx
    if word == 0x6600:
        if offset + 4 <= len(data):
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            target = base_addr + offset + 2 + disp
            return (f'BNE     ${target:06X}', 4)

    # TST.B d(An) = 4A28+reg xxxx (for 4A2A = TST.B d(A2) etc)
    if (word & 0xFFF8) == 0x4A28:
        if offset + 4 <= len(data):
            reg = word & 7
            disp = struct.unpack_from('>h', data, offset + 2)[0]
            return (f'TST.B   {disp}(A{reg})', 4)

    # MOVEM = 48E7 (save) / 4CDF (restore)
    if word == 0x48E7:
        if offset + 4 <= len(data):
            mask = struct.unpack_from('>H', data, offset + 2)[0]
            return (f'MOVEM.L #{mask:04X},-(SP)', 4)
    if word == 0x4CDF:
        if offset + 4 <= len(data):
            mask = struct.unpack_from('>H', data, offset + 2)[0]
            return (f'MOVEM.L (SP)+,#{mask:04X}', 4)

    # JSR via vtable: MOVE.L (An),An then JSR (An)
    # 4E91 = JSR (A1) — common vtable call
    if word == 0x4E91:
        return ('JSR     (A1)  ; vtable call', 2)
    if word == 0x4E90:
        return ('JSR     (A0)', 2)

    # Fallback: show raw word
    return (f'.word   ${word:04X}', 2)


def disassemble_function(data: bytes, start: int, end: int, base_addr: int = 0) -> str:
    """Disassemble a range of bytes as 68k code."""
    lines = []
    offset = start
    while offset < end:
        mnemonic, size = decode_68k(data, offset, base_addr)
        addr = base_addr + offset if base_addr else offset
        raw = ' '.join(f'{data[offset + i]:02x}' for i in range(min(size, 6)))
        lines.append(f'  {addr:06x}: {raw:<18s} {mnemonic}')
        offset += size
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Find function boundaries by scanning for THINK C name strings
# ---------------------------------------------------------------------------

def find_functions(data: bytes) -> list[dict]:
    """Find all THINK C functions by scanning for name strings after RTS."""
    functions = []
    i = 0
    while i < len(data) - 6:
        # Look for UNLK A6 (4E5E) + RTS (4E75) + length byte (high bit set)
        if data[i] == 0x4E and data[i+1] == 0x5E and data[i+2] == 0x4E and data[i+3] == 0x75:
            if i + 4 < len(data) and (data[i+4] & 0x80):
                name_len = data[i+4] & 0x7F
                if i + 5 + name_len <= len(data):
                    name = data[i+5:i+5+name_len].decode('ascii', errors='replace')
                    # Search backwards for LINK A6
                    func_end = i + 4  # includes UNLK+RTS
                    func_start = None
                    for j in range(i, max(i - 8192, 0), -2):
                        if data[j] == 0x4E and data[j+1] == 0x56:
                            func_start = j
                            break
                    if func_start is not None:
                        functions.append({
                            'name': name,
                            'start': func_start,
                            'end': func_end,
                            'size': func_end - func_start,
                        })
        i += 2
    return functions


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --- Sampler Editor ---
    with open(SAMPLER_EDITOR, 'rb') as f:
        se_data = f.read()

    print(f'Sampler Editor: {len(se_data)} bytes')
    se_functions = find_functions(se_data)
    print(f'Found {len(se_functions)} functions')

    # Write function index
    with open(os.path.join(OUTPUT_DIR, 'sampler-editor-functions.txt'), 'w') as f:
        f.write('# Sampler Editor 2.3 — Function Index\n')
        f.write(f'# Source: sampler-editor-rsrc.bin ({len(se_data)} bytes)\n\n')
        for func in sorted(se_functions, key=lambda x: x['start']):
            f.write(f'0x{func["start"]:06x} - 0x{func["end"]:06x}  ({func["size"]:5d} bytes)  {func["name"]}\n')

    # Disassemble key functions
    targets = [
        'SendAudioBufferToSampler',
        'SendAudioFileToSampler',
        'GetSampleData',
        'BuildSampleDataRequest',
        'ImportSampleData',
        'ExportSampleData',
        'SendExclusiveCommand',
    ]

    for func in se_functions:
        short_name = func['name'].split('__')[0] if '__' in func['name'] else func['name']
        if any(t in func['name'] for t in targets):
            filename = f'sampler-editor-{short_name}.asm'
            filepath = os.path.join(OUTPUT_DIR, filename)
            with open(filepath, 'w') as f:
                f.write(f'; {func["name"]}\n')
                f.write(f'; File offset: 0x{func["start"]:06x} - 0x{func["end"]:06x} ({func["size"]} bytes)\n')
                f.write(f'; Source: sampler-editor-rsrc.bin\n\n')
                f.write(disassemble_function(se_data, func['start'], func['end']))
                f.write('\n')
            print(f'  Wrote {filepath}')

    # --- SCSI Plug ---
    with open(SCSI_PLUG, 'rb') as f:
        sp_data = f.read()

    print(f'\nSCSI Plug: {len(sp_data)} bytes')
    sp_functions = find_functions(sp_data)
    print(f'Found {len(sp_functions)} functions')

    # Write function index
    with open(os.path.join(OUTPUT_DIR, 'scsi-plug-functions.txt'), 'w') as f:
        f.write('# SCSI Plug 2.1.2 — Function Index\n')
        f.write(f'# Source: scsi-plug-rsrc.bin ({len(sp_data)} bytes)\n')
        f.write(f'# A4 data base: file offset $2BD2\n')
        f.write(f'# Address mapping: file_offset = abs_addr + $061E\n\n')
        for func in sorted(sp_functions, key=lambda x: x['start']):
            f.write(f'0x{func["start"]:04x} - 0x{func["end"]:04x}  ({func["size"]:5d} bytes)  {func["name"]}\n')

    # Disassemble all SCSI Plug functions (it's small — only 12KB)
    for func in sp_functions:
        short_name = func['name'].split('__')[0] if '__' in func['name'] else func['name']
        filename = f'scsi-plug-{short_name}.asm'
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, 'w') as f:
            f.write(f'; {func["name"]}\n')
            f.write(f'; File offset: 0x{func["start"]:04x} - 0x{func["end"]:04x} ({func["size"]} bytes)\n')
            f.write(f'; Source: scsi-plug-rsrc.bin\n\n')
            f.write(disassemble_function(sp_data, func['start'], func['end']))
            f.write('\n')
        print(f'  Wrote {filepath}')

    # --- Dispatch table dump ---
    with open(os.path.join(OUTPUT_DIR, 'scsi-plug-dispatch-table.txt'), 'w') as f:
        f.write('# SCSI Plug Transfer Mode Dispatch Table\n')
        f.write('# File offset: 0x0e58\n\n')
        f.write('# Format: 4-char tag + 2-byte offset\n\n')
        offset = 0x0e58
        while offset + 6 <= len(sp_data):
            tag = sp_data[offset:offset+4]
            if not all(32 <= b < 127 for b in tag):
                break
            val = struct.unpack_from('>H', sp_data, offset + 4)[0]
            f.write(f'0x{offset:04x}: "{tag.decode()}" → 0x{val:04X}\n')
            offset += 6
        print(f'  Wrote scsi-plug-dispatch-table.txt')

    print(f'\nAll output in: {OUTPUT_DIR}/')


if __name__ == '__main__':
    main()
