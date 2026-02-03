"use strict";
/**
 * Launch Control XL 3 - Main Controller Class
 *
 * High-level interface for interacting with the Novation Launch Control XL 3
 * hardware controller. Provides a unified API for device management, control
 * mapping, LED control, and custom modes.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaunchControlXL3 = void 0;
var events_1 = require("events");
var DeviceManager_1 = require("@/device/DeviceManager");
var CustomModeManager_1 = require("@/modes/CustomModeManager");
var ControlMapper_1 = require("@/mapping/ControlMapper");
var LedController_1 = require("@/led/LedController");
/**
 * Main Launch Control XL 3 Controller
 */
var LaunchControlXL3 = /** @class */ (function (_super) {
    __extends(LaunchControlXL3, _super);
    function LaunchControlXL3(options) {
        if (options === void 0) { options = {}; }
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var _this = _super.call(this) || this;
        _this.isInitialized = false;
        _this.options = {
            midiBackend: options.midiBackend,
            autoConnect: (_a = options.autoConnect) !== null && _a !== void 0 ? _a : true,
            enableLedControl: (_b = options.enableLedControl) !== null && _b !== void 0 ? _b : true,
            enableCustomModes: (_c = options.enableCustomModes) !== null && _c !== void 0 ? _c : true,
            enableValueSmoothing: (_d = options.enableValueSmoothing) !== null && _d !== void 0 ? _d : false,
            smoothingFactor: (_e = options.smoothingFactor) !== null && _e !== void 0 ? _e : 3,
            deviceNameFilter: (_f = options.deviceNameFilter) !== null && _f !== void 0 ? _f : 'Launch Control XL',
            reconnectOnError: (_g = options.reconnectOnError) !== null && _g !== void 0 ? _g : true,
            reconnectDelay: (_h = options.reconnectDelay) !== null && _h !== void 0 ? _h : 2000,
            maxReconnectAttempts: (_j = options.maxReconnectAttempts) !== null && _j !== void 0 ? _j : 5,
        };
        // Initialize core components
        _this.deviceManager = new DeviceManager_1.DeviceManager({
            midiBackend: _this.options.midiBackend,
            autoConnect: false,
            deviceNameFilter: _this.options.deviceNameFilter,
            retryAttempts: _this.options.maxReconnectAttempts,
            retryDelay: _this.options.reconnectDelay,
        });
        _this.controlMapper = new ControlMapper_1.ControlMapper({
            enableValueSmoothing: _this.options.enableValueSmoothing,
            smoothingFactor: _this.options.smoothingFactor,
        });
        _this.setupEventHandlers();
        return _this;
    }
    /**
     * Initialize the controller
     */
    LaunchControlXL3.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isInitialized) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        // Initialize device manager
                        return [4 /*yield*/, this.deviceManager.initialize()];
                    case 2:
                        // Initialize device manager
                        _a.sent();
                        if (!this.options.autoConnect) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.connect()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        this.isInitialized = true;
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        this.emit('device:error', error_1);
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Connect to device
     */
    LaunchControlXL3.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.deviceManager.connect()];
                    case 1:
                        _a.sent();
                        // Initialize optional components after connection
                        if (this.options.enableCustomModes) {
                            this.customModeManager = new CustomModeManager_1.CustomModeManager({
                                deviceManager: this.deviceManager,
                                autoSync: true,
                            });
                        }
                        if (!this.options.enableLedControl) return [3 /*break*/, 3];
                        this.ledController = new LedController_1.LedController({
                            deviceManager: this.deviceManager,
                            enableAnimations: true,
                        });
                        // Play startup animation
                        return [4 /*yield*/, this.ledController.playStartupAnimation()];
                    case 2:
                        // Play startup animation
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        // Load default mappings
                        this.loadDefaultMappings();
                        this.emit('device:ready');
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        this.emit('device:error', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Disconnect from device
     */
    LaunchControlXL3.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.deviceManager.disconnect()];
                    case 1:
                        _a.sent();
                        if (this.customModeManager) {
                            this.customModeManager.cleanup();
                            this.customModeManager = undefined;
                        }
                        if (this.ledController) {
                            this.ledController.cleanup();
                            this.ledController = undefined;
                        }
                        this.controlMapper.resetAll();
                        this.currentMode = undefined;
                        this.currentSlot = undefined;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Setup event handlers
     */
    LaunchControlXL3.prototype.setupEventHandlers = function () {
        var _this = this;
        // Device events
        this.deviceManager.on('device:connected', function (device) {
            _this.emit('device:connected', device);
        });
        this.deviceManager.on('device:disconnected', function (reason) {
            _this.emit('device:disconnected', reason);
        });
        this.deviceManager.on('device:error', function (error) {
            _this.handleError(error);
        });
        // Control events
        this.deviceManager.on('control:change', function (controlId, value, channel) {
            // Process through control mapper
            var message = _this.controlMapper.processControlValue(controlId, value);
            if (message) {
                _this.emit('midi:out', message);
            }
            _this.emit('control:change', controlId, value, channel);
        });
        // Control mapper events
        this.controlMapper.on('control:mapped', function (controlId, mapping) {
            _this.emit('control:mapped', controlId, mapping);
        });
        this.controlMapper.on('midi:out', function (message) {
            _this.emit('midi:out', message);
        });
        // Custom mode events
        if (this.customModeManager) {
            this.customModeManager.on('mode:loaded', function (slot, mode) {
                _this.emit('mode:loaded', slot, mode);
            });
            this.customModeManager.on('mode:saved', function (slot, mode) {
                _this.emit('mode:saved', slot, mode);
            });
        }
        // LED controller events
        if (this.ledController) {
            this.ledController.on('led:changed', function (controlId, state) {
                _this.emit('led:changed', controlId, state.color, state.behaviour);
            });
        }
        // MIDI input events
        this.deviceManager.on('sysex:received', function (data) {
            _this.emit('midi:in', {
                type: 'sysex',
                data: data,
            });
        });
    };
    /**
     * Handle errors
     */
    LaunchControlXL3.prototype.handleError = function (error) {
        var _this = this;
        console.error('[LaunchControlXL3] Error:', error.message);
        this.emit('device:error', error);
        // Attempt reconnection if enabled
        if (this.options.reconnectOnError && this.isInitialized) {
            setTimeout(function () {
                _this.connect().catch(function (e) {
                    console.error('[LaunchControlXL3] Reconnection failed:', e.message);
                });
            }, this.options.reconnectDelay);
        }
    };
    /**
     * Load default control mappings
     */
    LaunchControlXL3.prototype.loadDefaultMappings = function () {
        var defaultMappings = ControlMapper_1.ControlMapper.createDefaultMappings();
        for (var _i = 0, _a = defaultMappings.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], controlId = _b[0], mapping = _b[1];
            this.controlMapper.mapControl(controlId, mapping.type, mapping);
        }
    };
    // ============================================
    // Custom Mode Management
    // ============================================
    /**
     * Load a custom mode
     */
    LaunchControlXL3.prototype.loadCustomMode = function (slot) {
        return __awaiter(this, void 0, void 0, function () {
            var mode, updates;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.customModeManager) {
                            throw new Error('Custom modes not enabled');
                        }
                        return [4 /*yield*/, this.customModeManager.readMode(slot)];
                    case 1:
                        mode = _a.sent();
                        // Apply control mappings
                        this.controlMapper.loadFromCustomMode(mode);
                        if (!(this.ledController && mode.leds)) return [3 /*break*/, 3];
                        updates = Object.entries(mode.leds).map(function (_a) {
                            var controlId = _a[0], led = _a[1];
                            return ({
                                controlId: controlId,
                                color: led.color,
                                behaviour: led.behaviour,
                            });
                        });
                        return [4 /*yield*/, this.ledController.setMultipleLeds(updates)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        this.currentMode = mode;
                        this.currentSlot = slot;
                        this.emit('mode:changed', slot, mode);
                        return [2 /*return*/, mode];
                }
            });
        });
    };
    /**
     * Save a custom mode
     */
    LaunchControlXL3.prototype.saveCustomMode = function (slot, mode) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.customModeManager) {
                            throw new Error('Custom modes not enabled');
                        }
                        return [4 /*yield*/, this.customModeManager.writeMode(slot, mode)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new custom mode
     */
    LaunchControlXL3.prototype.createCustomMode = function (name) {
        if (!this.customModeManager) {
            throw new Error('Custom modes not enabled');
        }
        return this.customModeManager.createDefaultMode(name);
    };
    /**
     * Export current mappings as custom mode
     */
    LaunchControlXL3.prototype.exportCurrentAsCustomMode = function (name) {
        var controls = this.controlMapper.exportToCustomMode();
        var leds = {};
        if (this.ledController) {
            var ledStates = this.ledController.getAllLedStates();
            for (var _i = 0, _a = ledStates.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], controlId = _b[0], state = _b[1];
                if (state.active) {
                    leds[controlId] = {
                        color: state.color,
                        behaviour: state.behaviour,
                    };
                }
            }
        }
        return {
            name: name,
            controls: controls,
            leds: leds,
            metadata: {
                createdAt: new Date(),
                modifiedAt: new Date(),
            },
        };
    };
    // ============================================
    // Control Mapping
    // ============================================
    /**
     * Map a control
     */
    LaunchControlXL3.prototype.mapControl = function (controlId, channel, cc, options) {
        var _a, _b, _c;
        var mapping = {
            type: this.getControlType(controlId),
            channel: channel,
            cc: cc,
            min: (_a = options === null || options === void 0 ? void 0 : options.min) !== null && _a !== void 0 ? _a : 0,
            max: (_b = options === null || options === void 0 ? void 0 : options.max) !== null && _b !== void 0 ? _b : 127,
            behaviour: (_c = options === null || options === void 0 ? void 0 : options.behaviour) !== null && _c !== void 0 ? _c : 'absolute',
            transform: options === null || options === void 0 ? void 0 : options.transform,
        };
        this.controlMapper.mapControl(controlId, mapping.type, mapping);
    };
    /**
     * Unmap a control
     */
    LaunchControlXL3.prototype.unmapControl = function (controlId) {
        this.controlMapper.unmapControl(controlId);
    };
    /**
     * Get control mapping
     */
    LaunchControlXL3.prototype.getControlMapping = function (controlId) {
        var mapped = this.controlMapper.getMapping(controlId);
        return mapped === null || mapped === void 0 ? void 0 : mapped.mapping;
    };
    /**
     * Update control mapping
     */
    LaunchControlXL3.prototype.updateControlMapping = function (controlId, updates) {
        this.controlMapper.updateMapping(controlId, updates);
    };
    // ============================================
    // LED Control
    // ============================================
    /**
     * Set LED color
     */
    LaunchControlXL3.prototype.setLed = function (controlId, color, behaviour) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.ledController) {
                            throw new Error('LED control not enabled');
                        }
                        return [4 /*yield*/, this.ledController.setLed(controlId, color, behaviour)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Turn off LED
     */
    LaunchControlXL3.prototype.turnOffLed = function (controlId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.ledController) {
                            throw new Error('LED control not enabled');
                        }
                        return [4 /*yield*/, this.ledController.turnOff(controlId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Turn off all LEDs
     */
    LaunchControlXL3.prototype.turnOffAllLeds = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.ledController) {
                            throw new Error('LED control not enabled');
                        }
                        return [4 /*yield*/, this.ledController.turnOffAll()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Flash LED
     */
    LaunchControlXL3.prototype.flashLed = function (controlId, color, duration) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.ledController) {
                            throw new Error('LED control not enabled');
                        }
                        return [4 /*yield*/, this.ledController.flashLed(controlId, color, duration)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start LED animation
     */
    LaunchControlXL3.prototype.startLedAnimation = function (id, animation) {
        if (!this.ledController) {
            throw new Error('LED control not enabled');
        }
        this.ledController.startAnimation(id, animation);
    };
    /**
     * Stop LED animation
     */
    LaunchControlXL3.prototype.stopLedAnimation = function (id) {
        if (!this.ledController) {
            throw new Error('LED control not enabled');
        }
        this.ledController.stopAnimation(id);
    };
    // ============================================
    // Utility Methods
    // ============================================
    /**
     * Get control type from control ID
     */
    LaunchControlXL3.prototype.getControlType = function (controlId) {
        if (controlId.includes('SEND') || controlId.includes('PAN')) {
            return 'knob';
        }
        else if (controlId.includes('FADER')) {
            return 'fader';
        }
        else {
            return 'button';
        }
    };
    /**
     * Send raw MIDI message
     */
    LaunchControlXL3.prototype.sendMidi = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.deviceManager.sendCC((_a = message.controller) !== null && _a !== void 0 ? _a : 0, (_b = message.value) !== null && _b !== void 0 ? _b : 0, (_c = message.channel) !== null && _c !== void 0 ? _c : 0)];
                    case 1:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send SysEx message
     */
    LaunchControlXL3.prototype.sendSysEx = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.deviceManager.sendSysEx(data)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Select template
     */
    LaunchControlXL3.prototype.selectTemplate = function (slot) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.deviceManager.selectTemplate(slot)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get device status
     */
    LaunchControlXL3.prototype.getStatus = function () {
        return this.deviceManager.getStatus();
    };
    /**
     * Check if connected
     */
    LaunchControlXL3.prototype.isConnected = function () {
        var status = this.getStatus();
        return status.connected;
    };
    /**
     * Get current mode
     */
    LaunchControlXL3.prototype.getCurrentMode = function () {
        return this.currentMode;
    };
    /**
     * Get current slot
     */
    LaunchControlXL3.prototype.getCurrentSlot = function () {
        return this.currentSlot;
    };
    /**
     * Clean up resources
     */
    LaunchControlXL3.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.disconnect()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.deviceManager.cleanup()];
                    case 2:
                        _a.sent();
                        this.controlMapper.cleanup();
                        this.removeAllListeners();
                        this.isInitialized = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    // Public static exports
    LaunchControlXL3.CONTROL_IDS = CustomModeManager_1.CONTROL_IDS;
    LaunchControlXL3.LED_COLORS = CustomModeManager_1.LED_COLORS;
    LaunchControlXL3.LED_COLOR_VALUES = LedController_1.LED_COLOR_VALUES;
    LaunchControlXL3.ValueTransformers = ControlMapper_1.ValueTransformers;
    return LaunchControlXL3;
}(events_1.EventEmitter));
exports.LaunchControlXL3 = LaunchControlXL3;
// Export everything for convenience
__exportStar(require("@/types"), exports);
__exportStar(require("@/core/MidiInterface"), exports);
__exportStar(require("@/core/SysExParser"), exports);
__exportStar(require("@/core/Midimunge"), exports);
__exportStar(require("@/device/DeviceManager"), exports);
__exportStar(require("@/modes/CustomModeManager"), exports);
__exportStar(require("@/mapping/ControlMapper"), exports);
__exportStar(require("@/led/LedController"), exports);
exports.default = LaunchControlXL3;
