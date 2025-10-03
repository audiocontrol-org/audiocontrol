/**
 * Main Max for Live integration file
 * This file provides the Max interface functions and handles the integration
 */

import { CCRouter } from '@/cc-router';
import { logger, LogLevel } from '@/logger';

// Max for Live global configuration
autowatch = 1;
outlets = 3; // 0: debug display, 1: build timestamp, 2: extra
inlets = 2; // inlet 0: MIDI, inlet 1: live.thisdevice notifications

// Global router instance - used by all functions below
// @ts-ignore - prevent tree-shaking removal
var ccRouter: CCRouter;
var liveReady = false;

/**
 * Called when live.thisdevice sends a bang (Live API is ready)
 */
function bang(): void {
  if (!liveReady) {
    liveReady = true;
    logger.info("Live API ready (bang received), initializing...");
    initializeRouter();
  }
}

/**
 * Called for other messages from live.thisdevice
 */
function anything(): void {
  const message = messagename;
  logger.debug("Received message '" + message + "' from live.thisdevice");
}

/**
 * Called when the Max object loads
 */
function loadbang(): void {
  logger.info("Waiting for Live API to initialize...");
  outlet(0, "set", "Initializing...");
}

/**
 * Initialize the router once Live API is ready
 */
function initializeRouter(): void {
  ccRouter = new CCRouter();
  ccRouter.setupLiveAPI();

  // Get current timestamp
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = hours + ":" + minutes + ":" + seconds;

  logger.info("CC Router for Max for Live v1.0 loaded at " + timestamp);
  logger.info("Launch Control XL3 CC 13-20 mapped to device 0 parameters 0-7");
  logger.info("Type 'help' for available commands");

  // Initialize router - set to INFO level by default for less verbosity
  logger.setLogLevel(LogLevel.INFO);
  ccRouter.printConfiguration();

  // Send status to display
  outlet(0, "set", "CC Router v1.0 - Ready");

  // Send build timestamp to display
  outlet(1, "set", "Build: " + timestamp);

  // Show available devices on the track
  logger.info("=== Track Device Chain ===");
  const devices = ccRouter.getSelectedTrackDevices();
  if (devices.length > 0) {
    for (let i = 0; i < devices.length; i++) {
      logger.info("Device " + i + ": " + devices[i].name + " (" + devices[i].parameterCount + " params)");
    }
  } else {
    logger.info("No devices found on track");
  }
  logger.info("========================");

  // Auto-detect and apply canonical mapping on load
  logger.info("Auto-detecting plugin mapping...");
  ccRouter.autoApplyCanonicalMapping(1);
}

/**
 * Handle incoming MIDI CC messages from midiparse
 * Input format: [ccNumber, value] where midiparse outlet 2 sends controller messages
 */
function list(): void {
  const args = arrayfromargs(arguments);

  if (args.length < 2) {
    logger.warn("Invalid MIDI format (expected 2 values, got " + args.length + ")");
    return;
  }

  // midiparse outlet 2 sends: [ccNumber, value]
  const ccNumber = args[0];
  const value = args[1];

  // Send status to display
  outlet(0, "set", "RX: CC" + ccNumber + "=" + value);

  // Only route if ccRouter is initialized
  if (!ccRouter) {
    logger.warn("Received MIDI before initialization complete");
    return;
  }

  // Route through CCRouter (channel is always 0 since midiparse strips it)
  ccRouter.handleCCMessage(ccNumber, value, 0);
}

function setmapping(): void {
  const args = arrayfromargs(arguments);
  if (args.length < 3) {
    error("Usage: setmapping <ccNumber> <deviceIndex> <parameterIndex> [parameterName] [curve]\n");
    return;
  }
  const ccNumber = args[0];
  const deviceIndex = args[1];
  const parameterIndex = args[2];
  const parameterName = args.length > 3 ? args[3] : undefined;
  const curve = args.length > 4 ? args[4] : 'linear';
  ccRouter.setMapping(ccNumber, deviceIndex, parameterIndex, parameterName, curve);
}

function removemapping(ccNumber: number): void {
  ccRouter.removeMapping(ccNumber);
}

function debug(enabled: number): void {
  ccRouter.setDebugMode(enabled === 1);
}

/**
 * Set the log level for controlling output verbosity
 * Usage: setloglevel <level>
 * Levels: 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG, 4=TRACE
 */
function setloglevel(level: number): void {
  if (level < 0 || level > 4) {
    error("Invalid log level. Use 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG, 4=TRACE\n");
    return;
  }
  logger.setLogLevel(level as LogLevel);
}

function testcc(ccNumber: number, value: number): void {
  ccRouter.handleCCMessage(ccNumber, value, 0);
}

function config(): void {
  ccRouter.printConfiguration();
}

function trackinfo(): void {
  const trackInfo = ccRouter.getSelectedTrackInfo();
  if (trackInfo) {
    logger.info("Selected Track: " + trackInfo.name + " (ID: " + trackInfo.id + ")");
    logger.info("Devices: " + trackInfo.deviceCount);
    const devices = ccRouter.getSelectedTrackDevices();
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      logger.info("  Device " + device.index + ": " + device.name + " (" + device.parameterCount + " parameters)");
    }
  } else {
    logger.info("No track selected");
  }
}

/**
 * Auto-apply canonical mapping for detected plugin
 * Usage: automap [deviceIndex]
 */
function automap(deviceIndex?: number): void {
  if (!ccRouter) {
    logger.warn("Not initialized");
    return;
  }
  ccRouter.autoApplyCanonicalMapping(deviceIndex);
}

/**
 * Set the MIDI controller to use for canonical mappings
 * Usage: setcontroller <controllerModel>
 */
function setcontroller(controllerModel: string): void {
  if (!ccRouter) {
    logger.warn("Not initialized");
    return;
  }
  ccRouter.setController(controllerModel);
}

/**
 * List all available controllers
 */
function listcontrollers(): void {
  if (!ccRouter) {
    logger.warn("Not initialized");
    return;
  }
  const controllers = ccRouter.getControllers();
  logger.info("=== Available Controllers ===");
  for (let i = 0; i < controllers.length; i++) {
    logger.info(controllers[i].manufacturer + " " + controllers[i].model);
  }
  logger.info("===========================");
}

function setupfor(pluginType: string): void {
  // ...
}

/*
// Unused functions commented out for reference

function msg_int(value: number): void {
  ccRouter.handleCCMessage(13, value, 0);
}

function msg_float(value: number): void {
  const midiValue = Math.round(value * 127);
  ccRouter.handleCCMessage(13, midiValue, 0);
}

function setupEQ8Mappings(): void {
  // ...
}

function setupCompressorMappings(): void {
  // ...
}

function setupReverbMappings(): void {
  // ...
}

function setupOperatorMappings(): void {
  // ...
}

function track_observer(): void {
  const trackInfo = ccRouter.getSelectedTrackInfo();
  if (trackInfo) {
    post("Track selection changed to: " + trackInfo.name + "\n");
  }
}

function help(): void {
  post("=== CC Router Commands ===\n");
  post("loadbang - Reload the router\n");
  post("config - Show current configuration\n");
  post("trackinfo - Show selected track information\n");
  post("debug <0|1> - Toggle debug mode\n");
  post("testcc <ccNumber> <value> - Test a CC message\n");
  post("setmapping <cc> <device> <param> [name] [curve] - Add/update mapping\n");
  post("removemapping <cc> - Remove mapping\n");
  post("setupfor <plugin> - Configure for specific plugin (eq8, compressor, reverb, operator)\n");
  post("help - Show this help\n");
}

function bang(): void {
  trackinfo();
}

function closebang(): void {
  post("CC Router closed\n");
}
*/

// IMPORTANT: Functions are already declared at top level and accessible to Max v8
// No need for explicit global assignment - v8 object sees top-level declarations