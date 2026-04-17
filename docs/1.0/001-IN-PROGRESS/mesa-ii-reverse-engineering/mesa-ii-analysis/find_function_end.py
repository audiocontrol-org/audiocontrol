#!/usr/bin/env python3
"""
Find the UNLK A6 / RTS end of the function starting at a given file offset.
Also prints the THINK C name string that follows.

Usage:
  python3 find_function_end.py <binary> <start_hex>
"""

import sys
import struct

def main():
    binary_path = sys.argv[1]
    start = int(sys.argv[2], 16)

    with open(binary_path, 'rb') as f:
        data = f.read()

    print(f"Searching for UNLK A6 / RTS after 0x{start:06x}...")

    i = start
    while i < len(data) - 4:
        # UNLK A6 (4e 5e) followed by RTS (4e 75)
        if data[i] == 0x4e and data[i+1] == 0x5e and data[i+2] == 0x4e and data[i+3] == 0x75:
            unlk_offset = i
            rts_offset = i + 2
            end_offset = i + 4
            print(f"  Found UNLK A6 / RTS at 0x{unlk_offset:06x} / 0x{rts_offset:06x}")
            print(f"  Function end (exclusive): 0x{end_offset:06x}")
            print(f"  Function size: {end_offset - start} bytes")

            # Read the THINK C name string
            j = end_offset
            # Skip NOPs
            while j + 1 < len(data) and data[j] == 0x4e and data[j+1] == 0x71:
                j += 2

            if j < len(data):
                b0 = data[j]
                if b0 & 0x80:
                    name_len = b0 & 0x7f
                    if name_len == 0:
                        # two-byte form
                        if j + 1 < len(data):
                            name_len = data[j+1]
                            name_start = j + 2
                        else:
                            print(f"  Name string: (truncated)")
                            break
                    else:
                        name_start = j + 1

                    name_bytes = data[name_start:name_start + name_len]
                    try:
                        name = name_bytes.decode('ascii', errors='replace')
                        print(f"  THINK C name at 0x{j:06x}: [{name}] (len={name_len})")
                    except Exception as e:
                        print(f"  Name decode error: {e}, raw: {name_bytes[:40]}")
                else:
                    print(f"  No name string at 0x{j:06x}, byte=0x{b0:02x}")
            break
        i += 2  # 68k instructions are word-aligned

    print(f"Done.")

if __name__ == '__main__':
    main()
