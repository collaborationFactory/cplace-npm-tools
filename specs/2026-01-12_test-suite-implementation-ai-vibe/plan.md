# Complete Test Suite Implementation for AI Vibe - Implementation Plan

## Overview

This plan implements a comprehensive 3-tier test suite (unit, integration, and E2E tests) for cplace-cli to enable AI-driven development. The focus is building E2E test infrastructure that executes the CLI binary in isolated git environments, completing missing integration tests, and establishing patterns for AI agents to confidently generate and test CLI commands.

## Current State Analysis

### Existing Strengths
- **70-75% integration test coverage** with 25 test files across commands
- **Excellent test infrastructure**: `test/helpers/remoteRepositories.ts` provides sophisticated multi-repo test framework with:
  - `testWith()` fluent API for test setup
  - `evaluateWithRemoteRepos()` and `evaluateWithRemoteAndLocalRepos()` for environment management
  - Pre-built test data: `basicTestSetupData`, `multiBranchTestSetupData`
  - Automatic cleanup via `withTempDirectory()`
- **Jest configuration**: 1000s timeout, TypeScript support, parallel execution ready
- **Proven git operations**: Uses native `child_process.execSync()` for reliability
- **Well-structured commands**: All implement `ICommand` interface with `prepareAndMayExecute()` and `execute()`

### Critical Gaps
1. **Zero E2E tests**: No tests invoke the CLI binary - all call classes directly
2. **Missing integration tests**:
   - `repos --branch` (BranchRepos)
   - `repos --merge-skeleton` (MergeSkeleton)
   - `repos --migrate-artifact-groups` (MigrateArtifactGroup)
   - `flow --split-repository` (SplitRepository)
   - `visualize` command (no tests at all)
   - Partial coverage for `release-notes` command
3. **No CLI execution layer**: No infrastructure to spawn and validate `cplace-cli` process
4. **Missing execa dependency**: Design calls for `execa` library which is not yet a dependency

### What Exists Now
- CLI binary: `dist/cli.js` (built via `npm run prepare`)
- Commands registered in: `src/commands/CommandRunner.ts`
- Integration test pattern: `test/repos/CloneRepos.test.ts:1`
- Test helpers: `test/helpers/remoteRepositories.ts:1`, `test/helpers/directories.ts:1`
- Build commands: `npm run dev:tsc`, `npm run prepare`

## Desired End State

### Success Verification

After implementation is complete, verify the end state by:

1. **E2E Infrastructure Works**:
   ```bash
   # Run a single E2E test to verify infrastructure
   npm run test:e2e -- e2e-tests/repos/clone.e2e.ts
   ```
   Expected: Test passes, CLI binary is spawned, output validated

2. **All repos E2E Tests Pass**:
   ```bash
   # Run all repos E2E tests
   npm run test:e2e -- e2e-tests/repos/
   ```
   Expected: 9 test files pass covering all repos subcommands

3. **Integration Tests Complete**:
   ```bash
   # Run repos integration tests
   npm test -- test/repos/
   ```
   Expected: All repos subcommands have integration test coverage (9/9)

4. **CI/CD Pipeline Works**:
   - Check GitHub Actions: Integration tests run in one job, E2E tests in another
   - Both jobs must pass for PR merge
   - Test results are reported clearly

5. **Documentation Exists**:
   - `docs/test-writing-guide.md` exists with E2E patterns
   - Examples show how to write tests for new commands

### Key Discoveries

From codebase research:

- **Test helpers are 90% reusable**: `remoteRepositories.ts:8` provides `testWith()` fluent API that can be wrapped for E2E
- **Commands use consistent pattern**: All implement `ICommand` interface (`src/commands/models.ts:5`)
- **CLI invocation is straightforward**: Binary at `dist/cli.js:1` with shebang, invoked as `node dist/cli.js`
- **Integration tests use real git**: No mocking in `test/repos/CloneRepos.test.ts:1`, all git operations via `child_process.execSync()`
- **Jest already configured for long tests**: `jest.config.js:14` has 1000s timeout for git operations
- **Build process is simple**: `package.json:13` shows `npm run prepare` → `clean && dev` → builds to `dist/`
- **No subprocess libraries exist**: Codebase uses native `child_process`, so `execa` needs to be added

## What We're NOT Doing

Explicitly out of scope to prevent scope creep:

- **NOT testing deprecated commands**: `refactor` and `e2e` commands are being deprecated
- **NOT replacing integration tests**: Both integration and E2E tests coexist with different purposes
- **NOT using fixture files**: Initial implementation uses programmatic test data generation
- **NOT building custom subprocess wrapper**: Using proven `execa` library instead
- **NOT testing private/internal methods**: E2E tests are black-box only
- **NOT implementing performance benchmarking**: Tests validate correctness, not performance
- **NOT adding cross-platform testing initially**: Focus on Unix-like systems first
- **NOT creating visual regression testing**: CLI output validation is text-based only
- **NOT modifying command implementations**: Only adding tests, not changing functionality
- **NOT testing all edge cases in E2E**: Critical edge cases go in integration tests, E2E covers happy paths and key error scenarios

## Implementation Approach

### High-Level Strategy

1. **Leverage existing infrastructure**: Build E2E layer on top of proven `remoteRepositories.ts` helpers
2. **Follow existing patterns**: E2E tests mirror integration test structure but invoke CLI binary
3. **Command-by-command approach**: Complete infrastructure + repos (highest priority) first, then expand
4. **Fluent API for consistency**: E2ETestRunner uses similar API to existing `testWith()` pattern
5. **Real git operations**: No mocking in E2E tests - validate actual CLI behavior
6. **Hybrid isolation**: Share remotes for read-only commands, isolate for write commands (performance optimization)

### Technology Choices

- **Test framework**: Jest (existing)
- **CLI execution**: `execa` v8.x (add as devDependency)
- **Git operations**: Native git via `child_process.execSync()` (existing pattern)
- **Test data**: Programmatic generation using existing `basicTestSetupData` pattern
- **Directory management**: Existing `withTempDirectory()` helper

---

## Phase 1: E2E Infrastructure Foundation + repos Command E2E Tests

### Overview

Build reusable E2E test framework and complete E2E coverage for the highest-priority command (repos - 9 subcommands). This phase thoroughly validates infrastructure with the most complex command before scaling to others.

### Changes Required

#### 1. Add execa Dependency

**File**: `package.json`

**Changes**: Add `execa` to devDependencies

```json
"devDependencies": {
  "@eslint/create-config": "^0.4.2",
  "@types/jest": "^29.5.12",
  "@types/node": "~18.11.0",
  "execa": "^8.0.1",
  // ... existing dependencies
}
```

#### 2. Create E2E Test Directory Structure

**Changes**: Create new directory structure

```bash
mkdir -p e2e-tests/helpers
mkdir -p e2e-tests/repos
```

#### 3. Implement CLI Execution Helper

**File**: `e2e-tests/helpers/cliRunner.ts`

**Changes**: Create new file with CLI execution utilities

```typescript
import {execa, ExecaReturnValue} from 'execa';
import * as path from 'path';
import * as fs from 'fs';

export interface ICliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
}

export class CliRunner {
    private readonly binaryPath: string;

    constructor() {
        // Resolve binary path from project root
        const projectRoot = path.resolve(__dirname, '../..');
        this.binaryPath = path.join(projectRoot, 'dist', 'cli.js');

        // Validate binary exists
        if (!fs.existsSync(this.binaryPath)) {
            throw new Error(
                `CLI binary not found at ${this.binaryPath}. ` +
                `Run 'npm run prepare' to build the CLI first.`
            );
        }
    }

    /**
     * Execute cplace-cli command with arguments
     * @param args - Command arguments (e.g., ['repos', '--clone'])
     * @param options - Execution options (cwd, env, etc.)
     */
    public async execute(
        args: string[],
        options: {
            cwd?: string;
            env?: NodeJS.ProcessEnv;
            timeout?: number;
        } = {}
    ): Promise<ICliResult> {
        const command = `node ${this.binaryPath} ${args.join(' ')}`;

        try {
            const result: ExecaReturnValue = await execa('node', [this.binaryPath, ...args], {
                cwd: options.cwd || process.cwd(),
                env: {...process.env, ...options.env},
                timeout: options.timeout || 120000, // 2 minutes default
                reject: false, // Don't throw on non-zero exit
                all: true // Combine stdout and stderr
            });

            return {
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                exitCode: result.exitCode || 0,
                command
            };
        } catch (error) {
            // Should rarely happen with reject: false
            throw new Error(`Failed to execute CLI: ${error.message}`);
        }
    }

    /**
     * Assert command succeeded (exit code 0)
     */
    public assertSuccess(result: ICliResult): void {
        if (result.exitCode !== 0) {
            throw new Error(
                `Expected command to succeed but got exit code ${result.exitCode}\n` +
                `Command: ${result.command}\n` +
                `Stdout: ${result.stdout}\n` +
                `Stderr: ${result.stderr}`
            );
        }
    }

    /**
     * Assert command failed (non-zero exit code)
     */
    public assertFailure(result: ICliResult, expectedError?: string): void {
        if (result.exitCode === 0) {
            throw new Error(
                `Expected command to fail but got exit code 0\n` +
                `Command: ${result.command}\n` +
                `Stdout: ${result.stdout}`
            );
        }

        if (expectedError) {
            const output = result.stdout + result.stderr;
            if (!output.includes(expectedError)) {
                throw new Error(
                    `Expected error message containing "${expectedError}" but got:\n` +
                    `Stdout: ${result.stdout}\n` +
                    `Stderr: ${result.stderr}`
                );
            }
        }
    }

    /**
     * Assert output contains expected text
     */
    public assertOutputContains(result: ICliResult, expectedText: string): void {
        const output = result.stdout + result.stderr;
        if (!output.includes(expectedText)) {
            throw new Error(
                `Expected output to contain "${expectedText}" but got:\n` +
                `Stdout: ${result.stdout}\n` +
                `Stderr: ${result.stderr}`
            );
        }
    }
}
```

#### 4. Implement E2E Assertion Utilities

**File**: `e2e-tests/helpers/assertions.ts`

**Changes**: Create new file with E2E-specific assertions

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

/**
 * Assert file exists at path
 */
export function assertFileExists(filePath: string): void {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Expected file to exist at ${filePath}`);
    }
}

/**
 * Assert file contains expected content
 */
export function assertFileContains(filePath: string, expectedContent: string): void {
    assertFileExists(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(expectedContent)) {
        throw new Error(
            `Expected file ${filePath} to contain "${expectedContent}" but got:\n${content}`
        );
    }
}

/**
 * Assert JSON file equals expected object
 */
export function assertJsonFileEquals(filePath: string, expected: any): void {
    assertFileExists(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const actual = JSON.parse(content);
    expect(actual).toEqual(expected);
}

/**
 * Assert git repository is on expected branch
 */
export function assertGitBranch(repoDir: string, expectedBranch: string): void {
    const result = child_process.execSync('git branch --show-current', {
        cwd: repoDir,
        encoding: 'utf8'
    });
    const actualBranch = result.trim();
    if (actualBranch !== expectedBranch) {
        throw new Error(
            `Expected repo at ${repoDir} to be on branch "${expectedBranch}" ` +
            `but was on "${actualBranch}"`
        );
    }
}

/**
 * Assert git repository has expected tag
 */
export function assertGitTag(repoDir: string, expectedTag: string): void {
    try {
        const result = child_process.execSync(`git tag -l "${expectedTag}"`, {
            cwd: repoDir,
            encoding: 'utf8'
        });
        if (!result.trim()) {
            throw new Error(`Tag "${expectedTag}" not found in repo at ${repoDir}`);
        }
    } catch (error) {
        throw new Error(`Failed to check tag in ${repoDir}: ${error.message}`);
    }
}

/**
 * Assert git repository is checked out to tag
 */
export function assertGitCheckedOutToTag(repoDir: string, expectedTag: string): void {
    try {
        const result = child_process.execSync('git describe --exact-match --tags', {
            cwd: repoDir,
            encoding: 'utf8'
        });
        const actualTag = result.trim();
        if (actualTag !== expectedTag) {
            throw new Error(
                `Expected repo at ${repoDir} to be checked out to tag "${expectedTag}" ` +
                `but was at "${actualTag}"`
            );
        }
    } catch (error) {
        throw new Error(
            `Expected repo at ${repoDir} to be checked out to tag "${expectedTag}" ` +
            `but git describe failed: ${error.message}`
        );
    }
}

/**
 * Assert directory exists
 */
export function assertDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Expected directory to exist at ${dirPath}`);
    }
    if (!fs.statSync(dirPath).isDirectory()) {
        throw new Error(`Expected ${dirPath} to be a directory but it's a file`);
    }
}
```

#### 5. Implement E2ETestRunner

**File**: `e2e-tests/helpers/E2ETestRunner.ts`

**Changes**: Create new file with E2E test runner class

```typescript
import {CliRunner, ICliResult} from './cliRunner';
import {ITestSetupData, testWith, ILocalRepoData} from '../../test/helpers/remoteRepositories';

/**
 * E2E test runner that wraps existing test helpers with CLI execution layer
 */
export class E2ETestRunner {
    private readonly cliRunner: CliRunner;
    private readonly testSetupData: ITestSetupData;
    private branchUnderTest: string = 'master';
    private readonly branchesToCheckout: string[] = [];
    private debug: boolean = false;

    constructor(testSetupData: ITestSetupData) {
        this.cliRunner = new CliRunner();
        this.testSetupData = testSetupData;
    }

    /**
     * Set the branch to test
     */
    public withBranchUnderTest(branch: string): E2ETestRunner {
        this.branchUnderTest = branch;
        return this;
    }

    /**
     * Set additional branches to checkout
     */
    public withBranchesToCheckout(branches: string[]): E2ETestRunner {
        this.branchesToCheckout.push(...branches);
        return this;
    }

    /**
     * Enable debug logging
     */
    public withDebug(debug: boolean): E2ETestRunner {
        this.debug = debug;
        return this;
    }

    /**
     * Run E2E test with remote repos only (read-only commands)
     */
    public async runWithRemoteRepos<T>(
        testCase: (rootDir: string, cliRunner: CliRunner, remoteRepos?: ILocalRepoData[]) => Promise<T>,
        assertion: (testResult: T) => Promise<void>
    ): Promise<void> {
        const testRunner = testWith(this.testSetupData)
            .withBranchUnderTest(this.branchUnderTest)
            .withBranchesToCheckout(this.branchesToCheckout)
            .withDebug(this.debug);

        return testRunner.evaluateWithRemoteRepos(
            async (rootDir: string, remoteRepos?: ILocalRepoData[]) => {
                return await testCase(rootDir, this.cliRunner, remoteRepos);
            },
            assertion
        );
    }

    /**
     * Run E2E test with remote and local repos (write commands)
     */
    public async runWithRemoteAndLocalRepos<T>(
        testCase: (rootDir: string, cliRunner: CliRunner) => Promise<T>,
        assertion: (testResult: T) => Promise<void>
    ): Promise<void> {
        const testRunner = testWith(this.testSetupData)
            .withBranchUnderTest(this.branchUnderTest)
            .withBranchesToCheckout(this.branchesToCheckout)
            .withDebug(this.debug);

        return testRunner.evaluateWithRemoteAndLocalRepos(
            async (rootDir: string) => {
                return await testCase(rootDir, this.cliRunner);
            },
            assertion
        );
    }

    /**
     * Execute CLI command in working directory
     */
    public async executeCli(
        args: string[],
        rootDir: string,
        options: {env?: NodeJS.ProcessEnv; timeout?: number} = {}
    ): Promise<ICliResult> {
        return await this.cliRunner.execute(args, {
            cwd: rootDir,
            ...options
        });
    }
}
```

#### 6. Create First E2E Test: repos --clone

**File**: `e2e-tests/repos/clone.e2e.ts`

**Changes**: Create new file with E2E test for repos --clone

```typescript
import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData, multiBranchTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertFileExists, assertDirectoryExists, assertGitTag} from '../helpers/assertions';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';

describe('repos --clone E2E', () => {
    test('should clone parent repositories with basic setup', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner, remoteRepos) => {
                // Execute: cplace-cli repos --clone
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Parent repos were cloned
                assertDirectoryExists(path.join(rootDir, '..', 'main'));
                assertDirectoryExists(path.join(rootDir, '..', 'test_1'));
                assertDirectoryExists(path.join(rootDir, '..', 'test_2'));

                // Assert: Output contains success messages
                expect(result.stdout).toContain('main');
                expect(result.stdout).toContain('test_1');
                expect(result.stdout).toContain('test_2');
            }
        );
    });

    test('should clone to specific tags when configured', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner, remoteRepos) => {
                // Modify parent-repos.json to specify tags
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(require('fs').readFileSync(parentReposPath, 'utf8'));

                Object.keys(parentRepos).forEach(repo => {
                    parentRepos[repo].tag = 'version/22.2.0';
                });

                require('fs').writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --clone
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });

                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Repos checked out to specified tags
                assertGitTag(path.join(rootDir, '..', 'main'), 'version/22.2.0');
                assertGitTag(path.join(rootDir, '..', 'test_1'), 'version/22.2.0');
                assertGitTag(path.join(rootDir, '..', 'test_2'), 'version/22.2.0');
            }
        );
    });

    test('should fail gracefully when tag does not exist', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner, remoteRepos) => {
                // Modify parent-repos.json with non-existent tag
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(require('fs').readFileSync(parentReposPath, 'utf8'));

                parentRepos.main.tag = 'version/99.99.99'; // Non-existent tag

                require('fs').writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --clone
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });

                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command failed
                expect(result.exitCode).not.toBe(0);

                // Assert: Error message mentions the tag
                const output = result.stdout + result.stderr;
                expect(output).toContain('version/99.99.99');
            }
        );
    });
});
```

#### 7. Create Remaining repos E2E Tests

**Files**:
- `e2e-tests/repos/update.e2e.ts`
- `e2e-tests/repos/write.e2e.ts`
- `e2e-tests/repos/branch.e2e.ts`
- `e2e-tests/repos/add-dependency.e2e.ts`
- `e2e-tests/repos/merge-skeleton.e2e.ts`
- `e2e-tests/repos/migrate-artifact-groups.e2e.ts`
- `e2e-tests/repos/validate-branches.e2e.ts`
- `e2e-tests/repos/workflows.e2e.ts`

**Changes**: Follow the same pattern as `clone.e2e.ts`, creating comprehensive E2E tests for each repos subcommand. Each test file should:
- Use `E2ETestRunner` for setup
- Use appropriate isolation strategy (remote-only for read commands, remote+local for write commands)
- Test happy path scenarios
- Test key error scenarios
- Validate CLI output and exit codes
- Verify git state changes

#### 8. Update Jest Configuration for E2E Tests

**File**: `jest.config.js`

**Changes**: Add E2E test pattern support

```javascript
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test', '<rootDir>/e2e-tests'],
    moduleDirectories: ['node_modules', 'src', 'test', 'e2e-tests'],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
        '^.+\\.(js)$': 'babel-jest',
    },
    testRegex: '(/__tests__/.*|\\.(test|spec|e2e))\\.ts?$',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    testTimeout: 1000000, // 1000 seconds
    verbose: true,
};
```

#### 9. Add E2E Test Scripts

**File**: `package.json`

**Changes**: Add scripts for running E2E tests

```json
"scripts": {
  "test": "jest --testPathIgnorePatterns=e2e-tests",
  "test:e2e": "npm run prepare && jest --testMatch='**/e2e-tests/**/*.e2e.ts'",
  "test:all": "npm test && npm run test:e2e",
  "dev:tsc": "tsc && chmod -R +x ./dist",
  "dev:lint": "eslint \"**/*.ts\"",
  "dev": "npm run dev:lint && npm run dev:tsc",
  "clean": "rimraf dist/ *.tgz",
  "prepare": "npm run clean && npm run dev",
  "link": "npm run prepare && npm link"
}
```

### Success Criteria

#### Automated Verification:
- [ ] Install execa: `npm install --save-dev execa@^8.0.1`
- [ ] E2E directory structure exists: `ls e2e-tests/helpers/ e2e-tests/repos/`
- [ ] Build succeeds: `npm run prepare`
- [ ] Single E2E test passes: `npm run test:e2e -- e2e-tests/repos/clone.e2e.ts`
- [ ] All repos E2E tests pass: `npm run test:e2e -- e2e-tests/repos/`
- [ ] Integration tests still pass: `npm test -- test/repos/`
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Linting passes: `npm run dev:lint`

#### Manual Verification:
- [ ] E2E test output is readable and shows CLI command execution
- [ ] Test failures provide clear error messages with stdout/stderr
- [ ] Tests complete in reasonable time (<10 minutes for all repos E2E tests)
- [ ] Debug mode (`withDebug(true)`) provides useful troubleshooting output

---

## Phase 2: Missing Integration Tests for repos Command

### Overview

Fill the integration test gaps for 3 repos subcommands that currently have no tests. These integration tests validate business logic and edge cases before E2E tests validate the CLI interface.

### Changes Required

#### 1. BranchRepos Integration Tests

**File**: `test/repos/BranchRepos.test.ts`

**Changes**: Create new file with integration tests

```typescript
import {ICommandParameters} from '../../src/commands/models';
import {BranchRepos} from '../../src/commands/repos/BranchRepos';
import {basicTestSetupData, testWith, catParentReposJson} from '../helpers/remoteRepositories';
import * as path from 'path';
import * as child_process from 'child_process';

describe('BranchRepos', () => {
    test('should create branch across all repos', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {
                        branch: 'feature/new-feature'
                    };

                    const cmd = new BranchRepos();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: Branch created in all repos
                    const repos = ['main', 'test_1', 'test_2'];
                    for (const repo of repos) {
                        const repoPath = path.join(rootDir, '..', repo);
                        const branches = child_process.execSync('git branch --list feature/new-feature', {
                            cwd: repoPath,
                            encoding: 'utf8'
                        });
                        expect(branches).toContain('feature/new-feature');
                    }
                }
            );
    });

    test('should update parent-repos.json with new branch', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {
                        branch: 'feature/new-feature'
                    };

                    const cmd = new BranchRepos();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: parent-repos.json updated
                    const parentRepos = catParentReposJson(rootDir);
                    Object.values(parentRepos).forEach(repo => {
                        expect(repo.branch).toBe('feature/new-feature');
                    });
                }
            );
    });

    test('should create branch from specific source branch', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {
                        branch: 'feature/new-feature',
                        from: 'release/22.2'
                    };

                    const cmd = new BranchRepos();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: New branch exists and is based on source branch
                    const repoPath = path.join(rootDir, '..', 'main');
                    const mergeBase = child_process.execSync(
                        'git merge-base feature/new-feature release/22.2',
                        {cwd: repoPath, encoding: 'utf8'}
                    ).trim();

                    const sourceSha = child_process.execSync(
                        'git rev-parse release/22.2',
                        {cwd: repoPath, encoding: 'utf8'}
                    ).trim();

                    expect(mergeBase).toBe(sourceSha);
                }
            );
    });
});
```

#### 2. MergeSkeleton Integration Tests

**File**: `test/repos/MergeSkeleton.test.ts`

**Changes**: Create new file with integration tests

```typescript
import {ICommandParameters} from '../../src/commands/models';
import {MergeSkeleton} from '../../src/commands/repos/MergeSkeleton';
import {basicTestSetupData, testWith} from '../helpers/remoteRepositories';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('MergeSkeleton', () => {
    test('should detect and merge skeleton branch automatically', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    // Create skeleton branch in remote
                    const mainPath = path.join(rootDir, '..', 'main');
                    child_process.execSync('git checkout -b skeleton/22.2', {cwd: mainPath});
                    fs.writeFileSync(path.join(mainPath, 'skeleton.txt'), 'skeleton content');
                    child_process.execSync('git add . && git commit -m "skeleton"', {cwd: mainPath});
                    child_process.execSync('git push origin skeleton/22.2', {cwd: mainPath});
                    child_process.execSync('git checkout release/22.2', {cwd: mainPath});

                    const params: ICommandParameters = {};
                    const cmd = new MergeSkeleton();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return mainPath;
                },
                async (mainPath: string) => {
                    // Assert: Skeleton branch merged
                    const log = child_process.execSync('git log --oneline -5', {
                        cwd: mainPath,
                        encoding: 'utf8'
                    });
                    expect(log).toContain('skeleton');
                }
            );
    });

    test('should handle merge conflicts with --ours strategy', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    // Create conflicting changes
                    const mainPath = path.join(rootDir, '..', 'main');

                    // Create skeleton branch with conflict
                    child_process.execSync('git checkout -b skeleton/22.2', {cwd: mainPath});
                    fs.writeFileSync(path.join(mainPath, 'conflict.txt'), 'skeleton version');
                    child_process.execSync('git add . && git commit -m "skeleton"', {cwd: mainPath});
                    child_process.execSync('git push origin skeleton/22.2', {cwd: mainPath});

                    // Create conflicting change on release branch
                    child_process.execSync('git checkout release/22.2', {cwd: mainPath});
                    fs.writeFileSync(path.join(mainPath, 'conflict.txt'), 'release version');
                    child_process.execSync('git add . && git commit -m "release"', {cwd: mainPath});

                    const params: ICommandParameters = {
                        ours: true
                    };
                    const cmd = new MergeSkeleton();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return mainPath;
                },
                async (mainPath: string) => {
                    // Assert: Merge completed with ours strategy
                    const content = fs.readFileSync(path.join(mainPath, 'conflict.txt'), 'utf8');
                    expect(content).toBe('release version');
                }
            );
    });
});
```

#### 3. MigrateArtifactGroup Integration Tests

**File**: `test/repos/MigrateArtifactGroup.test.ts`

**Changes**: Create new file with integration tests

```typescript
import {ICommandParameters} from '../../src/commands/models';
import {MigrateArtifactGroup} from '../../src/commands/repos/MigrateArtifactGroup';
import {basicTestSetupData, testWith, catParentReposJson} from '../helpers/remoteRepositories';
import * as path from 'path';
import * as fs from 'fs';

describe('MigrateArtifactGroup', () => {
    test('should parse cplaceRepositories block from build.gradle', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    // Create build.gradle with cplaceRepositories block
                    const buildGradle = `
                        cplaceRepositories {
                            repository('main') {
                                url = 'git@github.com:example/main.git'
                                artifactGroup = 'com.example.main'
                                useSnapshots = true
                            }
                        }
                    `;
                    fs.writeFileSync(path.join(rootDir, 'build.gradle'), buildGradle);

                    const params: ICommandParameters = {};
                    const cmd = new MigrateArtifactGroup();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: parent-repos.json updated with artifactGroup
                    const parentRepos = catParentReposJson(rootDir);
                    expect(parentRepos.main.artifactGroup).toBe('com.example.main');
                    expect(parentRepos.main.useSnapshots).toBe(true);
                }
            );
    });

    test('should clean up build.gradle after migration', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const buildGradle = `
                        cplaceRepositories {
                            repository('main') {
                                artifactGroup = 'com.example.main'
                            }
                        }
                    `;
                    fs.writeFileSync(path.join(rootDir, 'build.gradle'), buildGradle);

                    const params: ICommandParameters = {};
                    const cmd = new MigrateArtifactGroup();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: cplaceRepositories block removed
                    const buildGradle = fs.readFileSync(path.join(rootDir, 'build.gradle'), 'utf8');
                    expect(buildGradle).not.toContain('cplaceRepositories');
                }
            );
    });
});
```

### Success Criteria

#### Automated Verification:
- [ ] BranchRepos tests pass: `npm test -- test/repos/BranchRepos.test.ts`
- [ ] MergeSkeleton tests pass: `npm test -- test/repos/MergeSkeleton.test.ts`
- [ ] MigrateArtifactGroup tests pass: `npm test -- test/repos/MigrateArtifactGroup.test.ts`
- [ ] All repos integration tests pass: `npm test -- test/repos/`
- [ ] No regressions in other tests: `npm test`
- [ ] Type checking passes: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Test output is clear and helpful for debugging
- [ ] Each test covers both happy path and error scenarios
- [ ] Tests execute in reasonable time (<5 minutes total for 3 new files)

---

## Phase 3: release-notes Command Tests

### Overview

Complete test coverage for release-notes command (3 subcommands). Add missing integration tests and create comprehensive E2E tests.

### Changes Required

#### 1. Enhanced Integration Tests

**File**: `test/release-notes/GenerateReleaseNotes.test.ts`

**Changes**: Extend existing tests to cover full generation workflow

```typescript
// Add comprehensive tests for:
// - Full release note generation from git log
// - Multi-language support (EN, DE, FR)
// - Message database lookup and formatting
// - Output file generation
```

**File**: `test/release-notes/MergeReleaseNotes.test.ts` (NEW)

**Changes**: Create integration tests for merge functionality

```typescript
// Test three-way merge algorithm:
// - Merge two message databases
// - Handle conflicts
// - Preserve unique entries
```

**File**: `test/release-notes/CheckMessages.test.ts` (NEW)

**Changes**: Create integration tests for validation

```typescript
// Test validation logic:
// - Check for missing translations
// - Validate message format
// - Report incomplete entries
```

#### 2. E2E Tests for release-notes

**File**: `e2e-tests/release-notes/generate.e2e.ts`

**Changes**: Create E2E test for generation

```typescript
// Test: cplace-cli release-notes (default generate)
// - Execute in repo with commits
// - Validate output file created
// - Check format and content
```

**File**: `e2e-tests/release-notes/merge.e2e.ts`

**Changes**: Create E2E test for merge

```typescript
// Test: cplace-cli release-notes --merge
// - Provide two database files
// - Execute merge
// - Validate merged output
```

**File**: `e2e-tests/release-notes/check.e2e.ts`

**Changes**: Create E2E test for check

```typescript
// Test: cplace-cli release-notes --check
// - Provide incomplete database
// - Execute check
// - Validate error reporting
```

### Success Criteria

#### Automated Verification:
- [ ] Integration tests pass: `npm test -- test/release-notes/`
- [ ] E2E tests pass: `npm run test:e2e -- e2e-tests/release-notes/`
- [ ] All tests pass: `npm run test:all`

#### Manual Verification:
- [ ] Generated release notes are properly formatted
- [ ] Merge handles conflicts appropriately
- [ ] Check reports missing translations clearly

---

## Phase 4: flow, visualize, and version Commands

### Overview

Complete remaining E2E test coverage for flow, visualize, and version commands.

### Changes Required

#### 1. flow Command Tests

**File**: `test/flow/SplitRepository.test.ts` (NEW)

**Changes**: Create integration tests for split-repository

```typescript
// Test repository splitting logic:
// - Split directories to new repo
// - Preserve git history
// - Update dependencies
```

**File**: `e2e-tests/flow/upmerge.e2e.ts`

**Changes**: Create E2E test for upmerge

```typescript
// Test: cplace-cli flow --upmerge
// - Setup multi-branch repo
// - Execute upmerge
// - Validate merge results
```

**File**: `e2e-tests/flow/split-repository.e2e.ts`

**Changes**: Create E2E test for split-repository

```typescript
// Test: cplace-cli flow --split-repository
// - Execute split
// - Validate new repo created
```

#### 2. visualize Command Tests

**File**: `test/visualize/VisualizeCommand.test.ts` (NEW)

**Changes**: Create unit tests for graph algorithms

```typescript
// Test graph generation:
// - Dependency resolution
// - Graph reduction
// - Output formatting
```

**File**: `test/visualize/VisualizeCommand.integration.test.ts` (NEW)

**Changes**: Create integration tests with real repos

```typescript
// Test with actual repo structure:
// - Multi-branch dependencies
// - Complex graph scenarios
```

**File**: `e2e-tests/visualize/visualize.e2e.ts`

**Changes**: Create E2E test

```typescript
// Test: cplace-cli visualize
// - Execute visualization
// - Validate output file
```

#### 3. version Command Tests

**File**: `e2e-tests/version/rewrite-versions.e2e.ts`

**Changes**: Create E2E test

```typescript
// Test: cplace-cli version --rewrite-versions
// - Execute version rewrite
// - Validate changes
```

### Success Criteria

#### Automated Verification:
- [ ] flow integration tests pass: `npm test -- test/flow/`
- [ ] flow E2E tests pass: `npm run test:e2e -- e2e-tests/flow/`
- [ ] visualize tests pass: `npm test -- test/visualize/` && `npm run test:e2e -- e2e-tests/visualize/`
- [ ] version E2E test passes: `npm run test:e2e -- e2e-tests/version/`
- [ ] All tests pass: `npm run test:all`

#### Manual Verification:
- [ ] All commands execute successfully via CLI
- [ ] Output is formatted correctly
- [ ] Error messages are helpful

---

## Phase 5: CI/CD Integration & Documentation

### Overview

Enable automated testing in GitHub Actions and document test writing patterns for future development and AI agent usage.

### Changes Required

#### 1. GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

**Changes**: Add separate jobs for integration and E2E tests

```yaml
name: Tests

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:e2e
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-test-results
          path: e2e-tests/**/*.xml
```

#### 2. Test Writing Guide

**File**: `docs/test-writing-guide.md` (NEW)

**Changes**: Create comprehensive documentation

```markdown
# Test Writing Guide

## Overview

This guide explains how to write integration and E2E tests for cplace-cli commands.

## Integration Tests

Integration tests call command classes directly and validate business logic.

### Pattern:
- Use `testWith()` helper from `remoteRepositories.ts`
- Call command class methods directly
- Assert on return values and side effects

### Example:
[Include complete example from CloneRepos.test.ts]

## E2E Tests

E2E tests invoke the CLI binary and validate end-to-end behavior.

### Pattern:
- Use `E2ETestRunner` helper
- Execute CLI via `cliRunner.execute()`
- Assert on exit codes, output, and file system state

### Example:
[Include complete example from clone.e2e.ts]

## Test Data

Use existing test data builders:
- `basicTestSetupData`: Simple single-branch setup
- `multiBranchTestSetupData`: Complex multi-branch setup

## Best Practices

1. Each test should be independent
2. Use descriptive test names
3. Clean assertions with clear error messages
4. Test both happy path and error scenarios
5. Keep tests focused and fast
```

#### 3. TypeScript Configuration for E2E Tests

**File**: `tsconfig.json`

**Changes**: Ensure E2E tests are included in compilation

```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/**/*",
    "test/**/*",
    "e2e-tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### Success Criteria

#### Automated Verification:
- [ ] GitHub Actions workflow exists: `ls .github/workflows/test.yml`
- [ ] Tests run in CI: Push commit and check GitHub Actions
- [ ] Both integration and E2E jobs pass in CI
- [ ] Test documentation exists: `ls docs/test-writing-guide.md`
- [ ] TypeScript compiles E2E tests: `npx tsc --noEmit`

#### Manual Verification:
- [ ] GitHub Actions UI shows clear test results
- [ ] Failed tests show helpful error messages in CI logs
- [ ] Documentation is clear and includes working examples
- [ ] New developers can write tests following the guide

---

## Testing Strategy

### Integration Tests
**Purpose**: Validate business logic, algorithms, and edge cases

**Characteristics**:
- Call command classes directly
- Mock external dependencies where beneficial
- Test internal state and error paths
- Fast execution (no CLI spawn overhead)
- Located in `test/` directory

**What to test**:
- Tag resolution logic (50+ scenarios)
- Branch creation algorithms
- File parsing and validation
- Error handling and edge cases
- Complex business rules

### E2E Tests
**Purpose**: Validate complete user experience

**Characteristics**:
- Invoke CLI binary as users would
- Real git operations (no mocking)
- Validate output, exit codes, and side effects
- Located in `e2e-tests/` directory

**What to test**:
- CLI parsing and help text
- End-to-end workflows
- Output formatting
- Error messages shown to users
- Integration between CLI layer and commands

### Test Isolation
- Each test creates fresh temp directory
- No shared state between tests
- Automatic cleanup after test execution
- Parallel execution safe

### Test Data Strategy
- Reuse existing builders: `basicTestSetupData`, `multiBranchTestSetupData`
- Programmatic generation (no fixture files initially)
- Type-safe and maintainable
- Easy to create variations

## Performance Considerations

### E2E Test Optimization
1. **Hybrid isolation strategy**: Share remote repos for read-only commands (significant speedup)
2. **Parallel execution**: Jest runs tests in parallel by default
3. **Shared remote setup**: Create bare repos once per test suite for read-only commands
4. **Reasonable timeouts**: 1000s default, adequate for git operations

### Expected Performance
- Single E2E test: ~5-10 seconds
- Full repos E2E suite (9 tests): <10 minutes
- All E2E tests: <15 minutes
- Integration tests: <5 minutes

### Performance Monitoring
- If tests become too slow, consider:
  - Reducing test data size
  - Increasing parallelization
  - Profiling slow operations
  - Caching expensive setup

## Migration Notes

### No Breaking Changes
- Existing integration tests continue to work unchanged
- New E2E infrastructure is additive only
- No modifications to command implementations
- Build process unchanged (except adding execa dependency)

### Gradual Rollout
- Phase 1 completes repos command fully before moving to others
- Each phase can be merged independently
- No all-or-nothing deployment risk

### Developer Experience
- New test script: `npm run test:e2e`
- Existing workflow unchanged: `npm test` runs integration tests only
- Full suite: `npm run test:all`
- CI/CD runs both test types in parallel

## References

- **Research**: [research.md](./research.md) - Original codebase analysis
- **Design**: [design.md](./design.md) - Architectural decisions and trade-offs
- **Existing patterns**:
  - Integration test example: `test/repos/CloneRepos.test.ts:1`
  - Test helpers: `test/helpers/remoteRepositories.ts:1`
  - Command interface: `src/commands/models.ts:5`
  - CLI entry point: `src/cli.ts:1`
- **External documentation**:
  - [Jest Documentation](https://jestjs.io/docs/getting-started)
  - [execa Documentation](https://github.com/sindresorhus/execa)
