#!/usr/bin/env node
"use strict";
/**
 * Launch Control XL 3 CLI Tool
 *
 * Simple command-line interface for testing the Launch Control XL 3 library
 */
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
var commander_1 = require("commander");
var LaunchControlXL3_1 = require("../LaunchControlXL3");
var LedController_1 = require("../led/LedController");
var program = new commander_1.Command();
var VERSION = '0.1.0';
// Controller instance
var controller = null;
/**
 * Connect to device
 */
function connect() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (controller && controller.isConnected()) {
                        return [2 /*return*/, controller];
                    }
                    console.log('Connecting to Launch Control XL 3...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    controller = new LaunchControlXL3_1.LaunchControlXL3({
                        autoConnect: true,
                        enableLedControl: true,
                        enableCustomModes: true,
                    });
                    return [4 /*yield*/, controller.initialize()];
                case 2:
                    _a.sent();
                    console.log('✓ Connected successfully');
                    // Setup basic event listeners
                    controller.on('control:change', function (controlId, value) {
                        console.log("[Control] ".concat(controlId, ": ").concat(value));
                    });
                    controller.on('device:disconnected', function () {
                        console.log('[Device] Disconnected');
                        controller = null;
                    });
                    return [2 /*return*/, controller];
                case 3:
                    error_1 = _a.sent();
                    console.error("Failed to connect: ".concat(error_1.message));
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Cleanup on exit
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\nShutting down...');
                if (!controller) return [3 /*break*/, 2];
                return [4 /*yield*/, controller.cleanup()];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2:
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); });
// ============================================
// CLI Setup
// ============================================
program
    .name('lcxl3')
    .description('Launch Control XL 3 CLI Tool')
    .version(VERSION);
// Connect command
program
    .command('connect')
    .description('Connect to Launch Control XL 3')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    var error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, connect()];
            case 1:
                _a.sent();
                console.log('Device ready for use');
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error("Error: ".concat(error_2.message));
                process.exit(1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Status command
program
    .command('status')
    .description('Show device status')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    var ctrl, status_1, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, connect()];
            case 1:
                ctrl = _a.sent();
                status_1 = ctrl.getStatus();
                console.log('\nDevice Status:');
                console.log('─'.repeat(30));
                console.log("Connected: ".concat(status_1.connected ? 'Yes' : 'No'));
                console.log("State: ".concat(status_1.state));
                if (status_1.deviceInfo) {
                    console.log("Firmware: ".concat(status_1.deviceInfo.firmwareVersion));
                }
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                console.error("Error: ".concat(error_3.message));
                process.exit(1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// LED test command
program
    .command('led-test')
    .description('Run LED test pattern')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    var ctrl, i, i, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 14, , 15]);
                return [4 /*yield*/, connect()];
            case 1:
                ctrl = _a.sent();
                console.log('Running LED test...');
                i = 1;
                _a.label = 2;
            case 2:
                if (!(i <= 8)) return [3 /*break*/, 6];
                return [4 /*yield*/, ctrl.setLed("FOCUS".concat(i), LedController_1.LED_COLOR_VALUES.GREEN_FULL)];
            case 3:
                _a.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5:
                i++;
                return [3 /*break*/, 2];
            case 6:
                i = 1;
                _a.label = 7;
            case 7:
                if (!(i <= 8)) return [3 /*break*/, 11];
                return [4 /*yield*/, ctrl.setLed("CONTROL".concat(i), LedController_1.LED_COLOR_VALUES.AMBER_FULL)];
            case 8:
                _a.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
            case 9:
                _a.sent();
                _a.label = 10;
            case 10:
                i++;
                return [3 /*break*/, 7];
            case 11: 
            // Turn off
            return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 500); })];
            case 12:
                // Turn off
                _a.sent();
                return [4 /*yield*/, ctrl.turnOffAllLeds()];
            case 13:
                _a.sent();
                console.log('✓ LED test complete');
                return [3 /*break*/, 15];
            case 14:
                error_4 = _a.sent();
                console.error("Error: ".concat(error_4.message));
                process.exit(1);
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/];
        }
    });
}); });
// Monitor command
program
    .command('monitor')
    .description('Monitor control changes')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    var ctrl, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connect()];
            case 1:
                ctrl = _a.sent();
                console.log('Monitoring controls (Ctrl+C to exit)...');
                console.log('─'.repeat(30));
                ctrl.on('control:change', function (controlId, value) {
                    var bar = '█'.repeat(Math.round((value / 127) * 20));
                    var empty = '░'.repeat(20 - bar.length);
                    console.log("".concat(controlId.padEnd(12), " [").concat(bar).concat(empty, "] ").concat(value));
                });
                // Keep alive
                return [4 /*yield*/, new Promise(function () { })];
            case 2:
                // Keep alive
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_5 = _a.sent();
                console.error("Error: ".concat(error_5.message));
                process.exit(1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Load mode command
program
    .command('load-mode <slot>')
    .description('Load custom mode (0-15)')
    .action(function (slot) { return __awaiter(void 0, void 0, void 0, function () {
    var ctrl, slotNum, mode, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connect()];
            case 1:
                ctrl = _a.sent();
                slotNum = parseInt(slot, 10);
                if (slotNum < 0 || slotNum > 15) {
                    console.error('Slot must be 0-15');
                    process.exit(1);
                }
                console.log("Loading mode from slot ".concat(slotNum, "..."));
                return [4 /*yield*/, ctrl.loadCustomMode(slotNum)];
            case 2:
                mode = _a.sent();
                console.log("\u2713 Loaded mode: ".concat(mode.name));
                return [3 /*break*/, 4];
            case 3:
                error_6 = _a.sent();
                console.error("Error: ".concat(error_6.message));
                process.exit(1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Parse arguments
program.parse();
// Show help if no command
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
