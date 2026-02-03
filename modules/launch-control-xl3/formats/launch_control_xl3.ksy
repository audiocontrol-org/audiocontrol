meta:
  id: launch_control_xl3_custom_mode
  title: Novation Launch Control XL3 Custom Mode Format
  file-extension: bin
  endian: be
  license: MIT
  ks-version: 0.11

doc: |
  Custom mode configuration format for Novation Launch Control XL3.

  The custom mode data is split across 2 SysEx message pages:
  - Page 0 (SysEx byte 0x00): Mode name + controls 0x10-0x27 (24 controls) + labels
  - Page 1 (SysEx byte 0x03): Mode name + controls 0x28-0x3F (24 controls) + labels

  Total: 48 controls (0x10-0x3F)

  Empirically discovered format through MIDI traffic analysis.

  Version History:
  - v1.7 (2025-10-17): CRITICAL FIX - Corrected mode_name format to 0x20 prefix (NOT 0x06 0x20)
  - v1.6 (2025-10-16): Corrected mode name length limit documentation from 8 to 18 characters
  - v1.5 (2025-10-11): Documented parser bug fix - 0x40 appears as data in minValue field, not as control marker
  - v1.4 (2025-10-09): Corrected to 2 pages (0x00, 0x03), not 3 pages. Updated to reflect working code.
  - v1.3 (2025-09-30): Documented read slot byte behavior for DAW port integration
  - v1.2 (2025-09-30): Added write acknowledgement message format (command 0x15)
  - v1.1 (2025-09-30): Documented write protocol format (command 0x45)
  - v1.0 (2025-09-30): Initial read protocol specification

seq:
  - id: page_0
    type: custom_mode_page
    doc: First page with mode name and controls 0x10-0x27 (24 controls)
  - id: page_1
    type: custom_mode_page
    doc: Second page with mode name and controls 0x28-0x3F (24 controls)

types:
  custom_mode_page:
    doc: |
      A single page of custom mode data containing 24 control definitions.

      Page 0 (SysEx byte 0x00): Controls 0x10-0x27
      Page 1 (SysEx byte 0x03): Controls 0x28-0x3F

      Both pages contain the mode name (for redundancy/verification).
    seq:
      - id: header
        type: page_header
      - id: mode_name_section
        type: mode_name
        doc: Mode name present in both pages (redundant for verification)
      - id: controls
        type: control_definition
        repeat: expr
        repeat-expr: 24
        doc: 24 control definitions per page (not 16)
      - id: labels
        type: label_section
        size-eos: true
        doc: Variable-length label section

  page_header:
    seq:
      - id: page_marker
        contents: [0x06, 0x00]
      - id: page_number
        type: u1
        doc: |
          Page number in SysEx message:
          - 0x00 for page 0 (controls 0x10-0x27)
          - 0x03 for page 1 (controls 0x28-0x3F)
      - id: unknown1
        size: 3

  mode_name:
    seq:
      - id: name_marker
        contents: [0x20]
        doc: Mode name field marker (NOT 0x06 0x20 as previously documented)
      - id: name_length
        type: u1
        doc: |
          Length of mode name (0-18 characters, 0x00-0x12).
          Special value 0x1F (31) indicates factory/immutable mode.
      - id: name_bytes
        size: name_length
        type: str
        encoding: ASCII
        if: name_length > 0 and name_length != 0x1F
    doc: |
      Mode name field format: 0x20 [length] [name_bytes]

      Confirmed by MIDI capture analysis (2025-10-17, Issue #40):
      - Device uses 0x20 prefix (NOT 0x06 0x20)
      - Maximum length: 18 characters (0x12 = 18 decimal)
      - Factory mode indicator: 0x20 0x1F (length = 0x1F)
      - Write and read use identical format

      Examples:
        "TESTMOD" (7 chars):    20 07 54 45 53 54 4D 4F 44
        "EXACTLY18CHARSLONG":   20 12 45 58 41 43 54 4C 59 31 38 43 48 41 52 53 4C 4F 4E 47
        Factory mode:           20 1F

      Earlier versions incorrectly documented:
      - 0x06 0x20 prefix pattern (does not exist in protocol)
      - 8-character maximum (actual maximum is 18)

  control_definition:
    doc: |
      11-byte control definition structure found in READ responses.
      Marker byte is always 0x48 (not 0x40, 0x49, or any other value).

      Note: The min_value field (position +7) may contain 0x40 (decimal 64) as DATA.
      This is not a control marker - it's simply a minValue of 64.

      WARNING: Parsers must not scan for 0x40 bytes to identify controls.
    seq:
      - id: control_marker
        contents: [0x48]
        doc: Control definition marker (always 0x48 in READ responses)
      - id: control_id
        type: u1
        doc: Hardware control ID (0x10-0x3F)
      - id: def_type
        contents: [0x02]
        doc: Definition type (always 0x02)
      - id: control_type
        type: u1
        doc: Control type (0x00=knob top, 0x05=knob bottom, 0x09=fader, etc)
      - id: midi_channel
        type: u1
        doc: MIDI channel (0-15)
      - id: param1
        type: u1
        doc: Parameter (usually 0x01 or 0x00)
      - id: unknown1
        contents: [0x48]
        doc: Unknown fixed byte (always 0x48)
      - id: min_value
        type: u1
        doc: |
          Minimum value (0-127).
          WARNING: This may be 0x40 (64 decimal) - do NOT interpret as control marker!
      - id: cc_number
        type: u1
        doc: MIDI CC number (0-127)
      - id: max_value
        type: u1
        doc: Maximum value (0-127)
      - id: terminator
        contents: [0x00]
        doc: Terminator byte

  label_section:
    seq:
      - id: unknown_padding
        size: 3
        doc: Padding bytes before labels
      - id: labels
        type: control_label
        repeat: until
        repeat-until: _io.eof or _.is_terminator

  control_label:
    doc: |
      Control label with length-encoding scheme.

      Discovery: Empirical testing (2025-09-30)
      The marker byte (0x60-0x6F) encodes the string length.

      Length calculation: length = marker_byte - 0x60

      Examples:
      - 0x60 = 0 characters (empty)
      - 0x65 = 5 characters ("TEST1")
      - 0x69 = 9 characters ("High Pass")
      - 0x6F = 15 characters (maximum)

      Special control ID mapping:
      - Label IDs 0x19-0x1C (25-28) map to control IDs 26-29 (+1 offset)
      - All other label IDs map directly to control IDs
    seq:
      - id: length_marker
        type: u1
        doc: |
          Marker byte encoding string length (0x60-0x6F).
          Length = marker - 0x60 (0-15 characters).
      - id: control_id
        type: u1
        doc: Control ID this label applies to (0x10-0x3F)
      - id: name_bytes
        size: label_length
        type: str
        encoding: ASCII
        if: label_length > 0
        doc: Label text (ASCII, variable length)
    instances:
      label_length:
        value: length_marker - 0x60
        doc: Calculate label length from marker byte
      is_terminator:
        value: length_marker < 0x60 or control_id < 0x10
        doc: Check if this marks end of labels section

  write_acknowledgement:
    doc: |
      Write acknowledgement message sent by device after receiving a page write.

      Complete SysEx format:
        F0 00 20 29 02 15 05 00 15 [page] [status] F7

      This specification covers the payload after the SysEx header.

      Discovery: Playwright + CoreMIDI spy (2025-09-30)
      Observed device sending ACK 24-27ms after each page write.
      Web editor waits for ACK before sending next page.

      Example (Page 0 ACK):
        15 00 06 = Command 0x15, Page 0, Status 0x06 (success)

      Example (Page 1 ACK):
        15 03 06 = Command 0x15, Page 1, Status 0x06 (success)
    seq:
      - id: command
        contents: [0x15]
        doc: Acknowledgement command byte
      - id: page_number
        type: u1
        doc: |
          Page number being acknowledged:
          - 0x00 for page 0
          - 0x03 for page 1
      - id: status
        type: u1
        enum: ack_status
        doc: Acknowledgement status (0x06 = success)

enums:
  ack_status:
    0x06: success
    doc: Status codes for write acknowledgements

  control_behavior:
    0x0C: absolute
    0x0D: relative
    0x0E: toggle
