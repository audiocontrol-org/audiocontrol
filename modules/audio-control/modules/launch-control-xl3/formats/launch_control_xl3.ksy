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
        contents: [0x06, 0x20]
      - id: name_length
        type: u1
        doc: Length of mode name (0-8 characters)
      - id: name_bytes
        size: name_length
        type: str
        encoding: ASCII
        if: name_length > 0
    doc: |
      Mode name format (READ/response):
        06 20 [length] [name_bytes]

      Mode name format (WRITE/request):
        20 [length] [name_bytes]

      Discovery: Web editor MIDI capture (2025-09-30)
      Example: 20 08 43 48 41 4E 54 45 53 54 = "CHANTEST" (8 chars)

  control_definition:
    seq:
      - id: control_type
        type: u1
        doc: Control type (0x00=knob top, 0x05=knob bottom, 0x09=fader, etc)
      - id: control_id
        type: u1
        doc: Hardware control ID (0x10-0x3F)
      - id: midi_channel
        type: u1
        doc: MIDI channel (0-15)
      - id: cc_number
        type: u1
        doc: MIDI CC number (0-127)
      - id: min_value
        type: u1
        doc: Minimum value (usually 0)
      - id: max_value
        type: u1
        doc: Maximum value (usually 127)
      - id: behavior
        type: u1
        enum: control_behavior
        doc: Control behavior (absolute/relative/toggle)

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
