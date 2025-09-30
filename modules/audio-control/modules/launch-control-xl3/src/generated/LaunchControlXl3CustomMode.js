// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'));
  } else {
    factory(root.LaunchControlXl3CustomMode || (root.LaunchControlXl3CustomMode = {}), root.KaitaiStream);
  }
})(typeof self !== 'undefined' ? self : this, function (LaunchControlXl3CustomMode_, KaitaiStream) {
/**
 * Custom mode configuration format for Novation Launch Control XL3.
 * 
 * The custom mode data is split across 3 SysEx message pages:
 * - Page 1: Mode name + controls 0-15 + labels
 * - Page 2: Controls 16-31 + labels
 * - Page 3: Controls 32-47 + labels
 * 
 * Empirically discovered format through MIDI traffic analysis.
 */

var LaunchControlXl3CustomMode = (function() {
  LaunchControlXl3CustomMode.ControlBehavior = Object.freeze({
    ABSOLUTE: 12,
    RELATIVE: 13,
    TOGGLE: 14,

    12: "ABSOLUTE",
    13: "RELATIVE",
    14: "TOGGLE",
  });

  function LaunchControlXl3CustomMode(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  LaunchControlXl3CustomMode.prototype._read = function() {
    this.page1 = new CustomModePage(this._io, this, this._root);
    this.page2 = new CustomModePage(this._io, this, this._root);
    this.page3 = new CustomModePage(this._io, this, this._root);
  }

  var ControlDefinition = LaunchControlXl3CustomMode.ControlDefinition = (function() {
    function ControlDefinition(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    ControlDefinition.prototype._read = function() {
      this.controlType = this._io.readU1();
      this.controlId = this._io.readU1();
      this.midiChannel = this._io.readU1();
      this.ccNumber = this._io.readU1();
      this.minValue = this._io.readU1();
      this.maxValue = this._io.readU1();
      this.behavior = this._io.readU1();
    }

    /**
     * Control type (0x00=knob top, 0x05=knob bottom, 0x09=fader, etc)
     */

    /**
     * Hardware control ID (0x10-0x3F)
     */

    /**
     * MIDI channel (0-15)
     */

    /**
     * MIDI CC number (0-127)
     */

    /**
     * Minimum value (usually 0)
     */

    /**
     * Maximum value (usually 127)
     */

    /**
     * Control behavior (absolute/relative/toggle)
     */

    return ControlDefinition;
  })();

  var ControlLabel = LaunchControlXl3CustomMode.ControlLabel = (function() {
    function ControlLabel(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    ControlLabel.prototype._read = function() {
      this.lengthMarker = this._io.readU1();
      this.controlId = this._io.readU1();
      if (this.labelLength > 0) {
        this.nameBytes = KaitaiStream.bytesToStr(this._io.readBytes(this.labelLength), "ASCII");
      }
    }

    /**
     * Check if this marks end of labels section
     */
    Object.defineProperty(ControlLabel.prototype, 'isTerminator', {
      get: function() {
        if (this._m_isTerminator !== undefined)
          return this._m_isTerminator;
        this._m_isTerminator =  ((this.lengthMarker < 96) || (this.controlId < 16)) ;
        return this._m_isTerminator;
      }
    });

    /**
     * Calculate label length from marker byte
     */
    Object.defineProperty(ControlLabel.prototype, 'labelLength', {
      get: function() {
        if (this._m_labelLength !== undefined)
          return this._m_labelLength;
        this._m_labelLength = this.lengthMarker - 96;
        return this._m_labelLength;
      }
    });

    /**
     * Marker byte encoding string length (0x60-0x6F).
     * Length = marker - 0x60 (0-15 characters).
     */

    /**
     * Control ID this label applies to (0x10-0x3F)
     */

    /**
     * Label text (ASCII, variable length)
     */

    return ControlLabel;
  })();

  var CustomModePage = LaunchControlXl3CustomMode.CustomModePage = (function() {
    function CustomModePage(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    CustomModePage.prototype._read = function() {
      this.header = new PageHeader(this._io, this, this._root);
      if (this._parent._index == 0) {
        this.modeNameSection = new ModeName(this._io, this, this._root);
      }
      this.controls = [];
      for (var i = 0; i < 16; i++) {
        this.controls.push(new ControlDefinition(this._io, this, this._root));
      }
      this._raw_labels = this._io.readBytesFull();
      var _io__raw_labels = new KaitaiStream(this._raw_labels);
      this.labels = new LabelSection(_io__raw_labels, this, this._root);
    }

    /**
     * Mode name only present in first page
     */

    /**
     * 16 control definitions per page
     */

    /**
     * Variable-length label section
     */

    return CustomModePage;
  })();

  var LabelSection = LaunchControlXl3CustomMode.LabelSection = (function() {
    function LabelSection(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    LabelSection.prototype._read = function() {
      this.unknownPadding = this._io.readBytes(3);
      this.labels = [];
      var i = 0;
      do {
        var _ = new ControlLabel(this._io, this, this._root);
        this.labels.push(_);
        i++;
      } while (!( ((this._io.isEof()) || (_.isTerminator)) ));
    }

    /**
     * Padding bytes before labels
     */

    return LabelSection;
  })();

  var ModeName = LaunchControlXl3CustomMode.ModeName = (function() {
    function ModeName(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    ModeName.prototype._read = function() {
      this.nameMarker = this._io.readBytes(2);
      if (!((KaitaiStream.byteArrayCompare(this.nameMarker, new Uint8Array([6, 32])) == 0))) {
        throw new KaitaiStream.ValidationNotEqualError(new Uint8Array([6, 32]), this.nameMarker, this._io, "/types/mode_name/seq/0");
      }
      this.nameLength = this._io.readU1();
      if (this.nameLength > 0) {
        this.nameBytes = KaitaiStream.bytesToStr(this._io.readBytes(this.nameLength), "ASCII");
      }
    }

    /**
     * Length of mode name (0-8 characters)
     */

    return ModeName;
  })();

  var PageHeader = LaunchControlXl3CustomMode.PageHeader = (function() {
    function PageHeader(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    PageHeader.prototype._read = function() {
      this.pageMarker = this._io.readBytes(2);
      if (!((KaitaiStream.byteArrayCompare(this.pageMarker, new Uint8Array([6, 0])) == 0))) {
        throw new KaitaiStream.ValidationNotEqualError(new Uint8Array([6, 0]), this.pageMarker, this._io, "/types/page_header/seq/0");
      }
      this.pageNumber = this._io.readU1();
      this.unknown1 = this._io.readBytes(3);
    }

    /**
     * Page number (0, 1, or 2)
     */

    return PageHeader;
  })();

  /**
   * First page with mode name and controls 0-15
   */

  /**
   * Second page with controls 16-31
   */

  /**
   * Third page with controls 32-47
   */

  return LaunchControlXl3CustomMode;
})();
LaunchControlXl3CustomMode_.LaunchControlXl3CustomMode = LaunchControlXl3CustomMode;
});
