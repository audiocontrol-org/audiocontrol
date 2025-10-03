// Create proper Max for Live Audio Effect device structure

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
      "rect": [59.0, 106.0, 800.0, 600.0],
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
      "description": "CC Router for Launch Control XL3",
      "digest": "",
      "tags": "midi controller",
      "style": "",
      "subpatcher_template": "",
      "assistshowspatchername": 0,
      "boxes": [
        // Title comment
        {
          "box": {
            "id": "obj-1",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [15.0, 10.0, 300.0, 20.0],
            "presentation": 1,
            "presentation_rect": [10.0, 10.0, 300.0, 20.0],
            "text": "CC Router for Launch Control XL3",
            "fontsize": 14.0,
            "fontface": 1
          }
        },
        // JavaScript object
        {
          "box": {
            "id": "obj-js",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 2,
            "outlettype": ["", ""],
            "patching_rect": [15.0, 150.0, 200.0, 22.0],
            "saved_object_attributes": {
              "autowatch": 1,
              "filename": "code/cc-router.js",
              "parameter_enable": 0
            },
            "text": "js code/cc-router.js @autowatch 1"
          }
        },
        // MIDI input from Live
        {
          "box": {
            "id": "obj-midiin",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["int"],
            "patching_rect": [15.0, 50.0, 50.0, 22.0],
            "text": "midiin"
          }
        },
        // MIDI parse
        {
          "box": {
            "id": "obj-midiparse",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 7,
            "outlettype": ["", "", "", "int", "int", "int", "int"],
            "patching_rect": [15.0, 80.0, 100.0, 22.0],
            "text": "midiparse"
          }
        },
        // Route CC messages
        {
          "box": {
            "id": "obj-route",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 2,
            "outlettype": ["", ""],
            "patching_rect": [15.0, 110.0, 60.0, 22.0],
            "text": "route ctl"
          }
        },
        // Audio pass-through (left)
        {
          "box": {
            "id": "obj-plugin-left",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["signal"],
            "patching_rect": [400.0, 100.0, 60.0, 22.0],
            "text": "plugin~"
          }
        },
        // Audio pass-through (right)
        {
          "box": {
            "id": "obj-plugin-right",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["signal"],
            "patching_rect": [470.0, 100.0, 60.0, 22.0],
            "text": "plugin~"
          }
        },
        // Audio output (left)
        {
          "box": {
            "id": "obj-out-left",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["signal"],
            "patching_rect": [400.0, 150.0, 60.0, 22.0],
            "text": "out~ 1"
          }
        },
        // Audio output (right)
        {
          "box": {
            "id": "obj-out-right",
            "maxclass": "newobj",
            "numinlets": 1,
            "numoutlets": 1,
            "outlettype": ["signal"],
            "patching_rect": [470.0, 150.0, 60.0, 22.0],
            "text": "out~ 2"
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
            "patching_rect": [250.0, 50.0, 60.0, 22.0],
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
            "patching_rect": [250.0, 80.0, 60.0, 22.0],
            "text": "loadbang"
          }
        },
        // Info text
        {
          "box": {
            "id": "obj-info",
            "maxclass": "comment",
            "numinlets": 1,
            "numoutlets": 0,
            "patching_rect": [15.0, 200.0, 400.0, 20.0],
            "presentation": 1,
            "presentation_rect": [10.0, 35.0, 400.0, 20.0],
            "text": "CC 13-20 → Device parameters on selected track",
            "fontsize": 11.0
          }
        }
      ],
      "lines": [
        // MIDI input to parse
        {
          "patchline": {
            "destination": ["obj-midiparse", 0],
            "source": ["obj-midiin", 0]
          }
        },
        // Parse to route
        {
          "patchline": {
            "destination": ["obj-route", 0],
            "source": ["obj-midiparse", 2]
          }
        },
        // Route to JS
        {
          "patchline": {
            "destination": ["obj-js", 0],
            "source": ["obj-route", 0]
          }
        },
        // Audio pass-through left
        {
          "patchline": {
            "destination": ["obj-out-left", 0],
            "source": ["obj-plugin-left", 0]
          }
        },
        // Audio pass-through right
        {
          "patchline": {
            "destination": ["obj-out-right", 0],
            "source": ["obj-plugin-right", 0]
          }
        },
        // Loadbang to message
        {
          "patchline": {
            "destination": ["obj-loadmsg", 0],
            "source": ["obj-loadbang", 0]
          }
        },
        // Loadbang message to JS
        {
          "patchline": {
            "destination": ["obj-js", 0],
            "source": ["obj-loadmsg", 0]
          }
        }
      ],
      "parameters": {},
      "dependency_cache": [
        {
          "name": "code/cc-router.js",
          "type": "TEXT",
          "implicit": 1
        }
      ],
      "autosave": 0
    }
  };
}

module.exports = { createMaxForLiveDevice };