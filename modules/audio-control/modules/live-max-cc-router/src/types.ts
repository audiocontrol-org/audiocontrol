// Max for Live TypeScript definitions
// These types provide IntelliSense and type safety for Max's JavaScript environment

// Declare Max for Live globals
declare global {
  // Max global variables
  var outlets: number;
  var inlets: number;
  var autowatch: number;
  var messagename: string; // Name of incoming message (for anything() function)

  // Max global functions
  function post(message: string): void;
  function error(message: string): void;
  function arrayfromargs(args: IArguments, start?: number): any[];
  function outlet(outlet: number, ...args: any[]): void;

  // Max object constructor
  var LiveAPI: {
    new (path: string): LiveAPIObject;
  };
}

// LiveAPI object interface
export interface LiveAPIObject {
  id: string;
  property: string;
  get(property: string): any;
  set(property: string, value: any): void;
  call(method: string, ...args: any[]): any;
}

// MIDI Message interface
export interface MIDIMessage {
  ccNumber: number;
  value: number;
  channel: number;
  timestamp: number;
}

// Parameter mapping configuration
export interface ParameterMapping {
  ccNumber: number;
  deviceIndex: number;
  parameterIndex: number;
  parameterName: string;
  minValue?: number;
  maxValue?: number;
  curve: 'linear' | 'exponential' | 'logarithmic';
}

// Track information
export interface TrackInfo {
  id: number;
  name: string;
  deviceCount: number;
}

// Device information
export interface DeviceInfo {
  index: number;
  name: string;
  parameterCount: number;
}

// Configuration object for the CC router
export interface CCRouterConfig {
  mappings: ParameterMapping[];
  debugMode: boolean;
  selectedTrackOnly: boolean;
}