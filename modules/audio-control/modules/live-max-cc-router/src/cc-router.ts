/**
 * CC Router for Max for Live - TypeScript Implementation
 * Routes MIDI CC messages to parameters on the currently selected track
 */

import { ParameterMapping, LiveAPIObject, TrackInfo, DeviceInfo } from '@/types';
import { CANONICAL_PLUGIN_MAPS, getPluginMapping, getAvailableControllers, Controller } from '@/canonical-plugin-maps';
import { logger, LogLevel } from '@/logger';

export class CCRouter {
  private mappings: ParameterMapping[] = [];
  private selectedTrackId: number = -1;
  private liveAPI: LiveAPIObject | null = null;
  private selectedController: string = 'Launch Control XL 3'; // Default controller

  constructor() {
    this.initializeDefaultMappings();
    // Don't call setupLiveAPI in constructor - causes crash
    // Call it explicitly from loadbang() instead
  }

  /**
   * Initialize default Launch Control XL3 mappings
   * NOTE: Device index 0 is the cc-router itself, so we target device 1 (first plugin after cc-router)
   */
  private initializeDefaultMappings(): void {
    this.mappings = [
      { ccNumber: 13, deviceIndex: 1, parameterIndex: 0, parameterName: 'Knob 1', curve: 'linear' },
      { ccNumber: 14, deviceIndex: 1, parameterIndex: 1, parameterName: 'Knob 2', curve: 'linear' },
      { ccNumber: 15, deviceIndex: 1, parameterIndex: 2, parameterName: 'Knob 3', curve: 'linear' },
      { ccNumber: 16, deviceIndex: 1, parameterIndex: 3, parameterName: 'Knob 4', curve: 'linear' },
      { ccNumber: 17, deviceIndex: 1, parameterIndex: 4, parameterName: 'Knob 5', curve: 'linear' },
      { ccNumber: 18, deviceIndex: 1, parameterIndex: 5, parameterName: 'Knob 6', curve: 'linear' },
      { ccNumber: 19, deviceIndex: 1, parameterIndex: 6, parameterName: 'Knob 7', curve: 'linear' },
      { ccNumber: 20, deviceIndex: 1, parameterIndex: 7, parameterName: 'Knob 8', curve: 'linear' }
    ];
  }

  /**
   * Set up Live API connection and observers
   * Must be called after constructor completes
   */
  public setupLiveAPI(): void {
    try {
      this.liveAPI = new LiveAPI("live_set");

      // Skip track observer - causes crash
      // this.setupTrackObserver();

      logger.info("Live API initialized (no observer)");
    } catch (error) {
      logger.error("Failed to initialize Live API - " + error);
    }
  }

  /**
   * Set up track selection observer
   */
  private setupTrackObserver(): void {
    try {
      const observer = new LiveAPI("live_set view");
      observer.property = "selected_track";
      observer.id = "track_observer";

      logger.debug("Track observer setup complete");
    } catch (err) {
      logger.error("Failed to setup track observer - " + err);
    }
  }

  /**
   * Handle incoming MIDI CC message
   */
  public handleCCMessage(ccNumber: number, value: number, channel: number): void {
    const mapping = this.findMapping(ccNumber);

    if (!mapping) {
      logger.debug("No mapping found for CC " + ccNumber);
      outlet(0, "set", "CC" + ccNumber + " - No mapping");
      return;
    }

    logger.trace("Processing CC " + ccNumber + " = " + value + " -> Device[" + mapping.deviceIndex + "] Param[" + mapping.parameterIndex + "]");

    this.routeToSelectedTrack(mapping, value);
  }

  /**
   * Find mapping for given CC number
   */
  private findMapping(ccNumber: number): ParameterMapping | null {
    for (let i = 0; i < this.mappings.length; i++) {
      const mapping = this.mappings[i];
      if (!mapping) {
        continue;
      }
      if (mapping.ccNumber === ccNumber) {
        return mapping;
      }
    }
    return null;
  }

  /**
   * Route CC value to parameter on selected track
   */
  private routeToSelectedTrack(mapping: ParameterMapping, value: number): void {
    try {
      const selectedTrack = new LiveAPI("live_set view selected_track");

      if (!selectedTrack || selectedTrack.id === "0") {
        logger.warn("No track selected");
        outlet(0, "set", "ERROR: No track selected");
        return;
      }

      // Check if device exists
      const devices = selectedTrack.get("devices");
      const trackName = selectedTrack.get("name");

      logger.trace("Track '" + trackName + "' has " + devices.length + " devices");

      if (mapping.deviceIndex >= devices.length) {
        logger.debug("ERROR - Device[" + mapping.deviceIndex + "] not found");
        logger.debug("  Track: " + trackName);
        logger.debug("  Available devices: " + devices.length + " (indices 0-" + (devices.length - 1) + ")");

        // List all devices
        for (let i = 0; i < devices.length; i++) {
          const dev = new LiveAPI("live_set view selected_track devices " + i);
          logger.debug("    Device[" + i + "]: " + dev.get("name"));
        }

        outlet(0, "set", "ERROR: Dev[" + mapping.deviceIndex + "] not found (have " + devices.length + ")");
        return;
      }

      // Get target device
      const devicePath = "live_set view selected_track devices " + mapping.deviceIndex;
      const targetDevice = new LiveAPI(devicePath);
      const deviceName = targetDevice.get("name");

      // Check if parameter exists
      const parameters = targetDevice.get("parameters");
      if (mapping.parameterIndex >= parameters.length) {
        logger.debug("ERROR - Parameter[" + mapping.parameterIndex + "] not found");
        logger.debug("  Device[" + mapping.deviceIndex + "]: " + deviceName);
        logger.debug("  Available parameters: " + parameters.length + " (indices 0-" + (parameters.length - 1) + ")");

        // List first 10 params
        const maxShow = Math.min(10, parameters.length);
        for (let i = 0; i < maxShow; i++) {
          const pName = targetDevice.get("parameters " + i + " name");
          logger.debug("    Param[" + i + "]: " + pName);
        }
        if (parameters.length > 10) {
          logger.debug("    ... and " + (parameters.length - 10) + " more");
        }

        outlet(0, "set", "ERROR: Param[" + mapping.parameterIndex + "] not found (have " + parameters.length + ")");
        return;
      }

      // Transform value
      const normalizedValue = this.transformValue(value, mapping);

      // Create LiveAPI for the specific parameter
      const parameterPath = "live_set view selected_track devices " + mapping.deviceIndex + " parameters " + mapping.parameterIndex;
      const parameter = new LiveAPI(parameterPath);

      // Set parameter value
      parameter.set("value", normalizedValue);

      const paramName = parameter.get("name");

      logger.trace("SUCCESS!");
      logger.trace("  Track: " + trackName);
      logger.trace("  Device[" + mapping.deviceIndex + "]: " + deviceName);
      logger.trace("  Param[" + mapping.parameterIndex + "]: " + paramName);
      logger.trace("  Value: " + value + " (MIDI) -> " + normalizedValue.toFixed(3) + " (normalized)");

      // Send success message to display
      outlet(0, "set", "OK: Dev[" + mapping.deviceIndex + "]:" + deviceName + " > " + paramName + "=" + normalizedValue.toFixed(2));

    } catch (err) {
      logger.error("Error routing CC - " + err);
      outlet(0, "set", "ERROR: " + err);
    }
  }

  /**
   * Transform MIDI value (0-127) to parameter value with curve and range
   */
  private transformValue(midiValue: number, mapping: ParameterMapping): number {
    // Normalize to 0-1
    let normalized = midiValue / 127.0;

    // Apply curve
    switch (mapping.curve) {
      case 'exponential':
        normalized = normalized * normalized;
        break;
      case 'logarithmic':
        normalized = Math.sqrt(normalized);
        break;
      case 'linear':
      default:
        // No transformation needed
        break;
    }

    // Apply min/max range if specified
    if (mapping.minValue !== undefined && mapping.maxValue !== undefined) {
      normalized = mapping.minValue + (normalized * (mapping.maxValue - mapping.minValue));
    }

    return normalized;
  }

  /**
   * Add or update a parameter mapping
   */
  public setMapping(ccNumber: number, deviceIndex: number, parameterIndex: number, parameterName?: string, curve?: 'linear' | 'exponential' | 'logarithmic'): void {
    const existingIndex = this.mappings.findIndex(m => m.ccNumber === ccNumber);

    const mapping: ParameterMapping = {
      ccNumber: ccNumber,
      deviceIndex: deviceIndex,
      parameterIndex: parameterIndex,
      parameterName: parameterName || ("CC " + ccNumber + " -> Param " + parameterIndex),
      curve: curve || 'linear'
    };

    if (existingIndex >= 0) {
      this.mappings[existingIndex] = mapping;
    } else {
      this.mappings.push(mapping);
    }

    logger.debug("Updated mapping CC " + ccNumber + " -> Device " + deviceIndex + " Param " + parameterIndex);
  }

  /**
   * Remove a parameter mapping
   */
  public removeMapping(ccNumber: number): void {
    this.mappings = this.mappings.filter(m => m.ccNumber !== ccNumber);

    logger.debug("Removed mapping for CC " + ccNumber);
  }

  /**
   * Auto-detect plugin on selected track and apply canonical mapping if available
   */
  public autoApplyCanonicalMapping(deviceIndex?: number): void {
    try {
      const selectedTrack = new LiveAPI("live_set view selected_track");

      if (!selectedTrack || selectedTrack.id === "0") {
        logger.warn("No track selected");
        return;
      }

      const devices = selectedTrack.get("devices");
      const targetDeviceIndex = deviceIndex !== undefined ? deviceIndex : 1; // Default to first plugin after cc-router

      if (targetDeviceIndex >= devices.length) {
        logger.warn("Device index " + targetDeviceIndex + " not found (only " + devices.length + " devices)");
        return;
      }

      // Get device name
      const devicePath = "live_set view selected_track devices " + targetDeviceIndex;
      const device = new LiveAPI(devicePath);
      const deviceNameRaw = device.get("name");
      // LiveAPI returns arrays, extract first element as string
      const deviceName = Array.isArray(deviceNameRaw) ? String(deviceNameRaw[0]) : String(deviceNameRaw);

      logger.info("Detected plugin: " + deviceName);
      logger.info("Using controller: " + this.selectedController);

      // Try to find canonical mapping for this controller + plugin combination
      const canonicalMapping = getPluginMapping(this.selectedController, deviceName);

      if (canonicalMapping) {
        logger.info("Found canonical mapping for " + canonicalMapping.controller.model + " + " + canonicalMapping.pluginName);

        // Clear existing mappings
        this.mappings = [];

        // Apply canonical mappings
        const mappingKeys = Object.keys(canonicalMapping.mappings);
        for (let i = 0; i < mappingKeys.length; i++) {
          const key = mappingKeys[i];
          if (!key) {
            throw new Error("Mapping key at index " + i + " is undefined - corrupted mapping data");
          }
          const ccNumber = parseInt(key, 10);
          const mapping = canonicalMapping.mappings[ccNumber];

          if (!mapping) {
            throw new Error("Mapping not found for CC number " + ccNumber + " - invalid mapping data structure");
          }

          this.setMapping(
            ccNumber,
            mapping.deviceIndex,
            mapping.parameterIndex,
            mapping.parameterName,
            mapping.curve
          );
        }

        logger.info("Applied " + mappingKeys.length + " canonical mappings for " + canonicalMapping.pluginName);
      } else {
        logger.warn("No canonical mapping found for " + this.selectedController + " + " + deviceName);
        logger.debug("Available mappings: " + Object.keys(CANONICAL_PLUGIN_MAPS).join(", "));
      }
    } catch (err) {
      logger.error("Error auto-applying canonical mapping - " + err);
    }
  }

  /**
   * Set the selected MIDI controller
   */
  public setController(controllerModel: string): void {
    this.selectedController = controllerModel;
    logger.info("Controller set to " + controllerModel);
  }

  /**
   * Get list of available controllers
   */
  public getControllers(): Controller[] {
    return getAvailableControllers();
  }

  /**
   * Get all current mappings
   */
  public getMappings(): ParameterMapping[] {
    return this.mappings.slice(); // Return copy
  }

  /**
   * Set debug mode (now controls log level)
   */
  public setDebugMode(enabled: boolean): void {
    if (enabled) {
      logger.setLogLevel(LogLevel.DEBUG);
    } else {
      logger.setLogLevel(LogLevel.INFO);
    }
  }

  /**
   * Get information about the currently selected track
   */
  public getSelectedTrackInfo(): TrackInfo | null {
    try {
      const selectedTrack = new LiveAPI("live_set view selected_track");

      if (!selectedTrack || selectedTrack.id === "0") {
        return null;
      }

      return {
        id: parseInt(selectedTrack.get("id")),
        name: selectedTrack.get("name"),
        deviceCount: selectedTrack.get("devices").length
      };
    } catch (err) {
      logger.error("Error getting track info - " + err);
      return null;
    }
  }

  /**
   * Get information about devices on the selected track
   */
  public getSelectedTrackDevices(): DeviceInfo[] {
    try {
      const selectedTrack = new LiveAPI("live_set view selected_track");

      if (!selectedTrack || selectedTrack.id === "0") {
        return [];
      }

      const devices = selectedTrack.get("devices");
      const deviceInfo: DeviceInfo[] = [];

      for (let i = 0; i < devices.length; i++) {
        const device = new LiveAPI("live_set view selected_track devices " + i);
        const parameters = device.get("parameters");

        deviceInfo.push({
          index: i,
          name: device.get("name"),
          parameterCount: parameters.length
        });
      }

      return deviceInfo;
    } catch (err) {
      logger.error("Error getting device info - " + err);
      return [];
    }
  }

  /**
   * Print current configuration for debugging
   */
  public printConfiguration(): void {
    logger.info("=== CC Router Configuration ===");
    logger.info("Mappings: " + this.mappings.length);

    for (let i = 0; i < this.mappings.length; i++) {
      const m = this.mappings[i];
      if (!m) {
        throw new Error("Mapping at index " + i + " is undefined - corrupted mappings array");
      }
      logger.info("  CC " + m.ccNumber + " -> Device " + m.deviceIndex + " Param " + m.parameterIndex + " (" + m.curve + ")");
    }

    const trackInfo = this.getSelectedTrackInfo();
    if (trackInfo) {
      logger.info("Selected Track: " + trackInfo.name + " (" + trackInfo.deviceCount + " devices)");
    } else {
      logger.info("No track selected");
    }
  }
}

// Export for Max for Live usage
var ccRouter: CCRouter;
