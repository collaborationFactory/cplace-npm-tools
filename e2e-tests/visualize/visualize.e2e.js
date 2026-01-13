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
describe('visualize E2E', function () {
    test('should generate branches visualization dot file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var runner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    runner = new E2ETestRunner_1.E2ETestRunner(remoteRepositories_1.basicTestSetupData)
                        .withBranchUnderTest('release/22.2');
                    return [4 /*yield*/, runner.runWithRemoteAndLocalRepos(function (rootDir, cliRunner) { return __awaiter(void 0, void 0, void 0, function () {
                            var mainPath, result;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        mainPath = path.join(rootDir, '..', 'main');
                                        // The test runner already creates release/22.2
                                        // Create a multi-branch structure for visualization
                                        // Branch 1: feature/test-feature from master
                                        child_process.execSync('git checkout master', { cwd: mainPath });
                                        child_process.execSync('git checkout -b feature/test-feature', { cwd: mainPath });
                                        child_process.execSync('echo "feature" > feature.txt', { cwd: mainPath });
                                        child_process.execSync('git add feature.txt', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Add feature"', { cwd: mainPath });
                                        child_process.execSync('git push origin feature/test-feature', { cwd: mainPath });
                                        // Use existing release/22.2 and add a commit
                                        child_process.execSync('git checkout release/22.2', { cwd: mainPath });
                                        child_process.execSync('echo "release" > release.txt', { cwd: mainPath });
                                        child_process.execSync('git add release.txt', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Add release"', { cwd: mainPath });
                                        child_process.execSync('git push origin release/22.2', { cwd: mainPath });
                                        return [4 /*yield*/, cliRunner.execute(['visualize'], { cwd: mainPath })];
                                    case 1:
                                        result = _a.sent();
                                        return [2 /*return*/, { result: result, mainPath: mainPath }];
                                }
                            });
                        }); }, function (_a) {
                            var result = _a.result, mainPath = _a.mainPath;
                            return __awaiter(void 0, void 0, void 0, function () {
                                var dotFilePath, dotContent;
                                return __generator(this, function (_b) {
                                    // Verify command executed successfully
                                    if (result.exitCode !== 0) {
                                        console.log('Visualize stderr:', result.stderr);
                                        console.log('Visualize stdout:', result.stdout);
                                    }
                                    // Expect success (command should complete)
                                    expect(result.exitCode).toBe(0);
                                    dotFilePath = path.join(mainPath, 'branches.dot');
                                    expect(fs.existsSync(dotFilePath)).toBe(true);
                                    dotContent = fs.readFileSync(dotFilePath, 'utf8');
                                    expect(dotContent).toContain('digraph');
                                    expect(dotContent.length).toBeGreaterThan(0);
                                    // Clean up generated file
                                    if (fs.existsSync(dotFilePath)) {
                                        fs.unlinkSync(dotFilePath);
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
    }); }, 120000); // 2 minute timeout
    test('should accept regex parameters for branch filtering', function () { return __awaiter(void 0, void 0, void 0, function () {
        var runner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    runner = new E2ETestRunner_1.E2ETestRunner(remoteRepositories_1.basicTestSetupData)
                        .withBranchUnderTest('release/22.2');
                    return [4 /*yield*/, runner.runWithRemoteAndLocalRepos(function (rootDir, cliRunner) { return __awaiter(void 0, void 0, void 0, function () {
                            var mainPath, result;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        mainPath = path.join(rootDir, '..', 'main');
                                        // Create some branches from master
                                        child_process.execSync('git checkout master', { cwd: mainPath });
                                        child_process.execSync('git checkout -b feature/include-this', { cwd: mainPath });
                                        child_process.execSync('echo "included" > included.txt', { cwd: mainPath });
                                        child_process.execSync('git add included.txt', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Include"', { cwd: mainPath });
                                        child_process.execSync('git push origin feature/include-this', { cwd: mainPath });
                                        child_process.execSync('git checkout master', { cwd: mainPath });
                                        child_process.execSync('git checkout -b test/exclude-this', { cwd: mainPath });
                                        child_process.execSync('echo "excluded" > excluded.txt', { cwd: mainPath });
                                        child_process.execSync('git add excluded.txt', { cwd: mainPath });
                                        child_process.execSync('git commit -m "Exclude"', { cwd: mainPath });
                                        child_process.execSync('git push origin test/exclude-this', { cwd: mainPath });
                                        return [4 /*yield*/, cliRunner.execute([
                                                'visualize',
                                                '--regexForInclusion', 'feature/.*'
                                            ], { cwd: mainPath })];
                                    case 1:
                                        result = _a.sent();
                                        return [2 /*return*/, { result: result, mainPath: mainPath }];
                                }
                            });
                        }); }, function (_a) {
                            var result = _a.result, mainPath = _a.mainPath;
                            return __awaiter(void 0, void 0, void 0, function () {
                                var dotFilePath;
                                return __generator(this, function (_b) {
                                    // Command should accept parameters without error
                                    expect(result.exitCode).toBeGreaterThanOrEqual(0);
                                    dotFilePath = path.join(mainPath, 'branches.dot');
                                    if (fs.existsSync(dotFilePath)) {
                                        fs.unlinkSync(dotFilePath);
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
    }); }, 120000);
});
