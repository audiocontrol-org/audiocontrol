# Codex Findings Log

## Purpose

Record Codex conclusions from primary artifacts without assuming the Claude branch is
correct. Every finding should distinguish direct evidence from inference.

## Analysis Target 1

### Surface

- `CMESASocket::vtable[0x38]`
- Akai header field encoding for offsets 26-47

### Why This Target First

- It is the Claude branch's current stated blocker.
- It sits directly on the path between corrected wire framing and the still-failing
  hardware test.
- If Claude is right, Codex should be able to reproduce that path from the same
  artifacts.
- If Claude is wrong, this is likely where the disagreement will surface earliest.

## Findings

- None yet.

## Open Questions

- Is `CMESASocket::vtable[0x38]` actually responsible for the field encoding the Claude
  branch attributes to it?
- Are the header fields byte-swapped, nibble-transformed, both, or something else?
- Does the failure of the 392-byte BULK test come from bad content bytes, a wrong call
  sequence, or another prerequisite outside the payload itself?
