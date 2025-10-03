#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create proper Max for Live device with binary header
function createAMXDBinary(deviceContent) {
  // Convert the device content to JSON string with proper formatting
  const jsonContent = JSON.stringify(deviceContent, null, '\t');
  const jsonBuffer = Buffer.from(jsonContent, 'utf8');

  // Create the binary header for .amxd format
  // This is based on the structure: ampf [size] aaaa meta [size] [1] ptch [size] [json]
  const header = Buffer.concat([
    Buffer.from('ampf', 'utf8'),           // File signature
    Buffer.from([0x04, 0x00, 0x00, 0x00]), // Size field
    Buffer.from('aaaa', 'utf8'),           // Section marker
    Buffer.from('meta', 'utf8'),           // Metadata section
    Buffer.from([0x04, 0x00, 0x00, 0x00]), // Metadata size
    Buffer.from([0x01, 0x00, 0x00, 0x00]), // Version
    Buffer.from('ptch', 'utf8'),           // Patch section marker
  ]);

  // Calculate the size of the JSON content and create size buffer (little-endian)
  const sizeBuffer = Buffer.allocUnsafe(4);
  sizeBuffer.writeUInt32LE(jsonBuffer.length, 0);

  // Combine header, size, and JSON content
  return Buffer.concat([header, sizeBuffer, jsonBuffer]);
}

// Create the Max for Live device structure
function createMaxForLiveDevice() {
  return {
    "patcher": {
      "fileversion": 1,
      "appversion": {
        "major": 8,
        "minor": 5,
        "revision": 6,
        "architecture": "x64",
        "modernui": 1
      },
      "classnamespace": "box",
      "rect": [85.0, 104.0, 800.0, 600.0],
      "bglocked": 0,
      "openinpresentation": 1,
      "default_fontsize": 12.0,
      "default_fontface": 0,
      "default_fontname": "Arial",
      "gridonopen": 1,
      "gridsize": [15.0, 15.0],
      "gridsnaponopen": 1,
      "objectsnaponopen": 1,
      "statusbarvisible": 2,
      "toolbarvisible": 1,
      "lefttoolbarpinned": 0,
      "toptoolbarpinned": 0,
      "righttoolbarpinned": 0,
      "bottomtoolbarpinned": 0,
      "toolbars_unpinned_last_save": 0,
      "tallnewobj": 0,
      "boxanimatetime": 200,
      "enablehscroll": 1,
      "enablevscroll": 1,
      "devicewidth": 0.0,
      "description": "Midi to Plugin Router",
      "digest": "",
      "tags": "midi controller",
      "style": "",
      "subpatcher_template": "",
      "assistshowspatchername": 0,
      "boxes": [
        // IO Routing JavaScript
        {
          "box": {
            "id": "obj-iorouting",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 2,
            "outlettype": ["", ""],
            "patching_rect": [400.0, 60.0, 160.0, 22.0],
            "saved_object_attributes": {
              "filename": "ioRouting.js",
              "parameter_enable": 0
            },
            "text": "js ioRouting.js midi_inputs"
          }
        },
        // MIDI Input label
        {
          "box": {
            "id": "obj-midi-label",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [400.0, 75.0, 80.0, 20.0],
            "presentation": 1,
            "presentation_rect": [165.0, 80.0, 80.0, 15.0],
            "text": "MIDI Input:",
            "fontsize": 10.0
          }
        },
        // MIDI Input Type selector
        {
          "box": {
            "id": "obj-midi-type",
            "maxclass": "live.menu",
            "numinlets": 1,
            "numoutlets": 3,
            "outlettype": ["", "", "float"],
            "parameter_enable": 1,
            "patching_rect": [400.0, 90.0, 150.0, 15.0],
            "presentation": 1,
            "presentation_rect": [240.0, 80.0, 100.0, 15.0],
            "saved_attribute_attributes": {
              "valueof": {
                "parameter_enum": ["All Ins"],
                "parameter_invisible": 1,
                "parameter_linknames": 0,
                "parameter_longname": "MIDI Input",
                "parameter_modmode": 0,
                "parameter_shortname": "MIDI Input",
                "parameter_type": 2
              }
            },
            "varname": "MIDI Input Type"
          }
        },
        // Prepend settype for ioRouting
        {
          "box": {
            "id": "obj-prepend-settype",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [400.0, 110.0, 90.0, 22.0],
            "text": "prepend settype"
          }
        },
        // live.thisdevice for initialization
        {
          "box": {
            "id": "obj-thisdevice2",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 2,
            "outlettype": ["", ""],
            "patching_rect": [400.0, 10.0, 110.0, 22.0],
            "text": "live.thisdevice"
          }
        },
        // Init message triggered by live.thisdevice bang
        {
          "box": {
            "id": "obj-init-msg",
            "maxclass": "message",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [400.0, 35.0, 29.0, 22.0],
            "text": "init"
          }
        },
        // Delay for initial menu selection (wait for ioRouting to init)
        {
          "box": {
            "id": "obj-init-delay",
            "maxclass": "newobj",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": ["bang"],
            "patching_rect": [440.0, 35.0, 50.0, 22.0],
            "text": "del 100"
          }
        },
        // Message to select first menu item (0 = "All Ins")
        {
          "box": {
            "id": "obj-default-selection",
            "maxclass": "message",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [440.0, 60.0, 20.0, 22.0],
            "text": "0"
          }
        },
        // Title in presentation
        {
          "box": {
            "fontface": 1,
            "fontsize": 14.0,
            "id": "obj-title",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [15.0, 10.0, 300.0, 22.0],
            "presentation": 1,
            "presentation_rect": [10.0, 10.0, 300.0, 22.0],
            "text": "Midi to Plugin Router"
          }
        },
        // Status LED
        {
          "box": {
            "id": "obj-status-led",
            "maxclass": "led",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["int"],
            "patching_rect": [350.0, 10.0, 24.0, 24.0],
            "presentation": 1,
            "presentation_rect": [320.0, 12.0, 20.0, 20.0],
            "parameter_enable": 0,
            "oncolor": [0.0, 1.0, 0.0, 1.0]
          }
        },
        // Info text
        {
          "box": {
            "id": "obj-info",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [15.0, 35.0, 400.0, 20.0],
            "presentation": 1,
            "presentation_rect": [10.0, 35.0, 250.0, 20.0],
            "text": "Routes CC 13-20 to device parameters"
          }
        },
        // Build timestamp
        {
          "box": {
            "id": "obj-build-time",
            "maxclass": "comment",
            "fontsize": 9.0,
            "textcolor": [0.5, 0.5, 0.5, 1.0],
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [350.0, 35.0, 200.0, 17.0],
            "presentation": 1,
            "presentation_rect": [265.0, 38.0, 75.0, 15.0],
            "text": "Build: --:--:--"
          }
        },
        // Auto Map button
        {
          "box": {
            "id": "obj-automap-btn",
            "maxclass": "button",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["bang"],
            "patching_rect": [600.0, 10.0, 24.0, 24.0],
            "presentation": 1,
            "presentation_rect": [10.0, 100.0, 50.0, 20.0],
            "parameter_enable": 0
          }
        },
        // Auto Map message
        {
          "box": {
            "id": "obj-automap-msg",
            "maxclass": "message",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [600.0, 40.0, 60.0, 22.0],
            "text": "automap"
          }
        },
        // Auto Map label
        {
          "box": {
            "id": "obj-automap-label",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [630.0, 10.0, 80.0, 20.0],
            "presentation": 1,
            "presentation_rect": [65.0, 102.0, 60.0, 18.0],
            "text": "Auto Map",
            "fontsize": 10.0
          }
        },
        // Controller selection label
        {
          "box": {
            "id": "obj-controller-label",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [700.0, 10.0, 80.0, 20.0],
            "presentation": 1,
            "presentation_rect": [140.0, 102.0, 65.0, 18.0],
            "text": "Controller:",
            "fontsize": 10.0
          }
        },
        // Controller selection menu
        {
          "box": {
            "id": "obj-controller-menu",
            "maxclass": "umenu",
            "numinlets": 1,
            "numoutlets": 3,
            "outlettype": ["int", "", ""],
            "patching_rect": [700.0, 40.0, 200.0, 22.0],
            "presentation": 1,
            "presentation_rect": [205.0, 100.0, 135.0, 22.0],
            "parameter_enable": 0,
            "items": ["Launch Control XL 3"]
          }
        },
        // Controller selection message formatter
        {
          "box": {
            "id": "obj-controller-format",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [700.0, 70.0, 150.0, 22.0],
            "text": "prepend setcontroller"
          }
        },
        // Debug display
        {
          "box": {
            "id": "obj-debug-display",
            "maxclass": "comment",
            "bgcolor": [0.2, 0.2, 0.2, 1.0],
            "textcolor": [0.0, 1.0, 0.0, 1.0],
            "fontname": "Courier",
            "fontsize": 10.0,
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [15.0, 60.0, 500.0, 18.0],
            "presentation": 1,
            "presentation_rect": [10.0, 58.0, 330.0, 18.0],
            "text": "Waiting for MIDI..."
          }
        },
        // live.thisdevice to detect when Live API is ready
        {
          "box": {
            "id": "obj-thisdevice",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 2,
            "outlettype": ["", ""],
            "patching_rect": [15.0, 150.0, 110.0, 22.0],
            "text": "live.thisdevice"
          }
        },
        // V8 JavaScript object with correct path (3 outlets: debug, build-time, extra)
        // Now has 2 inlets: inlet 0 for MIDI, inlet 1 for live.thisdevice notifications
        {
          "box": {
            "id": "obj-js",
            "maxclass": "newobj",
            "numinlets": 2,
            "numoutlets": 3,
            "outlettype": ["", "", ""],
            "patching_rect": [15.0, 200.0, 200.0, 22.0],
            "saved_object_attributes": {
              "autowatch": 1,
              "filename": "cc-router.js",
              "parameter_enable": 0
            },
            "text": "v8 cc-router.js @autowatch 1"
          }
        },
        // MIDI input - receives routed MIDI
        {
          "box": {
            "id": "obj-midiin",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["int"],
            "patching_rect": [15.0, 60.0, 60.0, 22.0],
            "text": "midiin"
          }
        },
        // Parse MIDI into controller messages
        {
          "box": {
            "id": "obj-midiparse",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 7,
            "outlettype": ["", "", "", "int", "int", "int", "int"],
            "patching_rect": [15.0, 90.0, 100.0, 22.0],
            "text": "midiparse"
          }
        },
        // MIDI output - pass MIDI to next device
        {
          "box": {
            "id": "obj-midiout",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [150.0, 120.0, 55.0, 22.0],
            "text": "midiout"
          }
        },
        // Debug message for MIDI input
        {
          "box": {
            "id": "obj-debug-midi",
            "maxclass": "message",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [230.0, 160.0, 200.0, 22.0],
            "text": "MIDI: $1 $2 $3"
          }
        },
        // Send to debug display
        {
          "box": {
            "id": "obj-debug-format",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [230.0, 185.0, 150.0, 22.0],
            "text": "prepend set"
          }
        },
        // LED blink on MIDI
        {
          "box": {
            "id": "obj-led-blink",
            "maxclass": "newobj",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": ["bang"],
            "patching_rect": [350.0, 120.0, 60.0, 22.0],
            "text": "del 100"
          }
        },
        // Loadbang
        {
          "box": {
            "id": "obj-loadbang",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["bang"],
            "patching_rect": [15.0, 250.0, 60.0, 22.0],
            "text": "loadbang"
          }
        },
        // Loadbang message
        {
          "box": {
            "id": "obj-loadmsg",
            "maxclass": "message",
            "numinlets": 2,
            "numoutlets": 1,
            "outlettype": [""],
            "patching_rect": [15.0, 280.0, 60.0, 22.0],
            "text": "loadbang"
          }
        },
        // Audio inputs for pass-through
        {
          "box": {
            "id": "obj-in-1",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["signal"],
            "patching_rect": [500.0, 50.0, 50.0, 22.0],
            "text": "in~ 1"
          }
        },
        {
          "box": {
            "id": "obj-in-2",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["signal"],
            "patching_rect": [560.0, 50.0, 50.0, 22.0],
            "text": "in~ 2"
          }
        },
        // Audio outputs for pass-through
        {
          "box": {
            "id": "obj-out-1",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [500.0, 200.0, 50.0, 22.0],
            "text": "out~ 1"
          }
        },
        {
          "box": {
            "id": "obj-out-2",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [560.0, 200.0, 50.0, 22.0],
            "text": "out~ 2"
          }
        }
      ],
      "lines": [
        // thisdevice2 bang to init message
        {
          "patchline": {
            "destination": ["obj-init-msg", 0],
            "source": ["obj-thisdevice2", 0]
          }
        },
        // thisdevice2 bang to delay (for default menu selection)
        {
          "patchline": {
            "destination": ["obj-init-delay", 0],
            "source": ["obj-thisdevice2", 0]
          }
        },
        // delay to default selection message
        {
          "patchline": {
            "destination": ["obj-default-selection", 0],
            "source": ["obj-init-delay", 0]
          }
        },
        // default selection to menu
        {
          "patchline": {
            "destination": ["obj-midi-type", 0],
            "source": ["obj-default-selection", 0]
          }
        },
        // init message to ioRouting
        {
          "patchline": {
            "destination": ["obj-iorouting", 0],
            "source": ["obj-init-msg", 0]
          }
        },
        // ioRouting outlet 0 to MIDI type menu (populates menu options)
        {
          "patchline": {
            "destination": ["obj-midi-type", 0],
            "source": ["obj-iorouting", 0]
          }
        },
        // MIDI type menu to prepend settype
        {
          "patchline": {
            "destination": ["obj-prepend-settype", 0],
            "source": ["obj-midi-type", 0]
          }
        },
        // prepend settype to ioRouting (formatted message)
        {
          "patchline": {
            "destination": ["obj-iorouting", 0],
            "source": ["obj-prepend-settype", 0]
          }
        },
        // midiin to midiparse
        {
          "patchline": {
            "destination": ["obj-midiparse", 0],
            "source": ["obj-midiin", 0]
          }
        },
        // midiin to midiout (pass through)
        {
          "patchline": {
            "destination": ["obj-midiout", 0],
            "source": ["obj-midiin", 0]
          }
        },
        // midiparse controller output (outlet 2) to JS
        {
          "patchline": {
            "destination": ["obj-js", 0],
            "source": ["obj-midiparse", 2]
          }
        },
        // midiparse controller to debug message
        {
          "patchline": {
            "destination": ["obj-debug-midi", 0],
            "source": ["obj-midiparse", 2]
          }
        },
        // midiparse controller to LED (turn on)
        {
          "patchline": {
            "destination": ["obj-status-led", 0],
            "source": ["obj-midiparse", 2]
          }
        },
        // midiparse controller to LED blink delay
        {
          "patchline": {
            "destination": ["obj-led-blink", 0],
            "source": ["obj-midiparse", 2]
          }
        },
        // Debug message to format
        {
          "patchline": {
            "destination": ["obj-debug-format", 0],
            "source": ["obj-debug-midi", 0]
          }
        },
        // Format to display
        {
          "patchline": {
            "destination": ["obj-debug-display", 0],
            "source": ["obj-debug-format", 0]
          }
        },
        // LED blink turns off LED
        {
          "patchline": {
            "destination": ["obj-status-led", 0],
            "source": ["obj-led-blink", 0]
          }
        },
        // Loadbang to message
        {
          "patchline": {
            "destination": ["obj-loadmsg", 0],
            "source": ["obj-loadbang", 0]
          }
        },
        // Loadbang message to JS inlet 0 (for loadbang function)
        {
          "patchline": {
            "destination": ["obj-js", 0],
            "source": ["obj-loadmsg", 0]
          }
        },
        // live.thisdevice outlet 0 to JS inlet 1 (for Live API ready notification)
        {
          "patchline": {
            "destination": ["obj-js", 1],
            "source": ["obj-thisdevice", 0]
          }
        },
        // JS outlet 0 to debug display (for status messages from JS)
        {
          "patchline": {
            "destination": ["obj-debug-display", 0],
            "source": ["obj-js", 0]
          }
        },
        // JS outlet 1 to build time display
        {
          "patchline": {
            "destination": ["obj-build-time", 0],
            "source": ["obj-js", 1]
          }
        },
        // Auto Map button to message
        {
          "patchline": {
            "destination": ["obj-automap-msg", 0],
            "source": ["obj-automap-btn", 0]
          }
        },
        // Auto Map message to JS inlet 0
        {
          "patchline": {
            "destination": ["obj-js", 0],
            "source": ["obj-automap-msg", 0]
          }
        },
        // Controller menu to formatter
        {
          "patchline": {
            "destination": ["obj-controller-format", 0],
            "source": ["obj-controller-menu", 1]
          }
        },
        // Controller formatter to JS inlet 0
        {
          "patchline": {
            "destination": ["obj-js", 0],
            "source": ["obj-controller-format", 0]
          }
        },
        // Audio pass-through
        {
          "patchline": {
            "destination": ["obj-out-1", 0],
            "source": ["obj-in-1", 0]
          }
        },
        {
          "patchline": {
            "destination": ["obj-out-2", 0],
            "source": ["obj-in-2", 0]
          }
        }
      ],
      "parameters": {},
      "dependency_cache": [
        {
          "name": "cc-router.js",
          "bootpath": ".",
          "patcherrelativepath": ".",
          "type": "TEXT",
          "implicit": 1
        },
        {
          "name": "ioRouting.js",
          "bootpath": ".",
          "patcherrelativepath": ".",
          "type": "TEXT",
          "implicit": 1
        }
      ],
      "autosave": 0
    }
  };
}

// Export functions
module.exports = {
  createAMXDBinary,
  createMaxForLiveDevice
};