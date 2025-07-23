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
Object.defineProperty(exports, "__esModule", { value: true });
var remoteRepositories_1 = require("../helpers/remoteRepositories");
var ValidateBranches_1 = require("../../src/commands/repos/ValidateBranches");
var Global_1 = require("../../src/Global");
var util_1 = require("../../src/util");
var path = require("path");
var fs = require("fs");
function writeParentRepos(dir, newParentRepos) {
    var newParentReposContent = (0, util_1.enforceNewline)(JSON.stringify(newParentRepos, null, 2));
    var parentRepos = path.join(dir, 'parent-repos.json');
    fs.writeFileSync(parentRepos, newParentReposContent, 'utf8');
}
function assertBasicStructureConsistency(validationResult) {
    // test if all expected repos are mapped
    expect(Array.from(validationResult.dependenciesMap.keys()).sort()).toEqual(['main', 'test_1', 'test_2']);
    // test if the count of dependent repos to a parent repo is correct
    // tslint:disable:no-backbone-get-set-outside-model
    expect(validationResult.dependenciesMap.get('main').length).toEqual(4);
    expect(validationResult.dependenciesMap.get('test_1').length).toEqual(2);
    expect(validationResult.dependenciesMap.get('test_2').length).toEqual(1);
    // tslint:enable:no-backbone-get-set-outside-model
    // tests if the first level of repositories status is applied correctly from the root parent repos to the transitive structure
    Object.entries(validationResult.rootDependencies.reposDescriptor).forEach(function (_a) {
        var _b;
        var repoName = _a[0], repoStatus = _a[1];
        expect((_b = validationResult.rootDependencies.transitiveDependencies.get(repoName)) === null || _b === void 0 ? void 0 : _b.repoStatus).toEqual(repoStatus);
    });
}
describe('validate the transitive of the root parent repos json for a basic setup', function () {
    test('all branches are correctly configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testBranches, assertThatThereAreNoDiffs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var parentRepos, params, vb;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    parentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                                    writeParentRepos(path.join(rootDir, '..', 'test_1'), {
                                        main: { url: parentRepos.main.url, branch: 'release/22.2' }
                                    });
                                    writeParentRepos(path.join(rootDir, '..', 'test_2'), {
                                        main: { url: parentRepos.main.url, branch: 'release/22.2' },
                                        test_1: { url: parentRepos.test_1.url, branch: 'release/22.2' }
                                    });
                                    params = {};
                                    params[Global_1.Global.PARAMETER_VERBOSE] = true;
                                    Global_1.Global.parseParameters(params);
                                    vb = new ValidateBranches_1.ValidateBranches();
                                    vb.prepareAndMayExecute(params, rootDir);
                                    return [4 /*yield*/, vb.execute()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, vb.validateAndReport()];
                            }
                        });
                    }); };
                    assertThatThereAreNoDiffs = function (validationResult) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            assertBasicStructureConsistency(validationResult);
                            // there must be no differences
                            expect(validationResult.report.diffStatistic.size).toEqual(0);
                            expect(validationResult.report.reposWithDiff.size).toEqual(0);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.basicTestSetupData)
                            .withBranchUnderTest('release/22.2')
                            .evaluateWithFolders(testBranches, assertThatThereAreNoDiffs)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('branches are not correctly configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testBranches, assertBranches;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var parentRepos, params, vb;
                        return __generator(this, function (_a) {
                            parentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            writeParentRepos(path.join(rootDir, '..', 'test_1'), {
                                main: { url: parentRepos.main.url, branch: 'release/22.2' }
                            });
                            writeParentRepos(path.join(rootDir, '..', 'test_2'), {
                                main: { url: parentRepos.main.url, branch: 'customer/custom/abc/22.2-ABC', artifactGroup: 'cf.cplace.abc' },
                                test_1: { url: parentRepos.test_1.url, branch: 'release/22.2' }
                            });
                            params = {};
                            params[Global_1.Global.PARAMETER_VERBOSE] = true;
                            params[ValidateBranches_1.ValidateBranches.PARAMETER_INCLUDE] = 'branch artifactGroup';
                            Global_1.Global.parseParameters(params);
                            vb = new ValidateBranches_1.ValidateBranches();
                            vb.prepareAndMayExecute(params, rootDir);
                            return [2 /*return*/, vb.validateAndReport()];
                        });
                    }); };
                    assertBranches = function (validationResult) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            assertBasicStructureConsistency(validationResult);
                            expect(validationResult.report.diffStatistic.size).toEqual(4);
                            expect(validationResult.report.reposWithDiff.size).toEqual(1);
                            expect(Array.from(validationResult.report.reposWithDiff.keys())).toEqual(['main']);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.basicTestSetupData)
                            .withBranchUnderTest('release/22.2')
                            .evaluateWithFolders(testBranches, assertBranches)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('a transitive repo is missing', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testBranches;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var parentRepos, params, vb;
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            parentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            writeParentRepos(path.join(rootDir, '..', 'test_1'), {
                                main: { url: parentRepos.main.url, branch: 'release/22.2' },
                                missing: { url: 'git@cplace.test.de:missing.git', branch: 'release/22.2' }
                            });
                            writeParentRepos(path.join(rootDir, '..', 'test_2'), {
                                main: { url: parentRepos.main.url, branch: 'customer/custom/abc/22.2-ABC', artifactGroup: 'cf.cplace.abc' },
                                test_1: { url: parentRepos.test_1.url, branch: 'release/22.2' }
                            });
                            params = {};
                            params[Global_1.Global.PARAMETER_VERBOSE] = true;
                            params[ValidateBranches_1.ValidateBranches.PARAMETER_INCLUDE] = 'branch artifactGroup';
                            Global_1.Global.parseParameters(params);
                            vb = new ValidateBranches_1.ValidateBranches();
                            vb.prepareAndMayExecute(params, rootDir);
                            try {
                                vb.validateAndReport();
                            }
                            catch (e) {
                                if (((_a = e === null || e === void 0 ? void 0 : e.message) === null || _a === void 0 ? void 0 : _a.includes('[rootRepo]: Missing repositories! Reference paths:'))
                                    && ((_b = e === null || e === void 0 ? void 0 : e.message) === null || _b === void 0 ? void 0 : _b.includes('rootRepo -> test_1 -> * missing'))
                                    && ((_c = e === null || e === void 0 ? void 0 : e.message) === null || _c === void 0 ? void 0 : _c.includes('rootRepo -> test_2 -> test_1 -> * missing'))) {
                                    return [2 /*return*/, true];
                                }
                                else {
                                    throw new Error("Did not fail as expected!Original message:\n".concat(e === null || e === void 0 ? void 0 : e.message));
                                }
                            }
                            return [2 /*return*/, false];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.basicTestSetupData)
                            .withBranchUnderTest('release/22.2')
                            .evaluateWithFolders(testBranches, remoteRepositories_1.assertVoid)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
