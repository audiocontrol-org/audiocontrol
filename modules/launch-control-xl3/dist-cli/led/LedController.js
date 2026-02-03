"use strict";
/**
 * LED Controller for Launch Control XL 3
 *
 * Manages LED states, colors, and animations for all controls
 * on the Launch Control XL 3 device.
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
exports.LedController = exports.LED_NOTE_MAP = exports.LED_COLOR_VALUES = void 0;
var events_1 = require("events");
var SysExParser_1 = require("@/core/SysExParser");
/**
 * LED color definitions with velocity values
 */
exports.LED_COLOR_VALUES = {
    OFF: 0x0C,
    // Red colors
    RED_LOW: 0x0D,
    RED_MEDIUM: 0x0E,
    RED_FULL: 0x0F,
    // Amber colors
    AMBER_LOW: 0x1D,
    AMBER_MEDIUM: 0x2E,
    AMBER_FULL: 0x3F,
    // Yellow colors
    YELLOW_LOW: 0x2D,
    YELLOW_FULL: 0x3E,
    // Green colors
    GREEN_LOW: 0x1C,
    GREEN_MEDIUM: 0x2C,
    GREEN_FULL: 0x3C,
};
/**
 * Control ID to note mapping for LED control
 */
exports.LED_NOTE_MAP = {
    // Track focus buttons (top row)
    FOCUS1: 0x29, FOCUS2: 0x2A, FOCUS3: 0x2B, FOCUS4: 0x2C,
    FOCUS5: 0x2D, FOCUS6: 0x2E, FOCUS7: 0x2F, FOCUS8: 0x30,
    // Track control buttons (bottom row)
    CONTROL1: 0x39, CONTROL2: 0x3A, CONTROL3: 0x3B, CONTROL4: 0x3C,
    CONTROL5: 0x3D, CONTROL6: 0x3E, CONTROL7: 0x3F, CONTROL8: 0x40,
    // Side buttons
    DEVICE: 0x69, MUTE: 0x6A, SOLO: 0x6B, RECORD: 0x6C,
    UP: 0x68, DOWN: 0x6D, LEFT: 0x6E, RIGHT: 0x6F,
    // Send select buttons (not on all models)
    SEND_SELECT_UP: 0x2E, SEND_SELECT_DOWN: 0x2F,
};
/**
 * LED Controller
 */
var LedController = /** @class */ (function (_super) {
    __extends(LedController, _super);
    function LedController(options) {
        var _a, _b, _c;
        var _this = _super.call(this) || this;
        _this.ledStates = new Map();
        _this.animations = new Map();
        _this.animationTimers = new Map();
        _this.animationFrames = new Map();
        _this.deviceManager = options.deviceManager;
        _this.options = {
            deviceManager: options.deviceManager,
            enableAnimations: (_a = options.enableAnimations) !== null && _a !== void 0 ? _a : true,
            animationFrameRate: (_b = options.animationFrameRate) !== null && _b !== void 0 ? _b : 30,
            enableColorCorrection: (_c = options.enableColorCorrection) !== null && _c !== void 0 ? _c : false,
        };
        _this.initializeLedStates();
        return _this;
    }
    /**
     * Initialize LED states for all controls
     */
    LedController.prototype.initializeLedStates = function () {
        // Initialize all button LEDs as off
        for (var _i = 0, _a = Object.entries(exports.LED_NOTE_MAP); _i < _a.length; _i++) {
            var _b = _a[_i], controlId = _b[0], noteValue = _b[1];
            this.ledStates.set(controlId, {
                controlId: controlId,
                color: exports.LED_COLOR_VALUES.OFF,
                behaviour: 'static',
                active: false,
                brightness: 0,
            });
        }
    };
    /**
     * Set LED color and behaviour
     */
    LedController.prototype.setLed = function (controlId_1, color_1) {
        return __awaiter(this, arguments, void 0, function (controlId, color, behaviour) {
            var noteValue, colorValue, correctedColor, message, state;
            if (behaviour === void 0) { behaviour = 'static'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        noteValue = this.getLedNoteValue(controlId);
                        if (noteValue === undefined) {
                            throw new Error("Invalid control ID for LED: ".concat(controlId));
                        }
                        colorValue = typeof color === 'number' ? color : this.getColorValue(color);
                        correctedColor = this.options.enableColorCorrection
                            ? this.applyColorCorrection(colorValue)
                            : colorValue;
                        message = SysExParser_1.SysExParser.buildLedControl(noteValue, correctedColor, behaviour);
                        return [4 /*yield*/, this.deviceManager.sendSysEx(message)];
                    case 1:
                        _a.sent();
                        state = {
                            controlId: controlId,
                            color: color,
                            behaviour: behaviour,
                            active: colorValue !== exports.LED_COLOR_VALUES.OFF,
                            brightness: this.getBrightness(colorValue),
                        };
                        this.ledStates.set(controlId, state);
                        this.emit('led:changed', controlId, state);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set multiple LEDs at once
     */
    LedController.prototype.setMultipleLeds = function (updates) {
        return __awaiter(this, void 0, void 0, function () {
            var states, _i, updates_1, update, state;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        states = [];
                        _i = 0, updates_1 = updates;
                        _a.label = 1;
                    case 1:
                        if (!(_i < updates_1.length)) return [3 /*break*/, 4];
                        update = updates_1[_i];
                        return [4 /*yield*/, this.setLed(update.controlId, update.color, update.behaviour)];
                    case 2:
                        _a.sent();
                        state = this.ledStates.get(update.controlId);
                        if (state) {
                            states.push(state);
                        }
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        this.emit('led:batch', states);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Turn off a single LED
     */
    LedController.prototype.turnOff = function (controlId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.setLed(controlId, exports.LED_COLOR_VALUES.OFF, 'static')];
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
    LedController.prototype.turnOffAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var message, _i, _a, _b, controlId, state;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        message = SysExParser_1.SysExParser.buildLedReset();
                        return [4 /*yield*/, this.deviceManager.sendSysEx(message)];
                    case 1:
                        _c.sent();
                        // Update all states to off
                        for (_i = 0, _a = this.ledStates.entries(); _i < _a.length; _i++) {
                            _b = _a[_i], controlId = _b[0], state = _b[1];
                            state.color = exports.LED_COLOR_VALUES.OFF;
                            state.behaviour = 'static';
                            state.active = false;
                            state.brightness = 0;
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Flash an LED
     */
    LedController.prototype.flashLed = function (controlId_1, color_1) {
        return __awaiter(this, arguments, void 0, function (controlId, color, duration) {
            var _this = this;
            if (duration === void 0) { duration = 100; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.setLed(controlId, color, 'flash')];
                    case 1:
                        _a.sent();
                        if (duration > 0) {
                            setTimeout(function () {
                                _this.turnOff(controlId);
                            }, duration);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Pulse an LED
     */
    LedController.prototype.pulseLed = function (controlId, color) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.setLed(controlId, color, 'pulse')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start an animation
     */
    LedController.prototype.startAnimation = function (id, animation) {
        var _this = this;
        if (!this.options.enableAnimations) {
            return;
        }
        // Stop existing animation with same ID
        this.stopAnimation(id);
        this.animations.set(id, animation);
        this.animationFrames.set(id, 0);
        var frameInterval = 1000 / this.options.animationFrameRate;
        var repeatCount = 0;
        var animate = function () {
            var _a;
            var frame = (_a = _this.animationFrames.get(id)) !== null && _a !== void 0 ? _a : 0;
            try {
                _this.processAnimationFrame(id, animation, frame);
            }
            catch (error) {
                _this.emit('error', error);
                _this.stopAnimation(id);
                return;
            }
            // Update frame counter
            _this.animationFrames.set(id, frame + 1);
            // Check if animation should repeat
            var totalFrames = (animation.duration / frameInterval);
            if (frame >= totalFrames) {
                repeatCount++;
                if (animation.repeat === 'infinite' ||
                    (typeof animation.repeat === 'number' && repeatCount < animation.repeat)) {
                    _this.animationFrames.set(id, 0);
                }
                else {
                    _this.stopAnimation(id);
                    _this.emit('animation:completed', animation);
                }
            }
        };
        var timer = setInterval(animate, frameInterval);
        this.animationTimers.set(id, timer);
        this.emit('animation:started', animation);
        animate(); // Run first frame immediately
    };
    /**
     * Process animation frame
     */
    LedController.prototype.processAnimationFrame = function (id, animation, frame) {
        switch (animation.type) {
            case 'fade':
                this.processFadeAnimation(animation, frame);
                break;
            case 'pulse':
                this.processPulseAnimation(animation, frame);
                break;
            case 'flash':
                this.processFlashAnimation(animation, frame);
                break;
            case 'rainbow':
                this.processRainbowAnimation(animation, frame);
                break;
            case 'chase':
                this.processChaseAnimation(animation, frame);
                break;
            case 'custom':
                if (animation.callback) {
                    animation.callback(frame);
                }
                break;
        }
    };
    /**
     * Process fade animation
     */
    LedController.prototype.processFadeAnimation = function (animation, frame) {
        if (!animation.controls || !animation.colors || animation.colors.length < 2) {
            return;
        }
        var progress = frame / (animation.duration / (1000 / this.options.animationFrameRate));
        var fromColor = animation.colors[0];
        var toColor = animation.colors[1];
        // Simple color interpolation
        var color = progress < 0.5 ? fromColor : toColor;
        for (var _i = 0, _a = animation.controls; _i < _a.length; _i++) {
            var controlId = _a[_i];
            this.setLed(controlId, color, 'static').catch(function () { });
        }
    };
    /**
     * Process pulse animation
     */
    LedController.prototype.processPulseAnimation = function (animation, frame) {
        var _a;
        if (!animation.controls || !animation.colors) {
            return;
        }
        var color = (_a = animation.colors[0]) !== null && _a !== void 0 ? _a : exports.LED_COLOR_VALUES.GREEN_FULL;
        for (var _i = 0, _b = animation.controls; _i < _b.length; _i++) {
            var controlId = _b[_i];
            this.setLed(controlId, color, 'pulse').catch(function () { });
        }
    };
    /**
     * Process flash animation
     */
    LedController.prototype.processFlashAnimation = function (animation, frame) {
        var _a;
        if (!animation.controls || !animation.colors) {
            return;
        }
        var color = (_a = animation.colors[0]) !== null && _a !== void 0 ? _a : exports.LED_COLOR_VALUES.RED_FULL;
        var flashRate = 4; // Flashes per second
        var on = Math.floor(frame / (this.options.animationFrameRate / flashRate)) % 2 === 0;
        for (var _i = 0, _b = animation.controls; _i < _b.length; _i++) {
            var controlId = _b[_i];
            this.setLed(controlId, on ? color : exports.LED_COLOR_VALUES.OFF, 'static').catch(function () { });
        }
    };
    /**
     * Process rainbow animation
     */
    LedController.prototype.processRainbowAnimation = function (animation, frame) {
        if (!animation.controls) {
            return;
        }
        var colors = [
            exports.LED_COLOR_VALUES.RED_FULL,
            exports.LED_COLOR_VALUES.AMBER_FULL,
            exports.LED_COLOR_VALUES.YELLOW_FULL,
            exports.LED_COLOR_VALUES.GREEN_FULL,
        ];
        var colorIndex = Math.floor(frame / 10) % colors.length;
        var color = colors[colorIndex];
        for (var _i = 0, _a = animation.controls; _i < _a.length; _i++) {
            var controlId = _a[_i];
            this.setLed(controlId, color, 'static').catch(function () { });
        }
    };
    /**
     * Process chase animation
     */
    LedController.prototype.processChaseAnimation = function (animation, frame) {
        var _a;
        if (!animation.controls || !animation.colors) {
            return;
        }
        var color = (_a = animation.colors[0]) !== null && _a !== void 0 ? _a : exports.LED_COLOR_VALUES.GREEN_FULL;
        var activeIndex = frame % animation.controls.length;
        for (var i = 0; i < animation.controls.length; i++) {
            var controlId = animation.controls[i];
            var isActive = i === activeIndex;
            this.setLed(controlId, isActive ? color : exports.LED_COLOR_VALUES.OFF, 'static').catch(function () { });
        }
    };
    /**
     * Stop an animation
     */
    LedController.prototype.stopAnimation = function (id) {
        var timer = this.animationTimers.get(id);
        if (timer) {
            clearInterval(timer);
            this.animationTimers.delete(id);
        }
        this.animations.delete(id);
        this.animationFrames.delete(id);
    };
    /**
     * Stop all animations
     */
    LedController.prototype.stopAllAnimations = function () {
        for (var _i = 0, _a = this.animations.keys(); _i < _a.length; _i++) {
            var id = _a[_i];
            this.stopAnimation(id);
        }
    };
    /**
     * Get LED note value from control ID
     */
    LedController.prototype.getLedNoteValue = function (controlId) {
        return exports.LED_NOTE_MAP[controlId];
    };
    /**
     * Get color value from color name
     */
    LedController.prototype.getColorValue = function (color) {
        var _a;
        if (typeof color === 'number') {
            return color;
        }
        return (_a = exports.LED_COLOR_VALUES[color]) !== null && _a !== void 0 ? _a : exports.LED_COLOR_VALUES.OFF;
    };
    /**
     * Apply color correction
     */
    LedController.prototype.applyColorCorrection = function (color) {
        // Simple gamma correction
        // This would need to be calibrated for the actual hardware
        return color;
    };
    /**
     * Get brightness from color value
     */
    LedController.prototype.getBrightness = function (colorValue) {
        // Extract brightness from velocity value
        // This is a simplified calculation
        if (colorValue === exports.LED_COLOR_VALUES.OFF) {
            return 0;
        }
        var brightness = (colorValue & 0x0F) / 15;
        return Math.round(brightness * 100);
    };
    /**
     * Get current LED state
     */
    LedController.prototype.getLedState = function (controlId) {
        return this.ledStates.get(controlId);
    };
    /**
     * Get all LED states
     */
    LedController.prototype.getAllLedStates = function () {
        return new Map(this.ledStates);
    };
    /**
     * Create startup animation
     */
    LedController.prototype.playStartupAnimation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var focusButtons, controlButtons;
            var _this = this;
            return __generator(this, function (_a) {
                focusButtons = ['FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4', 'FOCUS5', 'FOCUS6', 'FOCUS7', 'FOCUS8'];
                controlButtons = ['CONTROL1', 'CONTROL2', 'CONTROL3', 'CONTROL4', 'CONTROL5', 'CONTROL6', 'CONTROL7', 'CONTROL8'];
                // Chase animation on focus buttons
                this.startAnimation('startup-focus', {
                    type: 'chase',
                    duration: 2000,
                    controls: focusButtons,
                    colors: [exports.LED_COLOR_VALUES.GREEN_FULL],
                });
                // Chase animation on control buttons (delayed)
                setTimeout(function () {
                    _this.startAnimation('startup-control', {
                        type: 'chase',
                        duration: 2000,
                        controls: controlButtons,
                        colors: [exports.LED_COLOR_VALUES.AMBER_FULL],
                    });
                }, 500);
                // Turn off after animation
                setTimeout(function () {
                    _this.turnOffAll();
                }, 3000);
                return [2 /*return*/];
            });
        });
    };
    /**
     * Clean up resources
     */
    LedController.prototype.cleanup = function () {
        this.stopAllAnimations();
        this.ledStates.clear();
        this.removeAllListeners();
    };
    return LedController;
}(events_1.EventEmitter));
exports.LedController = LedController;
exports.default = LedController;
