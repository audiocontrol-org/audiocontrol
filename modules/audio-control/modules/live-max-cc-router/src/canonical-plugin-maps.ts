/**
 * Auto-generated from canonical MIDI maps
 * DO NOT EDIT MANUALLY - Run 'npm run convert-maps' to regenerate
 */

export interface PluginMapping {
  controller: {
    manufacturer?: string;
    model?: string;
  };
  pluginName: string;
  pluginManufacturer: string;
  mappings: {
    [ccNumber: number]: {
      deviceIndex: number;
      parameterIndex: number;
      parameterName: string;
      curve: 'linear' | 'exponential' | 'logarithmic';
    };
  };
  metadata: {
    name?: string;
    description?: string;
    version?: string;
  };
}

export interface Controller {
  manufacturer: string;
  model: string;
}

export const CANONICAL_PLUGIN_MAPS: { [key: string]: PluginMapping } = {
  "launch-control-xl-3_channev": {
    "controller": {
      "manufacturer": "Novation",
      "model": "Launch Control XL 3"
    },
    "pluginName": "CHANNEV",
    "pluginManufacturer": "Analog Obsession",
    "mappings": {
      "5": {
        "deviceIndex": 1,
        "parameterIndex": 2,
        "parameterName": "Mic Pre Gain",
        "curve": "linear"
      },
      "6": {
        "deviceIndex": 1,
        "parameterIndex": 10,
        "parameterName": "Line Amp",
        "curve": "linear"
      },
      "10": {
        "deviceIndex": 1,
        "parameterIndex": 21,
        "parameterName": "Comp Threshold",
        "curve": "linear"
      },
      "11": {
        "deviceIndex": 1,
        "parameterIndex": 26,
        "parameterName": "Limit Threshold",
        "curve": "linear"
      },
      "12": {
        "deviceIndex": 1,
        "parameterIndex": 31,
        "parameterName": "Tape Output",
        "curve": "linear"
      },
      "13": {
        "deviceIndex": 1,
        "parameterIndex": 5,
        "parameterName": "High Pass",
        "curve": "linear"
      },
      "14": {
        "deviceIndex": 1,
        "parameterIndex": 19,
        "parameterName": "EQ High Pass",
        "curve": "linear"
      },
      "17": {
        "deviceIndex": 1,
        "parameterIndex": 25,
        "parameterName": "Comp Dry/Wet",
        "curve": "linear"
      },
      "18": {
        "deviceIndex": 1,
        "parameterIndex": 22,
        "parameterName": "Comp Ratio",
        "curve": "linear"
      },
      "19": {
        "deviceIndex": 1,
        "parameterIndex": 29,
        "parameterName": "Limit Mix",
        "curve": "linear"
      },
      "20": {
        "deviceIndex": 1,
        "parameterIndex": 30,
        "parameterName": "Tape Drive",
        "curve": "linear"
      },
      "22": {
        "deviceIndex": 1,
        "parameterIndex": 12,
        "parameterName": "EQ Low Freq",
        "curve": "linear"
      },
      "23": {
        "deviceIndex": 1,
        "parameterIndex": 14,
        "parameterName": "EQ Low-Mid Freq",
        "curve": "linear"
      },
      "24": {
        "deviceIndex": 1,
        "parameterIndex": 16,
        "parameterName": "EQ High-Mid Freq",
        "curve": "linear"
      },
      "25": {
        "deviceIndex": 1,
        "parameterIndex": 18,
        "parameterName": "EQ High Freq",
        "curve": "linear"
      },
      "26": {
        "deviceIndex": 1,
        "parameterIndex": 23,
        "parameterName": "Comp Release",
        "curve": "linear"
      },
      "27": {
        "deviceIndex": 1,
        "parameterIndex": 27,
        "parameterName": "Limit Release",
        "curve": "linear"
      },
      "29": {
        "deviceIndex": 1,
        "parameterIndex": 3,
        "parameterName": "Low Shelf",
        "curve": "linear"
      },
      "30": {
        "deviceIndex": 1,
        "parameterIndex": 11,
        "parameterName": "EQ Low Gain",
        "curve": "linear"
      },
      "31": {
        "deviceIndex": 1,
        "parameterIndex": 13,
        "parameterName": "EQ Low-Mid Gain",
        "curve": "linear"
      },
      "32": {
        "deviceIndex": 1,
        "parameterIndex": 15,
        "parameterName": "EQ High-Mid Gain",
        "curve": "linear"
      },
      "33": {
        "deviceIndex": 1,
        "parameterIndex": 17,
        "parameterName": "EQ High Gain",
        "curve": "linear"
      },
      "34": {
        "deviceIndex": 1,
        "parameterIndex": 24,
        "parameterName": "Comp Gain",
        "curve": "linear"
      },
      "35": {
        "deviceIndex": 1,
        "parameterIndex": 28,
        "parameterName": "Limit Gain",
        "curve": "linear"
      },
      "39": {
        "deviceIndex": 1,
        "parameterIndex": 40,
        "parameterName": "EQ Low-Mid Q",
        "curve": "linear"
      },
      "40": {
        "deviceIndex": 1,
        "parameterIndex": 41,
        "parameterName": "EQ High-Mid Q",
        "curve": "linear"
      },
      "53": {
        "deviceIndex": 1,
        "parameterIndex": 4,
        "parameterName": "High Shelf",
        "curve": "linear"
      }
    },
    "metadata": {
      "name": "Analog Obsession CHANNEV Mapping",
      "description": "Professional channel strip plugin control with Launch Control XL 3's default CC layout",
      "version": "1.0.0"
    }
  },
  "launch-control-xl-3_mini-v4": {
    "controller": {
      "manufacturer": "Novation",
      "model": "Launch Control XL 3"
    },
    "pluginName": "Mini V4",
    "pluginManufacturer": "Arturia",
    "mappings": {},
    "metadata": {
      "name": "Arturia Mini V4 Mapping",
      "description": "MIDI CC mapping for Arturia Mini V4 Minimoog emulation plugin",
      "version": "1.0.0"
    }
  },
  "launch-control-xl-3_jup-8-v4": {
    "controller": {
      "manufacturer": "Novation",
      "model": "Launch Control XL 3"
    },
    "pluginName": "Jup-8 V4",
    "pluginManufacturer": "Arturia",
    "mappings": {},
    "metadata": {
      "name": "Arturia Jup-8 V4 Mapping",
      "description": "MIDI CC mapping for Arturia Jup-8 V4 Jupiter-8 emulation",
      "version": "1.0.0"
    }
  },
  "launch-control-xl-3_tal-j-8": {
    "controller": {
      "manufacturer": "Novation",
      "model": "Launch Control XL 3"
    },
    "pluginName": "TAL-J-8",
    "pluginManufacturer": "TAL Software",
    "mappings": {
      "13": {
        "deviceIndex": 1,
        "parameterIndex": 105,
        "parameterName": "VCF Cutoff",
        "curve": "linear"
      },
      "14": {
        "deviceIndex": 1,
        "parameterIndex": 103,
        "parameterName": "HPF Cutoff",
        "curve": "linear"
      },
      "15": {
        "deviceIndex": 1,
        "parameterIndex": 11,
        "parameterName": "Portamento",
        "curve": "linear"
      },
      "16": {
        "deviceIndex": 1,
        "parameterIndex": 59,
        "parameterName": "PWM Amount",
        "curve": "linear"
      },
      "17": {
        "deviceIndex": 1,
        "parameterIndex": 87,
        "parameterName": "Cross Mod",
        "curve": "linear"
      },
      "18": {
        "deviceIndex": 1,
        "parameterIndex": 91,
        "parameterName": "Noise Level",
        "curve": "linear"
      },
      "19": {
        "deviceIndex": 1,
        "parameterIndex": 137,
        "parameterName": "Chorus Mix",
        "curve": "linear"
      },
      "21": {
        "deviceIndex": 1,
        "parameterIndex": 107,
        "parameterName": "Resonance",
        "curve": "linear"
      },
      "22": {
        "deviceIndex": 1,
        "parameterIndex": 43,
        "parameterName": "LFO Rate",
        "curve": "linear"
      },
      "23": {
        "deviceIndex": 1,
        "parameterIndex": 89,
        "parameterName": "Osc 1 Range",
        "curve": "linear"
      },
      "24": {
        "deviceIndex": 1,
        "parameterIndex": 91,
        "parameterName": "Osc 1 Waveform",
        "curve": "linear"
      },
      "25": {
        "deviceIndex": 1,
        "parameterIndex": 24,
        "parameterName": "Osc 1 Fine",
        "curve": "linear"
      },
      "26": {
        "deviceIndex": 1,
        "parameterIndex": 85,
        "parameterName": "VCO Mix",
        "curve": "linear"
      },
      "27": {
        "deviceIndex": 1,
        "parameterIndex": 44,
        "parameterName": "LFO 2 Rate",
        "curve": "linear"
      },
      "28": {
        "deviceIndex": 1,
        "parameterIndex": 117,
        "parameterName": "Key Follow",
        "curve": "linear"
      },
      "29": {
        "deviceIndex": 1,
        "parameterIndex": 111,
        "parameterName": "Env Amt",
        "curve": "linear"
      },
      "30": {
        "deviceIndex": 1,
        "parameterIndex": 47,
        "parameterName": "LFO Delay",
        "curve": "linear"
      },
      "31": {
        "deviceIndex": 1,
        "parameterIndex": 93,
        "parameterName": "Osc 2 Range",
        "curve": "linear"
      },
      "33": {
        "deviceIndex": 1,
        "parameterIndex": 97,
        "parameterName": "Osc 2 Fine",
        "curve": "linear"
      },
      "34": {
        "deviceIndex": 1,
        "parameterIndex": 98,
        "parameterName": "Osc 2 Detune",
        "curve": "linear"
      },
      "35": {
        "deviceIndex": 1,
        "parameterIndex": 14,
        "parameterName": "Bend Range",
        "curve": "linear"
      },
      "36": {
        "deviceIndex": 1,
        "parameterIndex": 125,
        "parameterName": "Velocity Sens",
        "curve": "linear"
      },
      "41": {
        "deviceIndex": 1,
        "parameterIndex": 139,
        "parameterName": "Delay Mix",
        "curve": "linear"
      },
      "53": {
        "deviceIndex": 1,
        "parameterIndex": 65,
        "parameterName": "Attack",
        "curve": "linear"
      },
      "54": {
        "deviceIndex": 1,
        "parameterIndex": 67,
        "parameterName": "Decay",
        "curve": "linear"
      },
      "55": {
        "deviceIndex": 1,
        "parameterIndex": 69,
        "parameterName": "Sustain",
        "curve": "linear"
      },
      "56": {
        "deviceIndex": 1,
        "parameterIndex": 71,
        "parameterName": "Release",
        "curve": "linear"
      },
      "57": {
        "deviceIndex": 1,
        "parameterIndex": 85,
        "parameterName": "Osc Mix",
        "curve": "linear"
      },
      "58": {
        "deviceIndex": 1,
        "parameterIndex": 115,
        "parameterName": "LFO Filter",
        "curve": "linear"
      },
      "59": {
        "deviceIndex": 1,
        "parameterIndex": 123,
        "parameterName": "LFO VCA",
        "curve": "linear"
      },
      "60": {
        "deviceIndex": 1,
        "parameterIndex": 1,
        "parameterName": "Master Volume",
        "curve": "linear"
      },
      "61": {
        "deviceIndex": 1,
        "parameterIndex": 95,
        "parameterName": "Osc 2 Waveform",
        "curve": "linear"
      }
    },
    "metadata": {
      "name": "TAL-J-8 Jupiter 8 Mapping",
      "description": "Optimized MIDI CC mapping for TAL-J-8 Jupiter 8 emulation plugin",
      "version": "1.0.0"
    }
  }
};

export const AVAILABLE_CONTROLLERS: { [key: string]: Controller } = {
  "launch-control-xl-3": {
    "manufacturer": "Novation",
    "model": "Launch Control XL 3"
  }
};

/**
 * Get plugin mapping by controller and plugin name (case-insensitive, fuzzy match)
 */
export function getPluginMapping(controllerModel: string, pluginName: string): PluginMapping | undefined {
  const controllerKey = controllerModel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const pluginKey = pluginName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const key = `${controllerKey}_${pluginKey}`;
  return CANONICAL_PLUGIN_MAPS[key];
}

/**
 * Get all available controller models
 */
export function getAvailableControllers(): Controller[] {
  return Object.values(AVAILABLE_CONTROLLERS);
}
