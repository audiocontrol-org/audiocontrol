meta:
  id: launch_control_xl3_custom_mode
  title: Novation Launch Control XL3 Custom Mode Format
  file-extension: bin
  endian: be
  license: MIT
  ks-version: 0.11

doc: |
  Custom mode configuration format for Novation Launch Control XL3.

  The custom mode data is split across 3 SysEx message pages:
  - Page 1: Mode name + controls 0-15 + labels
  - Page 2: Controls 16-31 + labels
  - Page 3: Controls 32-47 + labels

  Empirically discovered format through MIDI traffic analysis.

seq:
  - id: page_1
    type: custom_mode_page
    doc: First page with mode name and controls 0-15
  - id: page_2
    type: custom_mode_page
    doc: Second page with controls 16-31
  - id: page_3
    type: custom_mode_page
    doc: Third page with controls 32-47

types:
  custom_mode_page:
    seq:
      - id: header
        type: page_header
      - id: mode_name_section
        type: mode_name
        if: _parent._index == 0
        doc: Mode name only present in first page
      - id: controls
        type: control_definition
        repeat: expr
        repeat-expr: 16
        doc: 16 control definitions per page
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
        doc: Page number (0, 1, or 2)
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

enums:
  control_behavior:
    0x0C: absolute
    0x0D: relative
    0x0E: toggle
