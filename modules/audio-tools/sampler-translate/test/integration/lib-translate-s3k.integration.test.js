"use strict";
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
var s3k_1 = require("@oletizi/sampler-devices/s3k");
var pathe_1 = require("pathe");
var lib_translate_s3k_js_1 = require("@/lib-translate-s3k.js");
var chai_1 = require("chai");
var promises_1 = require("fs/promises");
mapSamples().then();
chopSamples().then();
function mapSamples() {
    return __awaiter(this, void 0, void 0, function () {
        var c, source, result, program;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                case 1:
                    c = _a.sent();
                    source = pathe_1.default.join('test', 'data', 'auto', 'J8.01');
                    return [4 /*yield*/, (0, lib_translate_s3k_js_1.map)(c, { source: source, target: "" })];
                case 2:
                    result = _a.sent();
                    (0, chai_1.expect)(result.errors.length).eq(0);
                    (0, chai_1.expect)(result.data).exist;
                    program = result.data;
                    (0, chai_1.expect)(program.keygroups).exist;
                    return [2 /*return*/];
            }
        });
    });
}
function chopSamples() {
    return __awaiter(this, void 0, void 0, function () {
        var c, root, e_1, sourcepath, targetpath, prefix, samplesPerBeat, beatsPerChop, opts, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                case 1:
                    c = _a.sent();
                    root = pathe_1.default.join('build', 'chop');
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, promises_1.default.rmdir(root)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [4 /*yield*/, promises_1.default.mkdir(root, { recursive: true })];
                case 6:
                    _a.sent();
                    c.diskFile = pathe_1.default.join(root, "akai-".concat(new Date().getTime(), ".img"));
                    return [4 /*yield*/, (0, s3k_1.akaiFormat)(c, 10)];
                case 7:
                    _a.sent();
                    sourcepath = pathe_1.default.join('test', 'data', 's3000xl', 'chops', 'loop96.wav');
                    targetpath = pathe_1.default.join('build', 'chop');
                    prefix = 'loop96';
                    samplesPerBeat = 27563;
                    beatsPerChop = 4;
                    opts = {
                        partition: 0,
                        source: sourcepath,
                        target: targetpath,
                        prefix: prefix,
                        samplesPerBeat: samplesPerBeat,
                        beatsPerChop: beatsPerChop,
                        wipeDisk: true
                    };
                    return [4 /*yield*/, (0, lib_translate_s3k_js_1.chop)(c, opts)];
                case 8:
                    result = _a.sent();
                    result.errors.forEach(function (e) { return console.error(e); });
                    (0, chai_1.expect)(result.errors.length).eq(0);
                    return [2 /*return*/];
            }
        });
    });
}
