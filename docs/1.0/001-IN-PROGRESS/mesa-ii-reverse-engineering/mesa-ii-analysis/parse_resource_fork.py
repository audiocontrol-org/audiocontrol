"""
parse_resource_fork.py - Parse Mac OS resource fork from MESA-II.dataonly
Enumerates all CODE resources and resolves the runtime address 0x1E5A.
"""
import struct
import sys

MESA_PATH = '/Users/orion/work/audiocontrol-work/audiocontrol-mesa-ii-reverse-engineering/docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/mesa-ii-analysis/binaries-large/extracted/MESA-II.dataonly'

def read_u32(data, offset):
    return struct.unpack_from('>I', data, offset)[0]

def read_u16(data, offset):
    return struct.unpack_from('>H', data, offset)[0]

def read_u8(data, offset):
    return data[offset]

def parse_resource_fork(data):
    data_offset = read_u32(data, 0)
    map_offset  = read_u32(data, 4)
    data_size   = read_u32(data, 8)
    map_size    = read_u32(data, 12)

    print(f"Resource Fork Header:")
    print(f"  data_offset = 0x{data_offset:08x}")
    print(f"  map_offset  = 0x{map_offset:08x}")
    print(f"  data_size   = 0x{data_size:08x}")
    print(f"  map_size    = 0x{map_size:08x}")
    print()

    # Resource map
    map_base = map_offset
    # bytes 0-15: copy of header (reserved)
    # bytes 16-23: reserved
    # bytes 24-25: file attributes
    file_attrs = read_u16(data, map_base + 24)
    # bytes 26-27: type list offset relative to map_base
    type_list_off = read_u16(data, map_base + 26)
    # bytes 28-29: name list offset relative to map_base
    name_list_off = read_u16(data, map_base + 28)

    print(f"Resource Map at file 0x{map_base:x}:")
    print(f"  file_attrs      = 0x{file_attrs:04x}")
    print(f"  type_list_off   = 0x{type_list_off:04x}  (absolute: 0x{map_base + type_list_off:x})")
    print(f"  name_list_off   = 0x{name_list_off:04x}  (absolute: 0x{map_base + name_list_off:x})")
    print()

    # Type list: at map_base + type_list_off
    type_list_abs = map_base + type_list_off
    num_types = read_u16(data, type_list_abs) + 1  # stored as count - 1
    print(f"Number of resource types: {num_types}")
    print()

    resources = {}  # type_code -> list of (id, attrs, data_off_from_data_section, size, name_off)

    for t in range(num_types):
        te_base = type_list_abs + 2 + t * 8
        type_bytes = data[te_base:te_base+4]
        try:
            type_str = type_bytes.decode('mac_roman')
        except Exception:
            type_str = type_bytes.hex()
        count_m1 = read_u16(data, te_base + 4)
        count = count_m1 + 1
        reflist_off = read_u16(data, te_base + 6)  # relative to type_list_abs
        reflist_abs = type_list_abs + reflist_off

        resource_list = []
        for r in range(count):
            re_base = reflist_abs + r * 12
            res_id = struct.unpack_from('>h', data, re_base)[0]  # signed 16-bit
            name_off = read_u16(data, re_base + 2)  # 0xFFFF = no name
            # byte 4: attributes; bytes 5-7: data offset from data section (3 bytes, big-endian)
            attrs = read_u8(data, re_base + 4)
            d_off = (read_u8(data, re_base + 5) << 16) | (read_u8(data, re_base + 6) << 8) | read_u8(data, re_base + 7)
            # size is 4-byte length prefix at data_offset + d_off
            abs_data = data_offset + d_off
            size = read_u32(data, abs_data)
            resource_list.append({
                'id': res_id,
                'attrs': attrs,
                'data_off': d_off,       # offset within data section
                'abs_off': abs_data + 4, # file offset of resource content
                'size': size,
                'name_off': name_off,
            })

        resources[type_str] = resource_list

    return resources, data_offset, map_offset

def main():
    with open(MESA_PATH, 'rb') as f:
        data = f.read()

    resources, data_offset, map_offset = parse_resource_fork(data)

    # Print all resource types with counts
    print("=== ALL RESOURCE TYPES ===")
    for rtype, rlist in sorted(resources.items()):
        print(f"  '{rtype}': {len(rlist)} resource(s)")
    print()

    # Print CODE resources in detail
    if 'CODE' in resources:
        print("=== CODE RESOURCES ===")
        print(f"{'ID':>6}  {'file_offset':>12}  {'size':>8}  {'data_sec_off':>12}")
        for r in sorted(resources['CODE'], key=lambda x: x['id']):
            print(f"  {r['id']:>4}  0x{r['abs_off']:08x}  0x{r['size']:06x}  0x{r['data_off']:08x}")
        print()

        # CODE 0 is the jump table (A5-relative segment loader)
        # CODE 1, 2, ... are the actual code segments
        # Try to figure out which CODE segment contains runtime address 0x1E5A

        target_runtime = 0x1E5A
        print(f"=== RESOLVING RUNTIME ADDRESS 0x{target_runtime:04x} ===")
        print()

        # Parse CODE 0 to understand the jump table
        code0 = None
        for r in resources['CODE']:
            if r['id'] == 0:
                code0 = r
                break

        if code0:
            print(f"CODE 0 (jump table) at file 0x{code0['abs_off']:x}, size 0x{code0['size']:x}")
            jt_data = data[code0['abs_off']: code0['abs_off'] + code0['size']]
            # CODE 0 header: 4 bytes above-A5 size, 4 bytes below-A5 size
            # Then jump table entries: 2-byte offset + 4-byte jump (0x3F3C segnum A9F0 = far) or 2+2+2 (near)
            above_a5 = struct.unpack_from('>I', jt_data, 0)[0]
            below_a5 = struct.unpack_from('>I', jt_data, 4)[0]
            jt_off_from_a5 = struct.unpack_from('>I', jt_data, 8)[0]  # offset of jump table from A5
            num_entries = struct.unpack_from('>I', jt_data, 12)[0]
            print(f"  above_a5       = 0x{above_a5:x}")
            print(f"  below_a5       = 0x{below_a5:x}")
            print(f"  jt_off_from_a5 = 0x{jt_off_from_a5:x} (jump table is at A5 + 0x{jt_off_from_a5:x})")
            print(f"  num_entries    = {num_entries} (0x{num_entries:x})")

            # Jump table starts at code0['abs_off'] + 16 bytes header
            # Each entry is 8 bytes: 2-byte offset-within-segment + 6-byte jump instruction
            jt_entry_base = 16
            print()
            print("  Jump table entries (first 30):")
            print(f"  {'entry':>5}  {'jt_offset':>10}  {'seg_off':>8}  {'instr_bytes':>20}")

            # The jump table in CODE 0 resides at a specific A5-relative address.
            # When the app is loaded, A5 is set up so that the jump table is at A5 + jt_off_from_a5.
            # The runtime address of jump table entry N (0-based) is:
            #   jt_base_runtime = A5 + jt_off_from_a5
            #   entry_N_runtime = jt_base_runtime + N * 8
            # But we don't know A5. However, each CODE segment's base address in memory is
            # determined by when it's loaded by the Segment Loader.
            # The classic approach: CODE 1 is always loaded first and its first byte is at
            # some address. The jump table offsets tell us the offset within the segment.
            # We need another anchor to pin A5.

            entries = []
            for i in range(min(num_entries, 500)):
                eoff = jt_entry_base + i * 8
                if eoff + 8 > len(jt_data):
                    break
                seg_off = read_u16(jt_data, eoff)
                instr = jt_data[eoff+2:eoff+8]
                entries.append((i, seg_off, instr))
                if i < 30:
                    print(f"  {i:>5}  {i*8:>10}  0x{seg_off:04x}  {instr.hex()}")
            print(f"  ... ({len(entries)} total entries)")
            print()
        else:
            print("  No CODE 0 found")
            entries = []

        # Now: what are the loaded addresses of each CODE segment?
        # Classic Mac OS loads CODE 1 at some base. The jump table entries for CODE 1
        # contain the offset within CODE 1 as the first 2 bytes, plus 3F3C <segnum> A9F0
        # (unloaded stub) or the offset followed by A9F0 A9F0 (loaded).
        # The runtime address of CODE 1's first byte depends on where the heap puts it.
        #
        # Key insight: for a classic Mac application that uses THINK C, the standard
        # memory model is:
        #   - Below A5: local/stack
        #   - Above A5: jump table (positive A5-relative) at A5 + 0x20 typically
        #   - CODE 1 is typically the first loaded segment
        #   - The first entry in the jump table (entry 0) typically points to the start
        #     of CODE 1 with offset 0x0000.
        #
        # But 0x1E5A is a LONG absolute address, not an A5-relative address.
        # LEA $0x1E5A, A0 loads the literal value 0x1E5A.
        # This is very small for an absolute address in the upper parts of the heap.
        # This suggests 0x1E5A might be:
        #   1. An offset within a segment (if the segment was loaded at address 0)
        #   2. A very low absolute address in the Mac's fixed memory area
        #   3. The CODE 1 segment loaded at exactly address 0x0000 (unusual but possible in some models)
        #
        # Actually in Segment Manager, CODE resources are loaded into the application heap.
        # The heap starts above the system globals. Typical application load address for
        # CODE 1 is 0x0000_xxxx where xxxx depends on heap layout.
        # For MFS/HFS volumes, code segs usually start around 0x2000-0x4000 range.
        # Address 0x1E5A is very low — lower than most app heap starts.
        #
        # HOWEVER: some THINK C apps use A5-relative function pointers.
        # A5 itself is at some address, and the jump table is ABOVE A5 (positive offsets).
        # Code itself is loaded below A5 (negative offsets from A5).
        # So a function might be at A5 - something.
        #
        # Let me check if 0x1E5A could be a CODE segment base + offset
        # by examining what CODE segments look like:

        print("=== CODE SEGMENT ANALYSIS ===")
        code_segs = [r for r in resources['CODE'] if r['id'] != 0]
        code_segs.sort(key=lambda x: x['id'])
        total_code_size = 0
        for r in code_segs:
            total_code_size += r['size']

        print(f"Total CODE (excluding CODE 0): {len(code_segs)} segments, {total_code_size} bytes (0x{total_code_size:x})")
        print()

        # Print each CODE segment with its content start
        for r in code_segs:
            seg_data = data[r['abs_off']: r['abs_off'] + min(r['size'], 16)]
            # The first 4 bytes of a CODE resource (non-0) are the jump table offset and entry count
            # for this segment. Actually: first 2 bytes are the A5 offset of jump table for this
            # segment; next 2 bytes are number of entries. Then actual M68k code follows.
            jt_offset_in_seg = struct.unpack_from('>H', seg_data, 0)[0]
            entry_count = struct.unpack_from('>H', seg_data, 2)[0]
            print(f"  CODE {r['id']:>3}: file=0x{r['abs_off']:06x}  size=0x{r['size']:06x}  jt_off=0x{jt_offset_in_seg:04x}  entries={entry_count}  first_bytes={seg_data.hex()}")

        print()

    # Print other interesting resource types
    print("=== OTHER INTERESTING RESOURCES ===")
    interesting = ['PACK', 'cfrg', 'INIT', 'DRVR', 'MDEF', 'WDEF', 'CDEF', 'LDEF', 'FKEY', 'RSRC', 'PLUG', 'EDIT']
    for rtype in interesting:
        if rtype in resources:
            print(f"  '{rtype}': {len(resources[rtype])} resource(s)")
            for r in resources[rtype]:
                seg_data = data[r['abs_off']: r['abs_off'] + min(r['size'], 8)]
                print(f"    ID={r['id']:>5}  file=0x{r['abs_off']:06x}  size=0x{r['size']:06x}  first_bytes={seg_data.hex()}")

if __name__ == '__main__':
    main()
