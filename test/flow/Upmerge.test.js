"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var Upmerge_1 = require("../../src/commands/flow/Upmerge");
var git_1 = require("../../src/git");
// Mock Repository class
jest.mock('../../src/git/Repository');
describe('Upmerge', function () {
    var upmerge;
    var mockRepo;
    beforeEach(function () {
        jest.clearAllMocks();
        mockRepo = new git_1.Repository();
        git_1.Repository.mockImplementation(function () { return mockRepo; });
        upmerge = new Upmerge_1.Upmerge();
        upmerge.repo = mockRepo;
    });
    describe('prepareAndMayExecute', function () {
        it('should initialize with default values', function () {
            var params = {};
            var result = upmerge.prepareAndMayExecute(params);
            expect(result).toBeTruthy();
            expect(git_1.Repository).toHaveBeenCalled();
        });
        it('should accept custom remote', function () {
            var params = {
                remote: 'custom-remote'
            };
            var result = upmerge.prepareAndMayExecute(params);
            expect(result).toBeTruthy();
        });
    });
    describe('execute', function () {
        var mockBranches = [
            {
                name: 'origin/release/23.4',
                commit: 'commit1',
                current: false,
                isRemote: true,
                tracking: null
            },
            {
                name: 'origin/release/24.1',
                commit: 'commit2',
                current: false,
                isRemote: true,
                tracking: null
            },
            {
                name: 'origin/release/24.2',
                commit: 'commit3',
                current: false,
                isRemote: true,
                tracking: null
            },
            {
                name: 'origin/master',
                commit: 'commit4',
                current: false,
                isRemote: true,
                tracking: null
            }
        ];
        beforeEach(function () {
            mockRepo.fetch.mockResolvedValue();
            mockRepo.status.mockResolvedValue(createStatusResult());
            mockRepo.listBranches.mockResolvedValue(mockBranches);
            mockRepo.checkoutBranch.mockResolvedValue();
            mockRepo.merge.mockResolvedValue();
            mockRepo.push.mockResolvedValue();
            mockRepo.deleteBranch.mockResolvedValue();
        });
        it('should fail if working directory is not clean', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockRepo.status.mockResolvedValue(createStatusResult({
                            not_added: ['file1'],
                            isClean: function () { return false; }
                        }));
                        return [4 /*yield*/, expect(upmerge.execute()).rejects.toMatch('Cannot proceed with upmerge: repository has uncommitted changes')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should fail if current branch is behind remote', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockRepo.status.mockResolvedValue(createStatusResult({
                            behind: 2
                        }));
                        return [4 /*yield*/, expect(upmerge.execute()).rejects.toMatch('current branch is 2 commits behind')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should perform upmerge sequence successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var params;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = {
                            release: '23.4',
                            push: true
                        };
                        expect(upmerge.prepareAndMayExecute(params)).toBeTruthy();
                        return [4 /*yield*/, upmerge.execute()];
                    case 1:
                        _a.sent();
                        // Should create temp branches for merging
                        expect(mockRepo.checkoutBranch).toHaveBeenCalledTimes(5); // Each branch + return to original
                        // Should perform merges in sequence
                        expect(mockRepo.merge).toHaveBeenCalledTimes(3); // 23.4->24.1, 24.1->24.2, 24.2->master
                        // Should push changes
                        expect(mockRepo.push).toHaveBeenCalledTimes(3);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not push changes when push is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var params;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = {
                            release: '23.4',
                            push: false
                        };
                        upmerge.prepareAndMayExecute(params);
                        return [4 /*yield*/, upmerge.execute()];
                    case 1:
                        _a.sent();
                        expect(mockRepo.push).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle customer branches when specified', function () { return __awaiter(void 0, void 0, void 0, function () {
            var customerBranches, params;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        customerBranches = __spreadArray(__spreadArray([], mockBranches, true), [
                            {
                                name: 'origin/customer/acme/23.4',
                                commit: 'commit5',
                                current: false,
                                isRemote: true,
                                tracking: null
                            },
                            {
                                name: 'origin/customer/acme/24.1',
                                commit: 'commit6',
                                current: false,
                                isRemote: true,
                                tracking: null
                            }
                        ], false);
                        mockRepo.listBranches.mockResolvedValue(customerBranches);
                        params = {
                            release: '23.4',
                            customer: 'acme',
                            push: true
                        };
                        upmerge.prepareAndMayExecute(params);
                        return [4 /*yield*/, upmerge.execute()];
                    case 1:
                        _a.sent();
                        // Should handle additional merges for customer branches
                        expect(mockRepo.merge).toHaveBeenCalledTimes(6); // Regular merges + customer branch merges
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
// Helper function to create status results
function createStatusResult(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ not_added: [], conflicted: [], created: [], deleted: [], modified: [], renamed: [], files: [], staged: [], ahead: 0, behind: 0, current: 'release/23.4', tracking: 'origin/release/23.4', isClean: function () { return true; }, detached: false }, overrides);
}
