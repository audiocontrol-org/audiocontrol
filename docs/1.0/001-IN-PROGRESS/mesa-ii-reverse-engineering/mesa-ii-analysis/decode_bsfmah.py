#!/usr/bin/env python3
"""
Decode BuildSampleHeaderFromMAH — extract key structural information.

Focuses on:
1. What bytes are written to output buffer (A2) at each offset
2. What vtable calls are made and with what offsets
3. How A3 (MAH) fields are read and mapped to output bytes
"""

import sys
import struct

BINARY = "/Users/orion/work/audiocontrol-work/audiocontrol-mesa-ii-reverse-engineering/docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/mesa-ii-analysis/binaries/sampler-editor-rsrc.bin"
START = 0x02e6bd
END = 0x02e9d3

SAMPLER_EDIT_CODE_BASE = 0x027f57

def resolve_file_offset(jsr_addr):
    return SAMPLER_EDIT_CODE_BASE + jsr_addr

def main():
    with open(BINARY, 'rb') as f:
        data = f.read()

    chunk = data[START:END]
    print(f"Function: BuildSampleHeaderFromMAH")
    print(f"File offset: 0x{START:06x} - 0x{END:06x} ({END-START} bytes)")
    print()

    print("=== ARGUMENT ANALYSIS (THINK C mangled name) ===")
    print("Mangled: BuildSampleHeaderFromMAH__14CSamplerModuleFPUcP16MESAAudioHeader2s")
    print("  this    = fp(8)  = CSamplerModule*")
    print("  arg2    = fp(12) = PUc = unsigned char* = output buffer (A2)")
    print("  arg3    = fp(16) = P16MESAAudioHeader2* = mah (A3)")
    print("  arg4    = fp(20) = s = short = packet_index (stereo flag?)")
    print()
    print("  D6 = fp(8) = this (stored in D6 for vtable dispatch)")
    print("  A2 = fp(12) = output buffer pointer (uint8_t*)")
    print("  A3 = fp(16) = MAH pointer")
    print()

    print("=== OUTPUT BUFFER WRITES (moveb Dx/imm, A2@(offset)) ===")
    print()
    print("Byte-by-byte output buffer map:")
    print()

    writes = [
        (0x02e707, "A2@(0)",    "moveb #3",         "constant 0x03 = S3000XL device model ID or SDS channel number"),
        (0x02e721, "A2@(1)",    "moveb fp@(-37)",    "fp(-38): 1 if mah@(12)>22050 (sample rate > 22050), else 0. Written as LOW BYTE"),
        (0x02e727, "A2@(2)",    "moveb A3@(103)",    "mah@(103) = raw byte from MAH field at offset 103"),
        (0x02e7b1, "A2@(13)",   "moveb #0x2d (45)", "ASCII '-' = 0x2d, written only if mah@(16)==2"),
        (0x02e7cb, "A2@(14)",   "moveb fp@(-39)",    "conditional: 'R'=0x52 if fp@(20)!=0, 'L'=0x4c if fp@(20)==0. Written only if mah@(16)==2"),
        (0x02e7e8, "A2@(15)",   "moveb #0x80 (-128)","constant 0x80 = SysEx end marker? Or flags byte"),
        (0x02e819, "A2@(16)",   "moveb fp@(-43)",    "low byte of fp(-44): complex loop/sustain flag"),
        (0x02e849, "A2@(19)",   "moveb fp@(-47)",    "low byte of fp(-48): 0 if loop enabled, 2 if no loop"),
        (0x02e91d, "A2@(48)",   "moveb D0",          "low byte of fp(-6): zero if fp(-4)<256, else 9999 low byte = 0x0f"),
        (0x02e92f, "A2@(49)",   "moveb D0",          "high byte of fp(-6) >> 8: zero if fp(-4)<256, else 9999>>8 = 0x27"),
        (0x02e93d, "A2@(138)",  "moveb D0",          "low byte of mah@(14) = sample number low byte"),
        (0x02e949, "A2@(139)",  "moveb D0",          "high byte of mah@(14) >> 8"),
        (0x02e9ad, "A2@(20)",   "moveb D0",          "low byte of tuning word from TuningFromSemiCent"),
        (0x02e9c3, "A2@(21)",   "moveb D0",          "high byte of tuning word >> 8"),
    ]

    movel_writes = [
        (0x02e865, "A2@(26)",   "movel fp@(-16)",    "fp(-16) = mah@(80) = total byte length, nibble-encoded by vtable[0x38] call"),
        (0x02e897, "A2@(30)",   "movel fp@(-28)",    "fp(-28) = mah@(52) = loop start, nibble-encoded"),
        (0x02e8b3, "A2@(34)",   "movel fp@(-32)",    "fp(-32) = mah@(56) = loop end, nibble-encoded"),
        (0x02e8cf, "A2@(38)",   "movel fp@(-36)",    "fp(-36) = mah@(64) = sustain end, nibble-encoded"),
        (0x02e8eb, "A2@(44)",   "movel fp@(-4)",     "fp(-4) = mah@(64)-mah@(60)+1, nibble-encoded"),
    ]

    for (off, dest, src, comment) in writes:
        print(f"  0x{off:06x}: {dest:12s} <- {src:20s}  // {comment}")
    print()
    print("  Long-word (4-byte) writes via vtable[0x38] (ConvertToMIDI/nibble encoding):")
    for (off, dest, src, comment) in movel_writes:
        print(f"  0x{off:06x}: {dest:12s} <- {src:20s}  // {comment}")
    print()

    print("=== VTABLE CALLS ===")
    print()
    print("  0x02e7e1: vtable[0x30] on socket (this@(3492)) -- SetSampleHeader/SDS dump header")
    print("    Args: pea A2@(3) (pointer to A2+3)")
    print("    Same vtable[0x30] as in SendAudioBufferToSampler")
    print()
    print("  0x02e863: vtable[0x38] on socket -- ConvertToMIDI (nibble encode a 32-bit value)")
    print("    Args: pea fp@(-16) = &total_byte_length")
    print("    Returns: encoded value stored at A2@(26)")
    print()
    print("  0x02e87f: vtable[0x38] on socket -- second call")
    print("    (Note: same vtable offset 0x38 = 56 decimal)")
    print("    -- but wait, let me re-check the raw bytes at 0x02e87b --")
    print("    0x02e87b: 2269 0038  moveal A1@(0x38), A1  -- vtable offset 0x38 = 56")
    print()
    print("  0x02e895: vtable[0x38] -- encodes fp@(-28) = mah@(52)")
    print("  0x02e8b1: vtable[0x38] -- encodes fp@(-32) = mah@(56)")
    print("  0x02e8cd: vtable[0x38] -- encodes fp@(-36) = mah@(64)")
    print("  0x02e8e9: vtable[0x38] -- encodes fp@(-4)  = sustain_end-sustain_start+1")
    print()

    print("=== MAH FIELD READS ===")
    print()
    mah_reads = [
        (0x02e6e1, 0x50, "mah@(80)  = total_byte_length -> fp(-16)"),
        (0x02e6e7, 0x34, "mah@(52)  = loop_start -> fp(-28)"),
        (0x02e6ed, 0x38, "mah@(56)  = loop_end -> fp(-32)"),
        (0x02e6f3, 0x40, "mah@(64)  = sustain_end -> fp(-36)"),
        (0x02e6f9, 0x40, "mah@(64)  = sustain_end (again for subtraction)"),
        (0x02e6fd, 0x3c, "mah@(60)  = sustain_start (subtracted from sustain_end)"),
        (0x02e70b, 0x0c, "mah@(12)  = sample_rate, compared to 22050"),
        (0x02e727, 0x67, "mah@(103) = unknown byte -> A2@(2)"),
        (0x02e7ab, 0x10, "mah@(16)  = num_channels? compared to 2"),
        (0x02e78d, 0x14, "mah@(20)  = name_length (used to bound sample name copy)"),
        (0x02e737, 0x0e, "mah@(14+d0) = sample name chars (mah+14 is Pascal string body)"),
        (0x02e7f3, 0x68, "mah@(104) bit0 = loop_enable flag"),
        (0x02e955, 0x60, "mah@(96)  = semi/cent tuning -> TuningFromSemiCent"),
        (0x02e933, 0x0e, "mah@(14)  = sample_number (word) -> A2@(138/139)"),
        (0x02e97b, 0x0c, "mah@(12)  = sample_rate, compared to 48000 for correction"),
    ]
    for (off, field, desc) in mah_reads:
        print(f"  0x{off:06x}: mah@({field:3d}/0x{field:02x}) = {desc}")

    print()
    print("=== INITIALIZATION: zero-fill loop ===")
    print("  0x02e6d3-0x02e6df: zero-fill A2[0..199] (clrb A2@(0,D4:w), D4=0..199)")
    print("  Output buffer is zeroed for 200 bytes before any writes.")
    print()

    print("=== SAMPLE NAME COPY (bytes A2@(3..15)) ===")
    print("  0x02e72d-0x02e7a7: loop D4=0..12, reads mah@(14+D4+1) = mah@(15..27)")
    print("    For each char: ASCII validation (a-z uppercased, 0-9, space, #, +, -, ., A-Z)")
    print("    If char is valid and D4 < mah@(20) (name_length), copy to A2@(3+D4)")
    print("    Else substitute space (0x20)")
    print("    Writes 12 chars to A2@(3..14) inclusive = 12-char name field")
    print()
    print("  After name loop, if mah@(16)==2 (stereo):")
    print("    A2@(13) = 0x2d ('-')")
    print("    A2@(14) = 'R'(0x52) if fp@(20)!=0, else 'L'(0x4c)")
    print("    These OVERWRITE the last 2 chars of the name field for stereo L/R labeling")
    print()

    print("=== SLNGTH ANALYSIS ===")
    print()
    print("  fp(-16) = mah@(80) = total_byte_length (loaded at 0x02e6e1)")
    print("  fp(-4)  = mah@(64) - mah@(60) + 1 = sustain_end - sustain_start + 1 (samples)")
    print()
    print("  vtable[0x38] is called at 0x02e863 with &fp(-16) (total_byte_length)")
    print("  Return value is stored at A2@(26) via: movel fp@(-16), A2@(26)  [offset 0x02e865]")
    print()
    print("  vtable[0x38] is also called with &fp(-4) at 0x02e8e9")
    print("  Return value stored at A2@(44) via: movel fp@(-4), A2@(44)  [offset 0x02e8eb]")
    print()
    print("  NOTE: vtable[0x38] appears to be a nibble-encoding function (ConvertToMIDI).")
    print("  It takes a pointer to a 32-bit value and returns (or transforms in-place?)")
    print("  the nibble-encoded form. The return value is stored as a 4-byte long.")
    print()
    print("  KEY QUESTION: does vtable[0x38] modify in-place or return a new value?")
    print("  At 0x02e863: jsr %a1@, then 0x02e865: movel fp@(-16), A2@(26)")
    print("    -> fp(-16) IS the in/out buffer that vtable[0x38] modified in-place")
    print("    -> A2@(26) gets the 4-byte nibble-encoded result")
    print()
    print("  SLNGTH in standard SDS is bytes 8-10 (3 bytes, 7-bit encoded, total sample words)")
    print("  But here, A2@(26) is a 4-byte field from mah@(80) (total byte length)")
    print("  This is NOT standard SDS. The SDS header here is a NON-STANDARD Akai extension.")
    print()
    print("  SLNGTH candidates in this custom header:")
    print("  A2@(26..29) = nibble-encoded mah@(80) (total byte length)")
    print("  A2@(44..47) = nibble-encoded (sustain_end - sustain_start + 1)")
    print()

    print("=== VTABLE OFFSET 0x38 vs 0x30 COMPARISON ===")
    print()
    print("  vtable[0x30] (48 decimal) = SetSampleHeader (SDS dump header, seen in SendAudioBufferToSampler)")
    print("  vtable[0x38] (56 decimal) = called repeatedly with value pointers -> encoding function")
    print("  These are adjacent vtable slots. vtable[0x38] is likely 'ConvertToMIDI' or 'NibbleEncode'")
    print()

    print("=== LOOP/SUSTAIN FIELDS ===")
    print()
    print("  mah@(52) = loop_start   -> A2@(30..33) nibble-encoded")
    print("  mah@(56) = loop_end     -> A2@(34..37) nibble-encoded")
    print("  mah@(64) = sustain_end  -> A2@(38..41) nibble-encoded")
    print()
    print("  fp(-4) = sustain_end - sustain_start + 1 -> A2@(44..47) nibble-encoded")
    print()
    print("  Loop enable flag (mah@(104) bit 0):")
    print("    - Used to set fp(-42) (loop_enable_flag)")
    print("    - fp(-4) != 0 also required for loop enable")
    print("    - If loop enabled: fp(-44)=1, A2@(16) = 1 (low byte)")
    print("    - Else: fp(-44)=0, A2@(16) = 0")
    print("    - A2@(19) = 0 if loop enabled, 2 if not looping")
    print()

    print("=== SAMPLE PERIOD FIELD ===")
    print()
    print("  mah@(12) compared to 22050 at 0x02e70b:")
    print("    > 22050: fp(-38) = 1 -> A2@(1) low byte = 1")
    print("    <= 22050: fp(-38) = 0 -> A2@(1) low byte = 0")
    print("  This sets A2@(1) to 0 or 1 (sample rate range flag)")
    print()
    print("  mah@(12) sample rate also used in tuning calculation at 0x02e97b:")
    print("    If rate == 48000: add correction factor (+1 to fp(-10), +47 to fp(-24))")
    print()

if __name__ == '__main__':
    main()
