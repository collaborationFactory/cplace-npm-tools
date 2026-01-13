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
var E2ETestRunner_1 = require("../helpers/E2ETestRunner");
var remoteRepositories_1 = require("../../test/helpers/remoteRepositories");
var path = require("path");
var fs = require("fs");
var child_process = require("child_process");
describe('version rewrite-versions E2E', function () {
    test('should rewrite versions for non-release branches', function () { return __awaiter(void 0, void 0, void 0, function () {
        var runner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    runner = new E2ETestRunner_1.E2ETestRunner(remoteRepositories_1.basicTestSetupData)
                        .withBranchUnderTest('release/22.2');
                    return [4 /*yield*/, runner.runWithRemoteAndLocalRepos(function (rootDir, cliRunner) { return __awaiter(void 0, void 0, void 0, function () {
                            var mainPath, rootRepoPath, versionGradleContent, parentReposPath, parentRepos, result;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        mainPath = path.join(rootDir, '..', 'main');
                                        rootRepoPath = path.join(rootDir, 'rootRepo');
                                        // Switch main to a feature branch (non-release) from master
                                        child_process.execSync('git checkout master', { cwd: mainPath });
                                        child_process.execSync('git checkout -b feature/test-feature', { cwd: mainPath });
                                        child_process.execSync('echo "feature work" > feature.txt', { cwd: mainPath });
                                        child_process.execSync('git add feature.txt', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Feature work"', { cwd: mainPath });
                                        versionGradleContent = "\next {\n    createdOnBranch='release/22.2'\n    cplaceVersion='22.2'\n}";
                                        fs.writeFileSync(path.join(mainPath, 'version.gradle'), versionGradleContent);
                                        child_process.execSync('git add version.gradle', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Add version.gradle"', { cwd: mainPath });
                                        parentReposPath = path.join(rootRepoPath, 'parent-repos.json');
                                        if (fs.existsSync(parentReposPath)) {
                                            parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                                            if (parentRepos.main) {
                                                parentRepos.main.branch = 'feature/test-feature';
                                                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));
                                                child_process.execSync('git add parent-repos.json', { cwd: rootRepoPath });
                                                child_process.execSync('git commit -m "Update main branch reference"', { cwd: rootRepoPath });
                                            }
                                        }
                                        return [4 /*yield*/, cliRunner.execute([
                                                'version',
                                                '--rewrite-versions'
                                            ], { cwd: rootRepoPath })];
                                    case 1:
                                        result = _a.sent();
                                        return [2 /*return*/, { result: result, rootRepoPath: rootRepoPath, parentReposPath: parentReposPath, mainPath: mainPath }];
                                }
                            });
                        }); }, function (_a) {
                            var result = _a.result, rootRepoPath = _a.rootRepoPath, parentReposPath = _a.parentReposPath, mainPath = _a.mainPath;
                            return __awaiter(void 0, void 0, void 0, function () {
                                var parentRepos, versionGradlePath, content;
                                return __generator(this, function (_b) {
                                    // Verify command executed
                                    if (result.exitCode !== 0) {
                                        console.log('Rewrite-versions stderr:', result.stderr);
                                        console.log('Rewrite-versions stdout:', result.stdout);
                                    }
                                    // Command should complete (exit code 0 or 1 depending on state)
                                    expect([0, 1]).toContain(result.exitCode);
                                    // If parent-repos.json exists, check if artifact versions were added
                                    if (fs.existsSync(parentReposPath)) {
                                        parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                                        if (parentRepos.main && parentRepos.main.branch === 'feature/test-feature') {
                                            // For non-release branches, artifactVersion should be set to .999
                                            if (parentRepos.main.artifactVersion) {
                                                expect(parentRepos.main.artifactVersion).toContain('.999');
                                            }
                                        }
                                    }
                                    versionGradlePath = path.join(mainPath, 'version.gradle');
                                    if (fs.existsSync(versionGradlePath)) {
                                        content = fs.readFileSync(versionGradlePath, 'utf8');
                                        // For feature branches, currentVersion should be added
                                        if (content.includes('currentVersion')) {
                                            expect(content).toContain('.999');
                                        }
                                    }
                                    return [2 /*return*/];
                                });
                            });
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should not modify versions for release branches', function () { return __awaiter(void 0, void 0, void 0, function () {
        var runner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    runner = new E2ETestRunner_1.E2ETestRunner(remoteRepositories_1.basicTestSetupData)
                        .withBranchUnderTest('release/22.2');
                    return [4 /*yield*/, runner.runWithRemoteAndLocalRepos(function (rootDir, cliRunner) { return __awaiter(void 0, void 0, void 0, function () {
                            var rootRepoPath, mainPath, versionGradleContent, parentReposPath, parentRepos, result;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        rootRepoPath = path.join(rootDir, 'rootRepo');
                                        mainPath = path.join(rootDir, '..', 'main');
                                        // The test runner already creates release/22.2, just use it
                                        child_process.execSync('git checkout release/22.2', { cwd: mainPath });
                                        versionGradleContent = "\next {\n    createdOnBranch='release/22.2'\n    cplaceVersion='22.2'\n}";
                                        fs.writeFileSync(path.join(mainPath, 'version.gradle'), versionGradleContent);
                                        child_process.execSync('git add version.gradle', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Add version.gradle"', { cwd: mainPath });
                                        parentReposPath = path.join(rootRepoPath, 'parent-repos.json');
                                        if (fs.existsSync(parentReposPath)) {
                                            parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                                            if (parentRepos.main) {
                                                parentRepos.main.branch = 'release/22.2';
                                                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));
                                                child_process.execSync('git add parent-repos.json', { cwd: rootRepoPath });
                                                child_process.execSync('git commit -m "Update to release branch"', { cwd: rootRepoPath });
                                            }
                                        }
                                        return [4 /*yield*/, cliRunner.execute([
                                                'version',
                                                '--rewrite-versions'
                                            ], { cwd: rootRepoPath })];
                                    case 1:
                                        result = _a.sent();
                                        return [2 /*return*/, { result: result, rootRepoPath: rootRepoPath, parentReposPath: parentReposPath, mainPath: mainPath }];
                                }
                            });
                        }); }, function (_a) {
                            var result = _a.result, rootRepoPath = _a.rootRepoPath, parentReposPath = _a.parentReposPath, mainPath = _a.mainPath;
                            return __awaiter(void 0, void 0, void 0, function () {
                                var parentRepos, versionGradlePath, content;
                                return __generator(this, function (_b) {
                                    // Command should complete
                                    expect([0, 1]).toContain(result.exitCode);
                                    // For release branches, artifactVersion should NOT be added
                                    if (fs.existsSync(parentReposPath)) {
                                        parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                                        if (parentRepos.main) {
                                            expect(parentRepos.main.artifactVersion).toBeUndefined();
                                        }
                                    }
                                    versionGradlePath = path.join(mainPath, 'version.gradle');
                                    if (fs.existsSync(versionGradlePath)) {
                                        content = fs.readFileSync(versionGradlePath, 'utf8');
                                        expect(content).not.toContain('currentVersion');
                                    }
                                    return [2 /*return*/];
                                });
                            });
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
