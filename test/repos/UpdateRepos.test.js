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
var CloneRepos_1 = require("../../src/commands/repos/CloneRepos");
var remoteRepositories_1 = require("../helpers/remoteRepositories");
var AbstractReposCommand_1 = require("../../src/commands/repos/AbstractReposCommand");
var Global_1 = require("../../src/Global");
var UpdateRepos_1 = require("../../src/commands/repos/UpdateRepos");
var path = require("path");
/*
 * Tests several behaviours updating the parent repositories.
 * Scenarios and expectations:
 *
 * A) only branches are configured and there are no remote tags
 *    -> use the latest remote HEAD of the branch
 * B) checked out on initial tags, only branches configured for update
 *   -> updates to the latest tag
 * C) checked out on initial tags, only branches configured for update, useSnapshot is true for one repo
 *   -> use the latest remote HEAD of the 'useSnapshot' branch
 *   -> updates to the latest tag of the other branches
 * D) checked out on initial tags, other tags are configured for update
 *    -> updates to the configured tag
 * E) branches and tags are mixed
 *   -> in case of only a branch, clone the latest tag
 *   -> in case of tag, clone the tag
 * F) in case of a tagMarker but no tag:
 *   -> use the latest tag and validate that the version matches at least the tag marker
 * G) fails if only the repo url is configured
 *   -> update requires either branch or tag
 * H) A tag that does not exist is configured
 *   -> Updating should fail at this point
 * I) A tag with another format is configured
 *   -> should be updated to the custom tag
 * J) A customer branch with useSnapshot is configured
 *   -> should be updated on the latest HEAD of the customer branch
 *   -> NOTE: will fail if shallow cloned
 * K) A customer branch is configured
 *   -> should be updated on the latest HEAD of the customer branch as remote tags are only resolved for release branches
 */
function testWithParentRepos(rootDir, parentRepos, depth) {
    if (depth === void 0) { depth = 1; }
    return __awaiter(this, void 0, void 0, function () {
        var cloneParams, cl, updateParams, ur;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (parentRepos.checkout) {
                        (0, remoteRepositories_1.writeAndCommitParentRepos)(parentRepos.checkout, rootDir);
                    }
                    cloneParams = {};
                    cloneParams[AbstractReposCommand_1.AbstractReposCommand.PARAMETER_CLONE_DEPTH] = depth;
                    cloneParams[Global_1.Global.PARAMETER_VERBOSE] = true;
                    Global_1.Global.parseParameters(cloneParams);
                    cl = new CloneRepos_1.CloneRepos();
                    cl.prepareAndMayExecute(cloneParams, rootDir);
                    return [4 /*yield*/, cl.execute()];
                case 1:
                    _a.sent();
                    console.log('---- preparing update env ----');
                    if (parentRepos.update) {
                        (0, remoteRepositories_1.writeAndCommitParentRepos)(parentRepos.update, rootDir);
                    }
                    updateParams = {};
                    updateParams[Global_1.Global.PARAMETER_VERBOSE] = true;
                    // other params to test:
                    // UpdateRepos.PARAMETER_NO_FETCH
                    // UpdateRepos.PARAMETER_RESET_TO_REMOTE
                    Global_1.Global.parseParameters(updateParams);
                    ur = new UpdateRepos_1.UpdateRepos();
                    console.log('---- preparing update command ----');
                    ur.prepareAndMayExecute(updateParams, rootDir);
                    console.log('---- executing update command ----');
                    return [4 /*yield*/, ur.execute()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, rootDir];
            }
        });
    });
}
describe('updating the parent repos', function () {
    test('C) checked out on initial tags, only branches configured for update, useSnapshot is true', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentReposWithTagsAndBranches, assertThatTheReposAreBackOnTheExpectedTagOrOnTheHead;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentReposWithTagsAndBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var updateParentRepos;
                        return __generator(this, function (_a) {
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos.main.tag = 'version/22.2.0';
                            updateParentRepos.main.tagMarker = 'version/22.2.0';
                            updateParentRepos.test_1.tag = 'version/22.2.0';
                            updateParentRepos.test_1.tagMarker = 'version/22.2.0';
                            // useSnapshot is expected to take precedence
                            updateParentRepos.test_2.tag = 'version/22.2.0';
                            updateParentRepos.test_2.tagMarker = 'version/22.2.0';
                            updateParentRepos.test_2.useSnapshot = true;
                            return [2 /*return*/, testWithParentRepos(rootDir, { update: updateParentRepos }, 0)];
                        });
                    }); };
                    assertThatTheReposAreBackOnTheExpectedTagOrOnTheHead = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        var repoFolder;
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            repoFolder = path.resolve(testResult, '..', 'test_2');
                            (0, remoteRepositories_1.assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch)(repoFolder, 'release/22.2');
                            (0, remoteRepositories_1.assertThatTheParentReposAreCheckedOutToTheExpectedTags)({ main: 'version/22.2.0', test_1: 'version/22.2.0' }, testResult);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.basicTestSetupData)
                            .withBranchUnderTest('release/22.2')
                            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertThatTheReposAreBackOnTheExpectedTagOrOnTheHead)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('G) fails if only the repo url is configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentRepos;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentRepos = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                                    updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                                    Object.keys(checkoutParentRepos).forEach(function (repo) {
                                        checkoutParentRepos[repo].branch = 'release/22.2';
                                    });
                                    Object.keys(updateParentRepos).forEach(function (repo) {
                                        updateParentRepos[repo].branch = null;
                                    });
                                    // no branch or tag given in parent-repos.json
                                    return [4 /*yield*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })
                                            .catch(function (e) {
                                            var _a, _b, _c;
                                            // expected to fail
                                            if (!(((_a = e === null || e === void 0 ? void 0 : e.message) === null || _a === void 0 ? void 0 : _a.includes('[main]: No branch or tag given in parent-repos.json for repo main'))
                                                && ((_b = e === null || e === void 0 ? void 0 : e.message) === null || _b === void 0 ? void 0 : _b.includes('[test_1]: No branch or tag given in parent-repos.json for repo test_1'))
                                                && ((_c = e === null || e === void 0 ? void 0 : e.message) === null || _c === void 0 ? void 0 : _c.includes('[test_2]: No branch or tag given in parent-repos.json for repo test_2')))) {
                                                throw new Error('Did not to fail due to "[test_2]: Configured tagMarker version/22.3.3 has a higher version then the latest available tag version/22.3.2!"!');
                                            }
                                        })];
                                case 1:
                                    // no branch or tag given in parent-repos.json
                                    _a.sent();
                                    return [2 /*return*/, true];
                            }
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.basicTestSetupData)
                            .withBranchUnderTest('master')
                            .evaluateWithRemoteRepos(testCloningTheParentRepos, remoteRepositories_1.assertVoid)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('H) A tag that does not exist is configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentRepos;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentRepos = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var updateParentRepos;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                                    updateParentRepos.main.tag = 'version/22.2.99';
                                    return [4 /*yield*/, testWithParentRepos(rootDir, { update: updateParentRepos }, 0)
                                            .catch(function (e) {
                                            var _a;
                                            // expected to fail
                                            console.log(e);
                                            if (!((_a = e === null || e === void 0 ? void 0 : e.message) === null || _a === void 0 ? void 0 : _a.includes('Error: Command failed: git ls-tree --name-only "version/22.2.99" "node_modules"'))) {
                                                throw new Error('Did not to fail with the expected reason!');
                                            }
                                        })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, true];
                            }
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.basicTestSetupData)
                            .withBranchUnderTest('release/22.2')
                            .evaluateWithRemoteRepos(testCloningTheParentRepos, remoteRepositories_1.assertVoid)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('updating the parent repos for a complex setup', function () {
    test('A) only branches are configured and there are no remote tags', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentRepos, assertCloningTheParentReposBranchesOnly;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentRepos = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, testWithParentRepos(rootDir, {})];
                        });
                    }); };
                    assertCloningTheParentReposBranchesOnly = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        var parentRepos;
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            parentRepos = (0, remoteRepositories_1.catParentReposJson)(testResult);
                            Object.keys(parentRepos).forEach(function (repo) {
                                var repoFolder = path.resolve(testResult, '..', repo);
                                (0, remoteRepositories_1.assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch)(repoFolder, 'release/5.20');
                            });
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/5.20')
                            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposBranchesOnly)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('B) checked out on initial tags, only branches configured for update', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testUpdatingTheParentReposToTheLatestTag = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].tag = 'version/22.3.0';
                            });
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })];
                        });
                    }); };
                    assertThatTheParentReposAreUpdatedToTheLatestTag = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            (0, remoteRepositories_1.assertThatTheParentReposAreCheckedOutToTheExpectedTags)({ main: 'version/22.3.2', test_1: 'version/22.3.4', test_2: 'version/22.3.2' }, testResult);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.3')
                            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('D) checked out on initial tags, other tags are configured for update', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tags, testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tags = {
                        main: 'version/22.3.1',
                        test_1: 'version/22.3.2',
                        test_2: 'version/22.3.1'
                    };
                    testUpdatingTheParentReposToTheLatestTag = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].tag = 'version/22.3.0';
                            });
                            Object.keys(tags).forEach(function (repo) {
                                updateParentRepos[repo].tag = tags[repo];
                            });
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })];
                        });
                    }); };
                    assertThatTheParentReposAreUpdatedToTheLatestTag = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            (0, remoteRepositories_1.assertThatTheParentReposAreCheckedOutToTheExpectedTags)(tags, testResult);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.3')
                            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('E) branches and tags are mixed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tags, testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tags = {
                        main: 'version/22.3.1',
                        test_1: 'version/22.3.2'
                    };
                    testUpdatingTheParentReposToTheLatestTag = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].tag = 'version/22.3.0';
                            });
                            Object.keys(tags).forEach(function (repo) {
                                updateParentRepos[repo].tag = tags[repo];
                            });
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })];
                        });
                    }); };
                    assertThatTheParentReposAreUpdatedToTheLatestTag = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            (0, remoteRepositories_1.assertThatTheParentReposAreCheckedOutToTheExpectedTags)({ test_2: 'version/22.3.2' }, testResult);
                            (0, remoteRepositories_1.assertThatTheParentReposAreCheckedOutToTheExpectedTags)(tags, testResult);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.3')
                            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('F) in case of a tagMarker but no tag', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tagMarker, expectedTags, testCloningTheParentRepos, assertCloningTheParentReposTagsOnly;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tagMarker = {
                        main: 'version/22.3.1',
                        test_1: 'version/22.3.3',
                        test_2: 'version/22.3.1'
                    };
                    expectedTags = {
                        main: 'version/22.3.2',
                        test_1: 'version/22.3.4',
                        test_2: 'version/22.3.2'
                    };
                    testCloningTheParentRepos = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].branch = 'master';
                            });
                            Object.keys(tagMarker).forEach(function (repo) {
                                updateParentRepos[repo].tagMarker = tagMarker[repo];
                            });
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })];
                        });
                    }); };
                    assertCloningTheParentReposTagsOnly = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            (0, remoteRepositories_1.assertThatTheParentReposAreCheckedOutToTheExpectedTags)(expectedTags, testResult);
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.3')
                            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('F) in case of a tagMarker but no tag fails when a wrong tagMarker is configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentReposWithTagMarkersFails;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentReposWithTagMarkersFails = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                                    updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                                    Object.keys(checkoutParentRepos).forEach(function (repo) {
                                        checkoutParentRepos[repo].branch = 'master';
                                    });
                                    updateParentRepos.main.tagMarker = 'version/22.3.1';
                                    updateParentRepos.test_1.tagMarker = 'version/22.3.1';
                                    // there is no tag 22.3.2
                                    updateParentRepos.test_2.tagMarker = 'version/22.3.3';
                                    return [4 /*yield*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })
                                            .catch(function (e) {
                                            var _a;
                                            // expected to fail
                                            if (!((_a = e === null || e === void 0 ? void 0 : e.message) === null || _a === void 0 ? void 0 : _a.endsWith('[test_2]: Configured tagMarker version/22.3.3 has a higher patch version then the latest available tag version/22.3.2!'))) {
                                                throw new Error('Did not to fail due to "[test_2]: Configured tagMarker version/22.3.3 has a higher version then the latest available tag version/22.3.2!"!');
                                            }
                                        })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, true];
                            }
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.3')
                            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagMarkersFails, remoteRepositories_1.assertVoid)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('I) A tag with another format is configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentReposWithTagsAndBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].branch = 'master';
                            });
                            updateParentRepos.test_2.tag = 'custom/22.4.0-A-2';
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos })];
                        });
                    }); };
                    assertCloningTheParentReposTagsAndBranches = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        var repoFolder, tagDescription;
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            repoFolder = path.resolve(testResult, '..', 'main');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^version\/22.4.0-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            repoFolder = path.resolve(testResult, '..', 'test_1');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^version\/22.4.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            repoFolder = path.resolve(testResult, '..', 'test_2');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^custom\/22.4.0-A-2-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.4')
                            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('J) A customer branch with useSnapshot is configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentReposWithTagsAndBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].branch = 'master';
                            });
                            updateParentRepos.test_2.branch = 'customer/22.4-A-2';
                            updateParentRepos.test_2.useSnapshot = true;
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos }, 0)];
                        });
                    }); };
                    assertCloningTheParentReposTagsAndBranches = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        var repoFolder, tagDescription;
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            repoFolder = path.resolve(testResult, '..', 'main');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^version\/22.4.0-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            repoFolder = path.resolve(testResult, '..', 'test_1');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^version\/22.4.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            repoFolder = path.resolve(testResult, '..', 'test_2');
                            (0, remoteRepositories_1.assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch)(repoFolder, 'customer/22.4-A-2');
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.4')
                            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('K) A customer branch is configured', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testCloningTheParentReposWithTagsAndBranches = function (rootDir) { return __awaiter(void 0, void 0, void 0, function () {
                        var checkoutParentRepos, updateParentRepos;
                        return __generator(this, function (_a) {
                            checkoutParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            updateParentRepos = (0, remoteRepositories_1.catParentReposJson)(rootDir);
                            Object.keys(checkoutParentRepos).forEach(function (repo) {
                                checkoutParentRepos[repo].branch = 'master';
                            });
                            updateParentRepos.test_2.branch = 'customer/22.4-A-2';
                            return [2 /*return*/, testWithParentRepos(rootDir, { checkout: checkoutParentRepos, update: updateParentRepos }, 0)];
                        });
                    }); };
                    assertCloningTheParentReposTagsAndBranches = function (testResult) { return __awaiter(void 0, void 0, void 0, function () {
                        var repoFolder, tagDescription;
                        return __generator(this, function (_a) {
                            (0, remoteRepositories_1.assertAllFoldersArePresent)(testResult);
                            repoFolder = path.resolve(testResult, '..', 'main');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^version\/22.4.0-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            repoFolder = path.resolve(testResult, '..', 'test_1');
                            tagDescription = (0, remoteRepositories_1.gitDescribe)(repoFolder);
                            expect(/^version\/22.4.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();
                            repoFolder = path.resolve(testResult, '..', 'test_2');
                            (0, remoteRepositories_1.assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch)(repoFolder, 'customer/22.4-A-2');
                            return [2 /*return*/];
                        });
                    }); };
                    return [4 /*yield*/, (0, remoteRepositories_1.testWith)(remoteRepositories_1.multiBranchTestSetupData)
                            .withBranchUnderTest('release/22.4')
                            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
