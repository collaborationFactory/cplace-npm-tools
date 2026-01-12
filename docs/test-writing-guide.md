# Test Writing Guide for cplace-cli

## Overview

This guide explains how to write integration and E2E tests for cplace-cli commands. The test infrastructure supports both levels of testing with reusable helpers and clear patterns.

## Test Types

### Integration Tests

**Purpose**: Validate business logic, algorithms, and edge cases by calling command classes directly.

**Location**: `test/` directory

**Characteristics**:
- Call command classes directly (no CLI spawn overhead)
- Use real git operations (no mocking)
- Test internal state and error paths
- Fast execution
- Focus on business logic

### E2E Tests

**Purpose**: Validate complete user experience by invoking the CLI binary.

**Location**: `e2e-tests/` directory

**Characteristics**:
- Invoke CLI binary as users would
- Real git operations (no mocking)
- Validate output, exit codes, and side effects
- Test CLI parsing and help text
- Focus on end-to-end workflows

## Integration Test Pattern

### Basic Structure

```typescript
import {ICommandParameters} from '../../src/commands/models';
import {CommandName} from '../../src/commands/path/CommandName';
import {basicTestSetupData, testWith, catParentReposJson} from '../helpers/remoteRepositories';
import * as path from 'path';

describe('CommandName', () => {
    test('should perform expected action', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    // Setup
                    const params: ICommandParameters = {
                        paramName: 'value'
                    };

                    // Execute
                    const cmd = new CommandName();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert results
                    expect(/* your assertion */).toBe(/* expected */);
                }
            );
    });
});
```

### Test Data Builders

Use existing test data builders:
- `basicTestSetupData`: Simple single-branch setup (release/22.2)
- `multiBranchTestSetupData`: Complex multi-branch setup (5.20, 22.2, 22.3, 22.4)

### Evaluation Methods

**`evaluateWithRemoteRepos`**: Read-only commands (no local clones)
```typescript
await testWith(basicTestSetupData)
    .withBranchUnderTest('release/22.2')
    .evaluateWithRemoteRepos(
        async (rootDir: string, remoteRepos?: ILocalRepoData[]) => {
            // Test code
        },
        async (result) => {
            // Assertions
        }
    );
```

**`evaluateWithRemoteAndLocalRepos`**: Write commands (creates local clones)
```typescript
await testWith(basicTestSetupData)
    .withBranchUnderTest('release/22.2')
    .evaluateWithRemoteAndLocalRepos(
        async (rootDir: string) => {
            // Test code
        },
        async (rootDir: string) => {
            // Assertions
        }
    );
```

### Helper Functions

**`catParentReposJson(rootDir)`**: Read and parse parent-repos.json
```typescript
const parentRepos = catParentReposJson(rootDir);
expect(parentRepos.main.branch).toBe('release/22.2');
```

**`writeParentReposJson(rootDir, descriptor)`**: Write parent-repos.json
```typescript
writeParentReposJson(rootDir, {
    main: {branch: 'master', url: 'git@github.com:example/main.git'}
});
```

**`assertThatTheParentReposAreCheckedOutToTheExpectedTags`**: Verify tag checkout
```typescript
assertThatTheParentReposAreCheckedOutToTheExpectedTags(
    {main: 'version/22.2.0', test_1: 'version/22.2.0'},
    rootDir
);
```

### Example: Complete Integration Test

```typescript
import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {basicTestSetupData, testWith, assertAllFoldersArePresent} from '../helpers/remoteRepositories';

describe('CloneRepos', () => {
    test('should clone all parent repositories', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {};
                    const cmd = new CloneRepos();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();
                    return rootDir;
                },
                async (rootDir: string) => {
                    assertAllFoldersArePresent(rootDir);
                }
            );
    });
});
```

## E2E Test Pattern

### Basic Structure

```typescript
import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertDirectoryExists, assertGitBranch} from '../helpers/assertions';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';

describe('command-name E2E', () => {
    test('should perform expected action', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Execute CLI
                const result = await cliRunner.execute(['command', '--flag'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Output contains expected text
                expect(result.stdout).toContain('success');

                // Assert: File system changes
                assertDirectoryExists(path.join(rootDir, '..', 'main'));
            }
        );
    });
});
```

### E2ETestRunner Configuration

```typescript
const runner = new E2ETestRunner(basicTestSetupData)
    .withBranchUnderTest('release/22.2')           // Required: set branch
    .withBranchesToCheckout(['master', 'develop']) // Optional: additional branches
    .withDebug(true);                              // Optional: enable debug output
```

### Execution Methods

**`runWithRemoteRepos`**: Read-only commands
```typescript
await runner.runWithRemoteRepos(
    async (rootDir, cliRunner, remoteRepos) => {
        const result = await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});
        return {result, rootDir};
    },
    async ({result, rootDir}) => {
        expect(result.exitCode).toBe(0);
    }
);
```

**`runWithRemoteAndLocalRepos`**: Write commands
```typescript
await runner.runWithRemoteAndLocalRepos(
    async (rootDir, cliRunner) => {
        const result = await cliRunner.execute(['repos', '--branch', 'feature/test'], {
            cwd: rootDir
        });
        return {result, rootDir};
    },
    async ({result, rootDir}) => {
        expect(result.exitCode).toBe(0);
    }
);
```

### CLI Result Interface

```typescript
interface ICliResult {
    stdout: string;   // Standard output
    stderr: string;   // Standard error
    exitCode: number; // Exit code (0 = success)
    command: string;  // Full command executed
}
```

### Assertion Helpers

**File System Assertions**:
```typescript
assertFileExists(path.join(rootDir, 'file.txt'));
assertFileContains(path.join(rootDir, 'file.txt'), 'expected content');
assertDirectoryExists(path.join(rootDir, '..', 'main'));
assertJsonFileEquals(path.join(rootDir, 'config.json'), {key: 'value'});
```

**Git Assertions**:
```typescript
assertGitBranch(repoPath, 'release/22.2');
assertGitTag(repoPath, 'version/22.2.0');
assertGitCheckedOutToTag(repoPath, 'version/22.2.0');
```

### Example: Complete E2E Test

```typescript
import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertDirectoryExists} from '../helpers/assertions';
import * as path from 'path';

describe('repos --clone E2E', () => {
    test('should clone parent repositories', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner) => {
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                expect(result.exitCode).toBe(0);
                assertDirectoryExists(path.join(rootDir, '..', 'main'));
                assertDirectoryExists(path.join(rootDir, '..', 'test_1'));
                assertDirectoryExists(path.join(rootDir, '..', 'test_2'));
                expect(result.stdout).toContain('main');
            }
        );
    });
});
```

## Best Practices

### General Guidelines

1. **Each test should be independent**: No shared state between tests
2. **Use descriptive test names**: Clearly state what is being tested
3. **Clean assertions**: One concept per assertion with clear error messages
4. **Test both success and failure**: Happy path + error scenarios
5. **Keep tests focused**: Test one thing at a time

### Integration Tests

1. **Test business logic**: Focus on algorithms, state changes, edge cases
2. **Use real git operations**: Don't mock git - test with actual repositories
3. **Leverage test helpers**: Use `catParentReposJson`, `writeParentReposJson`, etc.
4. **Test parameter validation**: Include tests for invalid parameters
5. **Keep tests fast**: Integration tests should complete in seconds

### E2E Tests

1. **Test user workflows**: Focus on how users interact with the CLI
2. **Validate output format**: Check stdout/stderr content and formatting
3. **Test exit codes**: Ensure proper success (0) and failure (non-zero) codes
4. **Test error messages**: Verify user-friendly error messages
5. **Don't test every edge case**: Focus on critical paths and key errors

### What NOT to Test

Integration tests should NOT:
- Test private methods directly (test through public API)
- Mock git operations (use real git)
- Test CLI parsing (that's for E2E)

E2E tests should NOT:
- Test every edge case (use integration tests)
- Test internal implementation details
- Replace integration tests

## Running Tests

### Integration Tests

```bash
# Run all integration tests
npm test

# Run specific test file
npm test -- test/repos/CloneRepos.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should clone"
```

### E2E Tests

```bash
# Run all E2E tests (includes build)
npm run test:e2e

# Run specific E2E test file
npm run test:e2e -- e2e-tests/repos/clone.e2e.ts

# Run both integration and E2E tests
npm run test:all
```

### Build Commands

```bash
# Clean build
npm run prepare

# Just compile TypeScript
npm run dev:tsc

# Just run linter
npm run dev:lint

# Full development build (lint + compile)
npm run dev
```

## Troubleshooting

### Common Issues

**Test timeout**: Increase timeout in jest.config.js (currently 1000s)

**CLI binary not found**: Run `npm run prepare` to build the CLI

**Git operations fail**: Ensure you're in a valid git repository context

**Tests interfere with each other**: Ensure tests use `withTempDirectory()` for isolation

### Debug Mode

Enable debug output in tests:
```typescript
const runner = new E2ETestRunner(basicTestSetupData)
    .withDebug(true);

// Or for integration tests:
await testWith(basicTestSetupData)
    .withDebug(true)
    .evaluateWithRemoteAndLocalRepos(/* ... */);
```

## Examples by Command Type

### Read-Only Command

Commands that don't modify state (e.g., validate, status):
- Use `evaluateWithRemoteRepos` or `runWithRemoteRepos`
- Faster execution (no local clone overhead)

### Write Command

Commands that modify repositories (e.g., clone, branch, update):
- Use `evaluateWithRemoteAndLocalRepos` or `runWithRemoteAndLocalRepos`
- Creates isolated local clones for testing

### Multi-Repo Command

Commands that operate across multiple repos:
- Use `basicTestSetupData` or `multiBranchTestSetupData`
- Test all repos are affected
- Verify parent-repos.json is updated correctly

## Further Reading

- **Existing Tests**: See `test/repos/CloneRepos.test.ts` for integration examples
- **E2E Examples**: See `e2e-tests/repos/clone.e2e.ts` for E2E examples
- **Test Helpers**: See `test/helpers/remoteRepositories.ts` for helper documentation
- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **execa Documentation**: https://github.com/sindresorhus/execa#readme
