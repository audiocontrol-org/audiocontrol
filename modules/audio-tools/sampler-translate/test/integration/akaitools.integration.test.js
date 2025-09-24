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
var path_1 = require("path");
var chai_1 = require("chai");
var promises_1 = require("fs/promises");
var s3k_2 = require("@oletizi/sampler-devices/s3k");
var sampler_lib_1 = require("@oletizi/sampler-lib");
var s3k_3 = require("@oletizi/sampler-devices/s3k");
var sampler_lib_2 = require("@oletizi/sampler-lib");
var s3k_4 = require("@oletizi/sampler-devices/s3k");
var mocha_1 = require("mocha");
describe("Read akai disk image.", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, mocha_1.it)("Reads an akai disk image", function () {
            return __awaiter(this, void 0, void 0, function () {
                var diskFile, partitionCount, c, er, i, sourcePath, result, akaiDisk, _i, _a, partition, _b, _c, volume;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            this.timeout(2 * 1000);
                            diskFile = path_1.default.join('build', "akai-".concat(new Date().getTime(), ".img"));
                            partitionCount = 3;
                            return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                        case 1:
                            c = _d.sent();
                            c.diskFile = diskFile;
                            return [4 /*yield*/, (0, s3k_1.akaiFormat)(c, 1, partitionCount)];
                        case 2:
                            er = _d.sent();
                            er.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(er.errors.length).eq(0);
                            i = 0;
                            _d.label = 3;
                        case 3:
                            if (!(i < partitionCount)) return [3 /*break*/, 6];
                            sourcePath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_program.a3p');
                            return [4 /*yield*/, (0, s3k_1.akaiWrite)(c, sourcePath, '/vol 1', i + 1)];
                        case 4:
                            er = _d.sent();
                            er.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(er.errors.length).eq(0);
                            _d.label = 5;
                        case 5:
                            i++;
                            return [3 /*break*/, 3];
                        case 6: return [4 /*yield*/, (0, s3k_1.readAkaiDisk)(c)];
                        case 7:
                            result = _d.sent();
                            result.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            akaiDisk = result.data;
                            (0, chai_1.expect)(akaiDisk).to.exist;
                            (0, chai_1.expect)(akaiDisk.partitions.length).eq(partitionCount);
                            for (_i = 0, _a = akaiDisk.partitions; _i < _a.length; _i++) {
                                partition = _a[_i];
                                (0, chai_1.expect)(partition.volumes.length).gte(1);
                                for (_b = 0, _c = partition.volumes; _b < _c.length; _b++) {
                                    volume = _c[_b];
                                    (0, chai_1.expect)(volume.records.length).gte(1);
                                }
                            }
                            return [4 /*yield*/, promises_1.default.writeFile(path_1.default.join('build', "akai-disk-".concat(new Date().getTime(), ".json")), JSON.stringify(akaiDisk))];
                        case 8:
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            });
        });
        return [2 /*return*/];
    });
}); });
describe('Test interaction w/ akaitools and akai files.', function () { return __awaiter(void 0, void 0, void 0, function () {
    function newConfig() {
        return {
            akaiToolsPath: path_1.default.join('..', 'akaitools-1.5'),
            diskFile: diskFile
        };
    }
    var diskFile;
    return __generator(this, function (_a) {
        diskFile = path_1.default.join('build', "akai-".concat(new Date().getTime(), ".img"));
        afterEach(function () {
            promises_1.default.rm(diskFile).then().catch(function () {
                /* no one cares */
            });
        });
        (0, mocha_1.it)('Validates config', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = chai_1.expect;
                        return [4 /*yield*/, (0, s3k_1.validateConfig)(newConfig())];
                    case 1:
                        _a.apply(void 0, [_b.sent()]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Parses akailist output and constructs a model of an Akai disk.", function () { return __awaiter(void 0, void 0, void 0, function () {
            function listFunction(_cfg, _akaiPath, _partitionNumber) {
                var result = { data: parsed, errors: [] };
                return Promise.resolve(result);
            }
            var output, parsed, c, diskResult, disk, partition, volume1, volume2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        output = "\nS3000 VOLUME           3         0 /chop.03\nS3000 VOLUME         214         0 /chop.01\nS3000 SAMPLE           5    211872 /chop.03/chop.03.00-l\nS3000 SAMPLE          31    211872 /chop.03/chop.03.00-r\nS3000 SAMPLE          57    211872 /chop.03/chop.03.01-l\nS3000 SAMPLE          83    211872 /chop.03/chop.03.01-r\nS3000 SAMPLE         109    211872 /chop.03/chop.03.02-l\nS3000 SAMPLE         135    211872 /chop.03/chop.03.02-r\nS3000 SAMPLE         161    211872 /chop.03/chop.03.03-l\nS3000 SAMPLE         187    211872 /chop.03/chop.03.03-r\nS3000 PROGRAM        213       960 /chop.03/chop.03\nS3000 SAMPLE         216    211872 /chop.01/chop.01.00-l\nS3000 SAMPLE         242    211872 /chop.01/chop.01.00-r\nS3000 SAMPLE         268    211872 /chop.01/chop.01.01-l\nS3000 SAMPLE         294    211872 /chop.01/chop.01.01-r\nS3000 SAMPLE         320    211872 /chop.01/chop.01.02-l\nS3000 SAMPLE         346    211872 /chop.01/chop.01.02-r\nS3000 SAMPLE         372    211872 /chop.01/chop.01.03-l\nS3000 SAMPLE         398    211872 /chop.01/chop.01.03-r\nS3000 PROGRAM        424       960 /chop.01/chop.01";
                        parsed = (0, s3k_1.parseAkaiList)(output);
                        (0, chai_1.expect)(parsed).to.exist;
                        (0, chai_1.expect)(parsed.length).eq(20);
                        (0, chai_1.expect)(parsed[0].type).eq(s3k_4.AkaiRecordType.VOLUME);
                        (0, chai_1.expect)(parsed[1].type).eq(s3k_4.AkaiRecordType.VOLUME);
                        return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                    case 1:
                        c = _a.sent();
                        return [4 /*yield*/, (0, s3k_1.readAkaiDisk)(c, listFunction)];
                    case 2:
                        diskResult = _a.sent();
                        (0, chai_1.expect)(diskResult).to.exist;
                        (0, chai_1.expect)(diskResult.errors.length).eq(0);
                        disk = diskResult.data;
                        (0, chai_1.expect)(disk).to.exist;
                        (0, chai_1.expect)(disk.partitions).to.exist;
                        (0, chai_1.expect)(disk.partitions.length).gte(1);
                        partition = disk.partitions[0];
                        (0, chai_1.expect)(partition.volumes).to.exist;
                        (0, chai_1.expect)(partition.volumes.length).eq(2);
                        volume1 = partition.volumes[0];
                        (0, chai_1.expect)(volume1).to.exist;
                        (0, chai_1.expect)(volume1.records).to.exist;
                        (0, chai_1.expect)(volume1.records.length).to.eq(9);
                        volume2 = partition.volumes[1];
                        (0, chai_1.expect)(volume2.records.length).to.eq(9);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Formats an Akai disk image", function () {
            return __awaiter(this, void 0, void 0, function () {
                var c, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            c = newConfig();
                            return [4 /*yield*/, (0, s3k_1.akaiFormat)(c)];
                        case 1:
                            result = _a.sent();
                            result.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            (0, chai_1.expect)(result.code).eq(0);
                            return [2 /*return*/];
                    }
                });
            });
        });
        (0, mocha_1.it)("Writes to an Akai disk image and lists its contents", function () {
            return __awaiter(this, void 0, void 0, function () {
                var c, result, _i, _a, n, file, s, listResult, _b, _c, e;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            c = newConfig();
                            return [4 /*yield*/, (0, s3k_1.akaiFormat)(c)];
                        case 1:
                            result = _d.sent();
                            (0, chai_1.expect)(result.code).eq(0);
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            _i = 0, _a = ['saw.a3p', 'sawtooth.a3s', 'sine.a3s', 'square.a3s', 'test_program.a3p'];
                            _d.label = 2;
                        case 2:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            n = _a[_i];
                            file = path_1.default.join('test', 'data', 's3000xl', 'instruments', n);
                            return [4 /*yield*/, promises_1.default.stat(file)];
                        case 3:
                            s = _d.sent();
                            (0, chai_1.expect)(s.isFile());
                            return [4 /*yield*/, (0, s3k_1.akaiWrite)(c, file, "/VOLUME 1/")];
                        case 4:
                            result = _d.sent();
                            (0, chai_1.expect)(result.code).eq(0);
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            _d.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 2];
                        case 6: return [4 /*yield*/, (0, s3k_1.akaiList)(newConfig())];
                        case 7:
                            listResult = _d.sent();
                            for (_b = 0, _c = listResult.errors; _b < _c.length; _b++) {
                                e = _c[_b];
                                console.error(e);
                            }
                            // the first entry should be a volume
                            (0, chai_1.expect)(listResult.errors).empty;
                            (0, chai_1.expect)(listResult.data.length).eq(1);
                            (0, chai_1.expect)(listResult.data[0].type).eq(s3k_4.AkaiRecordType.VOLUME);
                            return [4 /*yield*/, (0, s3k_1.akaiList)(newConfig(), listResult.data[0].name)];
                        case 8:
                            // listing the volume should return some Akai objects
                            listResult = _d.sent();
                            (0, chai_1.expect)(listResult.errors).empty;
                            (0, chai_1.expect)(listResult.data.length).eq(5);
                            return [2 /*return*/];
                    }
                });
            });
        });
        (0, mocha_1.it)("Converts wav files to Akai sample format", function () { return __awaiter(void 0, void 0, void 0, function () {
            var source, stat, targetDir, c, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        source = path_1.default.join('test', 'data', 's3000xl', 'samples', 'kit.wav');
                        return [4 /*yield*/, promises_1.default.stat(source)];
                    case 1:
                        stat = _a.sent();
                        (0, chai_1.expect)(stat.isFile());
                        targetDir = path_1.default.join('build');
                        c = newConfig();
                        return [4 /*yield*/, (0, s3k_1.akaiFormat)(c)];
                    case 2:
                        result = _a.sent();
                        (0, chai_1.expect)(result.code).eq(0);
                        (0, chai_1.expect)(result.errors.length).eq(0);
                        return [4 /*yield*/, (0, s3k_1.wav2Akai)(c, source, targetDir, 'kit'.padEnd(12, ' '))];
                    case 3:
                        result = _a.sent();
                        (0, chai_1.expect)(!result.code);
                        (0, chai_1.expect)(result.errors).empty;
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
describe("Test parsing Akai objects read by akaitools", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, mocha_1.it)("Parses Akai program file", function () { return __awaiter(void 0, void 0, void 0, function () {
            var programPath, buffer, data, i, nibbles, header;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        programPath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_program.a3p');
                        return [4 /*yield*/, promises_1.default.readFile(programPath)];
                    case 1:
                        buffer = _a.sent();
                        data = [];
                        for (i = 0; i < buffer.length; i++) {
                            nibbles = (0, sampler_lib_1.byte2nibblesLE)(buffer[i]);
                            data.push(nibbles[0]);
                            data.push(nibbles[1]);
                        }
                        header = {};
                        (0, s3k_2.parseProgramHeader)(data, 1, header);
                        (0, chai_1.expect)(header.PRNAME).eq('TEST PROGRAM');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Parses Akai sample header from file", function () { return __awaiter(void 0, void 0, void 0, function () {
            var samplePath, data, header;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        samplePath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'sine.a3s');
                        return [4 /*yield*/, (0, s3k_1.readAkaiData)(samplePath)];
                    case 1:
                        data = _a.sent();
                        header = {};
                        (0, s3k_2.parseSampleHeader)(data, 0, header);
                        console.log("data size : ".concat(data.length));
                        (0, chai_1.expect)(header.SHNAME).equal('SINE        ');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Parses Akai program header from file", function () { return __awaiter(void 0, void 0, void 0, function () {
            var programPath, data, programHeader, kg1, kg2, keygroups, i, kg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        programPath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_4_kgs.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiData)(programPath)];
                    case 1:
                        data = _a.sent();
                        programHeader = {};
                        (0, s3k_2.parseProgramHeader)(data, 1, programHeader);
                        console.log("data size : ".concat(data.length));
                        console.log("Keygroup count: ".concat(programHeader.GROUPS));
                        (0, chai_1.expect)(programHeader.PRNAME).equal('TEST 4 KGS  ');
                        (0, chai_1.expect)(programHeader.GROUPS).eq(4);
                        kg1 = {};
                        // parseKeygroupHeader(data.slice(KEYGROUP1_START_OFFSET), 0, kg1)
                        (0, s3k_2.parseKeygroupHeader)(data.slice(s3k_1.CHUNK_LENGTH), 0, kg1);
                        (0, chai_1.expect)(kg1.SNAME1.startsWith('SINE'));
                        kg2 = {};
                        // parseKeygroupHeader(data.slice(KEYGROUP1_START_OFFSET + KEYGROUP_LENGTH), 0, kg2)
                        (0, s3k_2.parseKeygroupHeader)(data.slice(s3k_1.CHUNK_LENGTH + s3k_1.CHUNK_LENGTH), 0, kg2);
                        (0, chai_1.expect)(kg2.SNAME1.startsWith('SQUARE'));
                        keygroups = [];
                        for (i = 0; i < programHeader.GROUPS; i++) {
                            kg = {};
                            // parseKeygroupHeader(data.slice(KEYGROUP1_START_OFFSET + KEYGROUP_LENGTH * i), 0, kg)
                            (0, s3k_2.parseKeygroupHeader)(data.slice(s3k_1.CHUNK_LENGTH + s3k_1.CHUNK_LENGTH * i), 0, kg);
                            keygroups.push(kg);
                        }
                        (0, chai_1.expect)(keygroups[0].SNAME1).eq('SINE        ');
                        (0, chai_1.expect)(keygroups[1].SNAME1).eq('SQUARE      ');
                        (0, chai_1.expect)(keygroups[2].SNAME1).eq('SAWTOOTH    ');
                        (0, chai_1.expect)(keygroups[3].SNAME1).eq('PULSE       ');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Reads akai program files", function () { return __awaiter(void 0, void 0, void 0, function () {
            var programPath, programData, keygroups;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        programPath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_4_kgs.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(programPath)];
                    case 1:
                        programData = _a.sent();
                        (0, chai_1.expect)(programData.program.PRNAME).eq('TEST 4 KGS  ');
                        keygroups = programData.keygroups;
                        (0, chai_1.expect)(keygroups.length).eq(4);
                        (0, chai_1.expect)(keygroups[0].SNAME1).eq('SINE        ');
                        (0, chai_1.expect)(keygroups[1].SNAME1).eq('SQUARE      ');
                        (0, chai_1.expect)(keygroups[2].SNAME1).eq('SAWTOOTH    ');
                        (0, chai_1.expect)(keygroups[3].SNAME1).eq('PULSE       ');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Creates akaiprogram files", function () { return __awaiter(void 0, void 0, void 0, function () {
            var protoPath, programData, rawLeader, program, keygroup1, keygroup1data, keygroup2raw, keygroup2, keygroup2data, nibbles, i, i, outData, i, p, outfile, parsed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        protoPath = path_1.default.join('data', 'test_program.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(protoPath)];
                    case 1:
                        programData = _a.sent();
                        (0, chai_1.expect)(programData.program.PRNAME).eq('TEST PROGRAM');
                        (0, chai_1.expect)(programData.keygroups.length).eq(1);
                        rawLeader = 7;
                        program = programData.program;
                        // program.raw = raw
                        (0, s3k_2.ProgramHeader_writePRNAME)(program, 'SYNTHETIC');
                        keygroup1 = programData.keygroups[0];
                        // keygroup1.raw = keygroup1raw
                        (0, s3k_2.KeygroupHeader_writeSNAME1)(keygroup1, 'MODIFIED');
                        keygroup1data = keygroup1.raw.slice(rawLeader);
                        keygroup2raw = keygroup1.raw.slice();
                        keygroup2 = {};
                        keygroup2.raw = keygroup2raw;
                        (0, s3k_2.parseKeygroupHeader)(keygroup2raw.slice(rawLeader), 0, keygroup2);
                        (0, chai_1.expect)(keygroup2.SNAME1).eq('MODIFIED    ');
                        (0, s3k_2.KeygroupHeader_writeSNAME1)(keygroup2, 'KEYGROUP 2');
                        keygroup2data = keygroup2raw.slice(rawLeader);
                        // update GROUP count in program
                        (0, s3k_2.ProgramHeader_writeGROUPS)(program, 2);
                        nibbles = program.raw.slice(rawLeader);
                        for (i = 0; i < keygroup1data.length; i++) {
                            nibbles[s3k_1.CHUNK_LENGTH + i] = keygroup1data[i];
                        }
                        for (i = 0; i < keygroup2data.length; i++) {
                            // Nice that javascript automatically grows the array behind the scenes ;-)
                            // But, if this *wasn't* javascript, we'd have to explicitly grow the array.
                            // HOWEVER--if there is anything interesting at the end of the original program file AFTER the
                            // keygroup data, this will overwrite it.
                            // nibbles[KEYGROUP1_START_OFFSET * 2 + i] = keygroup2data[i]
                            nibbles[s3k_1.CHUNK_LENGTH * 2 + i] = keygroup2data[i];
                            // nibbles[KEYGROUP1_START_OFFSET + KEYGROUP_LENGTH * 2 + i] = keygroup2data[i]
                        }
                        outData = [];
                        for (i = 0; i < nibbles.length; i += 2) {
                            outData.push((0, sampler_lib_1.nibbles2byte)(nibbles[i], nibbles[i + 1]));
                        }
                        console.log("outdata lenght: ".concat(outData.length));
                        p = {};
                        (0, s3k_2.parseProgramHeader)(nibbles, 1, p);
                        (0, chai_1.expect)(p.PRNAME).eq('SYNTHETIC   ');
                        outfile = path_1.default.join('build', 'synthetic.a3p');
                        return [4 /*yield*/, promises_1.default.writeFile(outfile, Buffer.from(outData))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(outfile)];
                    case 3:
                        parsed = _a.sent();
                        (0, chai_1.expect)(parsed.program.PRNAME).eq('SYNTHETIC   ');
                        (0, chai_1.expect)(parsed.keygroups[0].SNAME1).eq('MODIFIED    ');
                        (0, chai_1.expect)(parsed.keygroups.length).eq(2);
                        (0, chai_1.expect)(parsed.keygroups[1].SNAME1).eq('KEYGROUP 2  ');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Adds keygroups", function () { return __awaiter(void 0, void 0, void 0, function () {
            var protoPath, p, kg2, outfile, p2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        protoPath = path_1.default.join('data', 'test_program.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(protoPath)];
                    case 1:
                        p = _a.sent();
                        (0, chai_1.expect)(p.program).to.exist;
                        (0, chai_1.expect)(p.keygroups).to.exist;
                        (0, chai_1.expect)(p.keygroups.length).eq(1);
                        (0, chai_1.expect)(p.keygroups[0].SNAME1).eq('SINE        ');
                        (0, s3k_2.ProgramHeader_writePRNAME)(p.program, 'SYNTHETIC');
                        (0, s3k_1.addKeygroup)(p);
                        (0, chai_1.expect)(p.keygroups.length).eq(2);
                        (0, s3k_2.KeygroupHeader_writeSNAME1)(p.keygroups[1], 'SQUARE');
                        kg2 = {};
                        (0, s3k_2.parseKeygroupHeader)(p.keygroups[1].raw.slice(s3k_1.RAW_LEADER), 0, kg2);
                        (0, chai_1.expect)(kg2.SNAME1).eq('SQUARE      ');
                        outfile = path_1.default.join('build', "synthetic.".concat(new Date().getTime(), ".a3p"));
                        return [4 /*yield*/, (0, s3k_1.writeAkaiProgram)(outfile, p)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(outfile)];
                    case 3:
                        p2 = _a.sent();
                        (0, chai_1.expect)(p2.keygroups.length).eq(2);
                        (0, chai_1.expect)(p.keygroups[0].SNAME1).eq('SINE        ');
                        (0, chai_1.expect)(p2.keygroups[1].SNAME1).eq('SQUARE      ');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Reads and writes a program file with multiple keygroups unchanged", function () { return __awaiter(void 0, void 0, void 0, function () {
            var protoPath, p, outpath, cfg, diskpath, c;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        protoPath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_4_kgs.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(protoPath)];
                    case 1:
                        p = _a.sent();
                        outpath = path_1.default.join('build', 'test_4_kgs.a3p');
                        return [4 /*yield*/, promises_1.default.rm(outpath).then().catch(function () {
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, s3k_1.writeAkaiProgram)(outpath, p)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, sampler_lib_2.newServerConfig)()];
                    case 4:
                        cfg = _a.sent();
                        diskpath = path_1.default.join(cfg.s3k, 'HD4.hds');
                        c = { akaiToolsPath: cfg.akaiTools, diskFile: diskpath };
                        return [4 /*yield*/, (0, s3k_1.akaiFormat)(c, 1, 1)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, s3k_1.akaiWrite)(c, outpath, '/test4kgs')];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)('Reads and writes a program file with multiple keygroups and adds a keygroup', function () { return __awaiter(void 0, void 0, void 0, function () {
            var protoPath, p, outpath, cfg, diskpath, c;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        protoPath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_4_kgs.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(protoPath)];
                    case 1:
                        p = _a.sent();
                        (0, s3k_1.addKeygroup)(p);
                        outpath = path_1.default.join('build', 'test_5_kgs.a3p');
                        return [4 /*yield*/, promises_1.default.rm(outpath).then().catch(function () {
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, s3k_1.writeAkaiProgram)(outpath, p)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, sampler_lib_2.newServerConfig)()];
                    case 4:
                        cfg = _a.sent();
                        diskpath = path_1.default.join(cfg.s3k, 'HD4.hds');
                        c = { akaiToolsPath: cfg.akaiTools, diskFile: diskpath };
                        return [4 /*yield*/, (0, s3k_1.akaiFormat)(c, 1, 1)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, s3k_1.akaiWrite)(c, outpath, '/test5kgs')];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Writes a known good multi-keygroup akai program to disk and reads it back", function () { return __awaiter(void 0, void 0, void 0, function () {
            var goodPath, good, outpath, suspect, i, goodkg, suskg, diskpath, c, result, _i, _a, record_1, record, refriedDir, refriedPath, refried, i, goodkg, refkg;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        goodPath = path_1.default.join('test', 'data', 's3000xl', 'chops', 'brk.10', 'brk.10_good.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(goodPath)];
                    case 1:
                        good = _b.sent();
                        outpath = path_1.default.join('build', 'brk.10_sus.a3p');
                        return [4 /*yield*/, (0, s3k_1.writeAkaiProgram)(outpath, good)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(outpath)];
                    case 3:
                        suspect = _b.sent();
                        (0, chai_1.expect)(suspect.program.PRNAME).eq(good.program.PRNAME);
                        for (i = 0; i < good.keygroups.length; i++) {
                            goodkg = good.keygroups[i];
                            suskg = suspect.keygroups[i];
                            console.log("good[".concat(i, "]: SNAME1: ").concat(goodkg.SNAME1));
                            console.log("sus[".concat(i, "] : SNAME1: ").concat(suskg.SNAME1));
                            console.log();
                            (0, chai_1.expect)(suskg.SNAME1).eq(goodkg.SNAME1);
                        }
                        diskpath = path_1.default.join('build', 'akai.img');
                        return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                    case 4:
                        c = _b.sent();
                        c.diskFile = diskpath;
                        return [4 /*yield*/, (0, s3k_1.akaiFormat)(c)];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, (0, s3k_1.akaiWrite)(c, outpath, '/test')];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, (0, s3k_1.akaiList)(c, '/test')];
                    case 7:
                        result = _b.sent();
                        (0, chai_1.expect)(result.data).to.exist;
                        (0, chai_1.expect)(result.data.length).gte(1);
                        for (_i = 0, _a = result.data; _i < _a.length; _i++) {
                            record_1 = _a[_i];
                            console.log("record:");
                            console.log(record_1);
                        }
                        record = result.data[0];
                        (0, chai_1.expect)(record.type).eq(s3k_4.AkaiRecordType.PROGRAM);
                        (0, chai_1.expect)(record.name.endsWith(path_1.default.parse(outpath).name));
                        refriedDir = path_1.default.join('build', "tmp-".concat(new Date().getTime()));
                        return [4 /*yield*/, (0, s3k_1.akaiRead)(c, '/test', refriedDir)];
                    case 8:
                        _b.sent();
                        refriedPath = path_1.default.join(refriedDir, 'test', path_1.default.parse(outpath).name + '.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(refriedPath)];
                    case 9:
                        refried = _b.sent();
                        console.log("refried name: ".concat(refried.program.PRNAME));
                        (0, chai_1.expect)(refried).to.exist;
                        (0, chai_1.expect)(refried.keygroups).to.exist;
                        (0, chai_1.expect)(refried.keygroups.length).eq(good.keygroups.length);
                        for (i = 0; i < good.keygroups.length; i++) {
                            goodkg = good.keygroups[i];
                            refkg = refried.keygroups[i];
                            console.log("good[".concat(i, "]  : SNAME1: ").concat(goodkg.SNAME1));
                            console.log("refried[".concat(i, "] : SNAME1: ").concat(refkg.SNAME1));
                            console.log();
                            (0, chai_1.expect)(refkg.SNAME1).eq(goodkg.SNAME1);
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Compares known good to broken akai program", function () { return __awaiter(void 0, void 0, void 0, function () {
            var goodPath, badPath, good, bad, i, goodkg, i, badkg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        goodPath = path_1.default.join('test', 'data', 's3000xl', 'chops', 'brk.10', 'brk.10_good.a3p');
                        badPath = path_1.default.join('test', 'data', 's3000xl', 'chops', 'brk.10-broken', 'brk.10.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(goodPath)];
                    case 1:
                        good = _a.sent();
                        return [4 /*yield*/, (0, s3k_1.readAkaiProgram)(badPath)];
                    case 2:
                        bad = _a.sent();
                        console.log("good: KGRP1 (block address of first keygroup): ".concat(good.program.KGRP1));
                        console.log("bad : KGRP1                                  : ".concat(bad.program.KGRP1));
                        for (i = 0; i < good.keygroups.length; i++) {
                            goodkg = good.keygroups[i];
                            console.log("good[".concat(i, "]: SNAME1: ").concat(goodkg.SNAME1));
                        }
                        for (i = 0; i < bad.keygroups.length; i++) {
                            badkg = bad.keygroups[i];
                            console.log("badkg[".concat(i, "]: SNAME1: ").concat(badkg.SNAME1));
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_1.it)("Finds strings in akai files", function () { return __awaiter(void 0, void 0, void 0, function () {
            var programPath, data, offset, v, window, s;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        programPath = path_1.default.join('test', 'data', 's3000xl', 'instruments', 'test_program.a3p');
                        return [4 /*yield*/, (0, s3k_1.readAkaiData)(programPath)];
                    case 1:
                        data = _a.sent();
                        offset = 0;
                        v = { value: 0, offset: offset * 2 };
                        window = [];
                        while (v.offset < data.length) {
                            (0, s3k_3.nextByte)(data, v);
                            window.push(v.value);
                            if (window.length > 12) {
                                window.shift();
                            }
                            s = (0, s3k_3.akaiByte2String)(window);
                            console.log("".concat(v.offset, ": ").concat(s));
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
describe("Synchronizing data w/ a piscsi host", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, mocha_1.it)("Parses table of mounted volumes", function () {
            return __awaiter(this, void 0, void 0, function () {
                var table, parsed;
                return __generator(this, function (_a) {
                    table = "+----+-----+------+-------------------------------------\n| ID | LUN | TYPE | IMAGE FILE\n+----+-----+------+-------------------------------------\n|  1 |   0 | SCHD | /home/orion/images/HD1.hds\n|  2 |   0 | SCHD | /home/orion/images/HD2.hds\n|  4 |   0 | SCHD | /home/orion/images/HD4.hds\n|  5 |   0 | SCHD | /home/orion/images/HD5.hds\n+----+-----+------+-------------------------------------";
                    parsed = (0, s3k_1.parseRemoteVolumes)(table);
                    (0, chai_1.expect)(parsed).exist;
                    (0, chai_1.expect)(parsed.length).eq(4);
                    (0, chai_1.expect)(parsed[0].scsiId).eq(1);
                    (0, chai_1.expect)(parsed[0].lun).eq(0);
                    (0, chai_1.expect)(parsed[0].image).eq('/home/orion/images/HD1.hds');
                    return [2 /*return*/];
                });
            });
        });
        (0, mocha_1.it)("Lists mounted volumes", function () {
            return __awaiter(this, void 0, void 0, function () {
                var c, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.timeout(5000);
                            return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                        case 1:
                            c = _a.sent();
                            (0, chai_1.expect)(c.piscsiHost);
                            (0, chai_1.expect)(c.scsiId);
                            return [4 /*yield*/, (0, s3k_1.remoteVolumes)(c)];
                        case 2:
                            result = _a.sent();
                            result.data.forEach(function (v) { return console.log(v); });
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            (0, chai_1.expect)(result.data.length).gte(1);
                            return [2 /*return*/];
                    }
                });
            });
        });
        (0, mocha_1.it)("Unmounts a volume", function () {
            return __awaiter(this, void 0, void 0, function () {
                var c, v, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.timeout(5000);
                            return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                        case 1:
                            c = _a.sent();
                            v = { image: "/home/orion/images/HD4.hds", scsiId: 4 };
                            return [4 /*yield*/, (0, s3k_1.remoteUnmount)(c, v)];
                        case 2:
                            result = _a.sent();
                            result.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(result.code).eq(0);
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            return [2 /*return*/];
                    }
                });
            });
        });
        (0, mocha_1.it)('Mounts a volume', function () {
            return __awaiter(this, void 0, void 0, function () {
                var c, v, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.timeout(5000);
                            return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                        case 1:
                            c = _a.sent();
                            v = { image: "/home/orion/images/HD4.hds", scsiId: 4 };
                            return [4 /*yield*/, (0, s3k_1.remoteMount)(c, v)];
                        case 2:
                            result = _a.sent();
                            result.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(result.code).eq(0);
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            return [2 /*return*/];
                    }
                });
            });
        });
        (0, mocha_1.it)('Syncs akai data', function () {
            return __awaiter(this, void 0, void 0, function () {
                var c, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.timeout(30000);
                            return [4 /*yield*/, (0, s3k_1.newAkaiToolsConfig)()];
                        case 1:
                            c = _a.sent();
                            return [4 /*yield*/, (0, s3k_1.remoteSync)(c)];
                        case 2:
                            result = _a.sent();
                            result.errors.forEach(function (e) { return console.error(e); });
                            (0, chai_1.expect)(result.code).eq(0);
                            (0, chai_1.expect)(result.errors.length).eq(0);
                            return [2 /*return*/];
                    }
                });
            });
        });
        return [2 /*return*/];
    });
}); });
