# Complete Test Suite Implementation for AI Vibe - Design Approach

## Overview

Design and implement a comprehensive 3-tier test suite (unit, integration, and E2E tests) for cplace-cli to enable AI vibe and agent-driven development. This includes building E2E test infrastructure to execute the CLI binary in isolated environments, completing missing integration test coverage, and establishing patterns for AI-driven testing workflows.

## Problem Statement

The cplace-cli project has strong integration test coverage (70-75%) but zero E2E tests that actually invoke the CLI binary. For AI agents to confidently generate, modify, and test CLI commands, we need comprehensive black-box testing that validates the complete user experience from CLI invocation to output validation.

### Requirements
- Build E2E test infrastructure to execute `cplace-cli` binary with isolated git environments
- Complete missing integration tests for 3 repos subcommands and other gaps
- Achieve 100% E2E coverage for all 16 commands/subcommands (5 main commands)
- Support parallel test execution in CI/CD (GitHub Actions)
- Leverage existing test infrastructure (`remoteRepositories.ts`) for 90% of needs
- Enable AI agents to generate and validate tests from specifications

### Constraints
- Must maintain existing integration tests (both serve different purposes)
- E2E tests must use real git operations (no mocking)
- Tests must be isolated with no shared state between runs
- Must run in reasonable time (<15 minutes total for full suite)
- Must work in GitHub Actions CI/CD environment
- Cannot test deprecated commands (`refactor`, `e2e`)

## Design Decisions Summary

1. **E2E Infrastructure Architecture: Hybrid Approach with E2ETestRunner**: Build an `E2ETestRunner` class that wraps existing test helpers (`remoteRepositories.ts`, `directories.ts`) and adds a CLI execution layer via the `execa` library
   - Reuses 90% of proven test infrastructure
   - Provides clean, high-level API for test writers
   - Abstracts CLI execution, environment setup, and assertions

2. **Test Organization: Mirrored Command Structure**: Create `e2e-tests/` directory with subdirectories matching `src/commands/` structure
   - `e2e-tests/repos/`, `e2e-tests/release-notes/`, `e2e-tests/flow/`, etc.
   - One test file per subcommand (e.g., `clone.e2e.ts`, `update.e2e.ts`)
   - Clear separation from integration tests for independent execution

3. **CLI Execution: execa Library with Shell Mode**: Use the battle-tested `execa` npm package (130M+ weekly downloads) to spawn CLI processes
   - Simulates real-world bash/zsh usage
   - Clean Promise-based API with automatic output buffering
   - Better error handling than native child_process

4. **Test Environment Isolation: Hybrid Strategy**: Share expensive setup (remote repos) for read-only operations, full isolation for write operations
   - Shared remote git repos for commands that don't modify remotes (clone, update, visualize)
   - Isolated remote repos for write commands (upmerge, push, merge-skeleton)
   - Always isolated working directories per test
   - Supports parallel execution

5. **Integration vs E2E Separation: Clear Layered Strategy**: Maintain both test types with distinct responsibilities
   - Integration tests: White box, code-level, test business logic and edge cases, call classes directly
   - E2E tests: Black box, CLI-level, test user experience, invoke binary, validate output
   - Purpose-driven overlap is acceptable and beneficial

6. **Test Data Strategy: Programmatic Generation**: Use existing patterns (`basicTestSetupData`, `multiBranchTestSetupData`) with programmatic builders
   - Leverages proven, flexible approach from integration tests
   - Type-safe and maintainable
   - Can add simple fixture loading later if needed

7. **Implementation Phasing: Command-by-Command, Repos First**: Complete infrastructure and full E2E coverage for repos command (9 subcommands) before moving to other commands
   - Validates infrastructure thoroughly with most complex command
   - Clear milestones and measurable progress
   - Allows iteration on patterns before scaling

This means:
- E2E tests will feel like integration tests but invoke the CLI binary instead of calling classes directly
- AI agents can confidently generate and modify commands knowing comprehensive E2E tests will catch regressions
- Developers get fast feedback from integration tests during development and confidence from E2E tests before merging
- Test execution is parallelizable for CI/CD with smart resource sharing
- The E2E infrastructure adds only a thin CLI execution layer on top of existing proven test helpers

Major trade-offs we're accepting:
1. **Additional abstraction layer**: The `E2ETestRunner` adds complexity vs directly calling spawn, but gains maintainability and clean API for test writers
2. **Some test duplication**: Integration and E2E tests will overlap scenarios, trading disk space/execution time for comprehensive coverage and AI confidence
3. **Repos-first approach**: We get deep validation of infrastructure early but other commands wait longer for E2E coverage (mitigated by focusing on highest-priority command first)
4. **New dependency (execa)**: Adding ~100KB dev dependency vs using native APIs, but gains ergonomics, reliability, and community support
5. **Hybrid isolation strategy**: More complex than "everything isolated" but significantly faster for read-only operations (most tests)

What we're NOT doing (out of scope):
- Replacing integration tests with E2E tests (both serve different purposes)
- Using fixture files for test data (sticking with programmatic generation initially)
- Testing the deprecated commands (`refactor`, `e2e` command itself)
- Building custom subprocess wrapper (using proven execa library)
- Flat E2E directory structure (using mirrored command structure for clarity)
- Mocking git operations in E2E tests (must use real git for true black-box testing)

## Design Decisions - Details

### E2E Infrastructure Architecture: Hybrid Approach

**Chosen Approach:** E2ETestRunner class that wraps existing test helpers

**Rationale:**
The existing `test/helpers/remoteRepositories.ts` provides 90% of the infrastructure we need - it creates isolated git environments, manages temp directories, sets up remote repos, and handles cleanup. Rather than rebuilding this from scratch or using it directly (which would mix concerns), we create a thin abstraction layer that:
1. Uses existing helpers for environment setup (git repos, temp dirs, parent-repos.json)
2. Adds CLI-specific functionality (binary execution, output capture, exit code validation)
3. Provides a clean API tailored for E2E test writers

**Alternatives Considered:**
- **Thin wrapper with minimal abstraction**: Rejected because it would leak implementation details into test code, making tests harder to write and maintain
- **Separate E2E framework from scratch**: Rejected because it duplicates proven infrastructure, takes longer to implement, and creates maintenance burden

**Implications:**
- Need to design `E2ETestRunner` API carefully to balance simplicity with flexibility
- Test writers interact with high-level API, not raw test helpers
- Can evolve the abstraction layer without changing test code
- Infrastructure changes (like adding new assertion helpers) can be centralized

---

### Test Organization: Mirrored Command Structure

**Chosen Approach:** `e2e-tests/` directory with subdirectories matching `src/commands/`

**Rationale:**
AI agents and developers need to easily navigate between source code, integration tests, and E2E tests. A mirrored structure makes this trivial:
- `src/commands/repos/CloneRepos.ts` → `test/repos/CloneRepos.test.ts` (integration) + `e2e-tests/repos/clone.e2e.ts` (E2E)
- Clear separation allows running E2E tests independently: `jest e2e-tests/` vs `jest test/`
- Scales cleanly as commands grow
- Jest can easily target specific command tests: `jest e2e-tests/repos/`

**Alternatives Considered:**
- **Flat structure**: Rejected because it becomes cluttered with 15+ test files and harder to organize
- **Combined with integration tests**: Rejected because it mixes test types, complicates test runners, and violates separation of concerns

**Implications:**
- More directories to navigate (minor cost)
- Need to ensure Jest configuration recognizes both `test/` and `e2e-tests/`
- Clear convention for test file naming: `<subcommand>.e2e.ts`
- Easy to add new E2E tests following established pattern

---

### CLI Execution: execa Library with Shell Mode

**Chosen Approach:** Use `execa` npm package as dev dependency

**Rationale:**
While Node.js provides native `child_process` APIs, `execa` is the de facto standard for spawning processes in Node.js testing (130M+ weekly downloads, used by major projects). It provides:
- Clean Promise-based API: `await execa('cplace-cli', ['repos', '--clone'])`
- Automatic stdout/stderr buffering and parsing
- Better error handling with structured error objects
- Shell mode support to simulate real bash/zsh usage: `execa('cplace-cli repos --clone', {shell: true})`
- Stream support for long-running commands
- Well-tested and maintained

The ~100KB dev dependency cost is worth the ergonomics, reliability, and time saved.

**Alternatives Considered:**
- **Native child_process.spawn()**: Rejected because it requires verbose boilerplate for output capture, error handling, and Promise wrapping
- **Custom wrapper**: Rejected because it reinvents the wheel and will have bugs that execa already solved

**Implications:**
- Add `execa` to `devDependencies` in package.json
- Simple, consistent API across all E2E tests
- Shell mode allows testing CLI exactly as users would invoke it: `cplace-cli repos --clone`
- Need to handle PATH or use explicit binary path: `node dist/cli.js`

---

### Test Environment Isolation: Hybrid Strategy

**Chosen Approach:** Shared remote repos for read-only commands, isolated for write commands

**Rationale:**
Creating bare git repositories (simulating GitHub remotes) is expensive - it involves multiple git commands, file I/O, and directory setup. For commands that only read from remotes (clone, update, validate-branches, visualize), we can safely share remote repos across tests and just give each test its own working directory. This provides:
- Significant speed improvement (create remotes once per test suite)
- Full isolation where it matters (tests that modify remotes get their own)
- Matches existing `remoteRepositories.ts` pattern which has proven reliable
- Supports parallel test execution (working directories are always isolated)

**Write commands requiring isolated remotes:**
- `flow --upmerge` (pushes to remote branches)
- `repos --branch` (creates branches on remote if --push used)
- `repos --merge-skeleton` (can push to remote if --pull-request used)

**Read-only commands safe for shared remotes:**
- `repos --clone`, `repos --update`, `repos --write`, `repos --validate-branches`
- `release-notes` (all modes)
- `visualize`
- `version --rewrite-versions`

**Alternatives Considered:**
- **Complete isolation (fresh remotes per test)**: Rejected because it's significantly slower with no benefit for read-only operations
- **Shared remotes for everything**: Rejected because write operations would corrupt shared state and cause test interdependencies

**Implications:**
- E2ETestRunner needs to support both modes: `withSharedRemotes()` and `withIsolatedRemotes()`
- Tests for write commands take slightly longer (acceptable for correctness)
- Need careful design to ensure cleanup happens correctly for isolated remotes
- Working directories always isolated regardless of remote sharing strategy

---

### Integration vs E2E Test Separation: Clear Layered Strategy

**Chosen Approach:** Maintain both test types with distinct, complementary responsibilities

**Rationale:**
Integration tests and E2E tests serve fundamentally different purposes in an AI-driven development workflow:

**Integration Tests (White Box):**
- Call command classes directly (e.g., `new CloneRepos().execute()`)
- Test business logic, algorithms, and edge cases
- Fast feedback loop for developers (no CLI spawn overhead)
- Can test internal state, private methods, error paths
- Easier to debug when failures occur
- Use real git operations but can mock where beneficial
- Example: Test tag resolution logic with 50+ scenarios in `CloneRepos.test.ts`

**E2E Tests (Black Box):**
- Invoke CLI binary as users would (e.g., `cplace-cli repos --clone`)
- Test complete user experience: CLI parsing, output formatting, exit codes
- Validate end-to-end workflows with real git operations
- Give AI agents confidence that changes don't break user-facing behavior
- Catch integration issues between CLI layer and command classes
- Example: Test that `cplace-cli repos --clone` produces expected output and clones repos correctly

**Why Both:**
- AI agents need E2E tests to confidently modify commands (black box validation)
- Developers need integration tests for fast iteration (white box validation)
- E2E tests catch CLI parsing bugs, output formatting issues, and workflow problems
- Integration tests catch business logic bugs, edge cases, and error handling
- Together they provide comprehensive coverage at different levels of abstraction

**Alternatives Considered:**
- **E2E tests only**: Rejected because they're slower, harder to debug, and can't test internal logic
- **Integration tests only**: Rejected because they don't validate the CLI interface that users and AI agents interact with
- **E2E only for critical paths**: Rejected because it leaves gaps in coverage and doesn't meet AI vibe goals

**Implications:**
- Some scenarios will be tested at both levels (acceptable overlap for confidence)
- Total test count increases but serves distinct purposes
- Need discipline to keep boundaries clear (documented in test writing guide)
- Both test suites must pass before merging (enforced in CI/CD)

---

### Test Data Strategy: Programmatic Generation

**Chosen Approach:** Reuse existing patterns from integration tests

**Rationale:**
The integration tests already use proven test data builders:
- `basicTestSetupData`: Simple single-branch, multi-repo setup
- `multiBranchTestSetupData`: Complex setup with multiple release branches, custom branches, mixed tags

These are:
- Type-safe (TypeScript interfaces)
- Flexible (can be modified per test)
- Self-documenting (data structure visible in code)
- Already proven reliable across 25 integration test files
- Easy to create variations programmatically

We'll wrap these in `E2ETestRunner` to provide the same setup capability with CLI execution.

**When fixture files might be added later:**
- If test setups become extremely complex (50+ lines of setup code)
- If non-developers need to understand/modify test scenarios
- If we want to share test scenarios across different tools
- Requirement: Loading must be simple (one function call)

**Alternatives Considered:**
- **Fixture files (JSON/YAML)**: Rejected for initial implementation because it adds complexity, breaks from proven patterns, and isn't needed yet
- **Custom builders from scratch**: Rejected because existing builders already work well

**Implications:**
- Test setup is code-based and visible in test files
- Can leverage full TypeScript type system for setup validation
- Easy to create test variations using spread operators and modifications
- If fixture files are added later, they can coexist with programmatic generation

---

### Implementation Phasing: Command-by-Command, Repos First

**Chosen Approach:** Complete repos command E2E coverage before moving to other commands

**Rationale:**
The `repos` command is:
- **Highest priority** (core CLI functionality)
- **Most complex** (9 subcommands with diverse behaviors)
- **Best for validating infrastructure** (covers read-only, write operations, git operations, file parsing, etc.)
- **High value** (most used command by developers)

By completing repos first, we:
1. Thoroughly validate E2ETestRunner API and patterns
2. Identify and fix infrastructure gaps early
3. Establish test writing patterns for other commands to follow
4. Deliver high-value coverage early
5. Can iterate on infrastructure before scaling to other commands

**Phase Breakdown:**
```
Phase 1: Infrastructure + repos command (9 subcommands)
  - Build E2ETestRunner, CLI execution helpers, assertion utilities
  - Complete all 9 repos E2E tests
  - Document test writing patterns
  - Estimated: 2-3 weeks

Phase 2: release-notes command (3 subcommands)
  - Apply proven patterns
  - Estimated: 1 week

Phase 3: flow command (2 subcommands)
  - Handle write operations (upmerge modifies remotes)
  - Estimated: 1 week

Phase 4: visualize + version commands
  - Finish remaining coverage
  - Estimated: 1 week
```

**Alternatives Considered:**
- **Vertical slice (one test per command first)**: Rejected because it spreads effort thin and doesn't thoroughly validate infrastructure
- **Integration gaps + E2E together**: Rejected because it mixes concerns and could slow momentum

**Implications:**
- Other commands wait longer for E2E coverage (acceptable - repos is highest priority)
- Infrastructure will be well-tested before scaling
- Clear milestone after Phase 1: repos command fully covered
- Can parallelize work after Phase 1 if multiple developers involved

## Overall Architecture

The E2E test architecture layers on top of the existing integration test infrastructure:

```
┌─────────────────────────────────────────────────────┐
│  E2E Test (e2e-tests/repos/clone.e2e.ts)           │
│  - Uses E2ETestRunner API                          │
│  - Focuses on test logic and assertions            │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  E2ETestRunner (e2e-tests/helpers/E2ETestRunner.ts)│
│  - High-level API for E2E tests                    │
│  - Environment setup orchestration                  │
│  - CLI execution via execa                         │
│  - Assertion helpers                               │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Existing Test Helpers (test/helpers/)             │
│  - remoteRepositories.ts (git environment)         │
│  - directories.ts (temp dir management)            │
│  - repositories.ts (git operations)                │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Real Infrastructure                                │
│  - File system (temp directories)                  │
│  - Git operations (real repos, commits, branches)  │
│  - CLI binary (dist/cli.js)                        │
└─────────────────────────────────────────────────────┘
```

### Key Components

1. **E2ETestRunner** (new): Entry point for E2E tests
   - `withEnvironment(setup, testFn)`: Sets up git environment and runs test
   - `executeCli(args, options)`: Spawns CLI process and captures output
   - Assertion helpers: `expectSuccess()`, `expectFailure()`, `expectOutput()`

2. **CLI Execution Module** (new): Handles binary invocation
   - Wraps `execa` with cplace-cli-specific configuration
   - Handles PATH resolution or explicit binary path
   - Captures stdout, stderr, exit code
   - Provides structured result object

3. **Test Helpers** (existing, reused): Environment setup
   - `remoteRepositories.ts`: Create bare git repos (remotes) and local clones
   - `directories.ts`: Temp directory lifecycle management
   - `repositories.ts`: Git operations (commit, branch, tag)

4. **Assertion Utilities** (new): E2E-specific assertions
   - `assertFileExists(path)`, `assertFileContains(path, content)`
   - `assertGitBranch(repo, branch)`, `assertGitTag(repo, tag)`
   - `assertJsonFile(path, expected)` for parent-repos.json validation
   - `assertOutputContains(result, text)` for CLI output validation

### Data Flow

```
Test Invocation
      ↓
E2ETestRunner.withEnvironment(testSetupData)
      ↓
Create temp directory (directories.ts)
      ↓
Create remote git repos (remoteRepositories.ts)
      ↓
Setup parent-repos.json
      ↓
Execute CLI via execa
      ↓
Capture stdout/stderr/exitCode
      ↓
Assert results (git state, files, output)
      ↓
Cleanup temp directory
```

### Integration Points

**With existing integration tests:**
- Shares test helper infrastructure (`test/helpers/`)
- Uses same test data builders (`basicTestSetupData`, etc.)
- Different test directories: `test/` vs `e2e-tests/`
- Both run via Jest with different patterns

**With CLI binary:**
- Requires `npm run prepare` or `npm run dev:tsc` to build `dist/cli.js`
- E2E tests invoke binary as subprocess via execa
- Tests can check for binary existence and fail early if not built

**With CI/CD:**
- GitHub Actions workflow runs: `npm run prepare && npm test` (integration) && `npm run test:e2e` (E2E)
- Separate jobs for parallel execution
- Test results aggregated and reported
- Both must pass for PR merge

## Technology Choices

**E2E Test Execution:**
- Choice: `execa` npm package (v8.x)
- Why: Industry-standard process spawning library with excellent API, automatic output handling, and wide adoption (130M+ weekly downloads)

**Test Framework:**
- Choice: Jest (existing)
- Why: Already configured, supports TypeScript, excellent async support, familiar to team

**Git Operations:**
- Choice: Native git commands via child_process (existing pattern)
- Why: Already proven in integration tests, no abstraction layer to debug, works reliably

**Test Environment:**
- Choice: Native file system operations via Node.js fs module (existing)
- Why: Simple, reliable, no extra dependencies

**Directory Structure:**
- Choice: `e2e-tests/` at project root
- Why: Clear separation from integration tests, easy to target with Jest patterns

## Trade-offs & Risks

### Accepted Trade-offs

1. **Additional abstraction layer (E2ETestRunner)**: We're accepting the complexity of an abstraction layer to gain a clean, maintainable API for test writers. Alternative would be calling helpers directly, which leaks implementation details.

2. **Test duplication between integration and E2E**: Some scenarios will be tested at both levels. We accept this overlap because each level serves a different purpose - integration tests validate business logic, E2E tests validate user experience. Total test time increases but confidence increases more.

3. **Repos-first approach**: Other commands wait for E2E coverage while we complete repos. We accept this because repos is highest priority and validates infrastructure thoroughly before scaling. Risk mitigation: Can parallelize other commands in later phases if needed.

4. **New dependency (execa)**: Adding a dev dependency increases bundle size minimally (~100KB) and adds another library to maintain. We accept this because execa is extremely well-maintained, widely adopted, and saves significant development time with better reliability than custom implementation.

5. **Hybrid isolation strategy**: More complex than "always isolate everything" or "always share everything". We accept this complexity because the performance gain for read-only commands is significant (shared remotes created once vs per-test). Risk mitigation: Clear documentation of which commands need isolation.

### Known Risks

1. **E2E tests slower than integration tests**: E2E tests spawn processes and run full CLI, making them slower
   - Mitigation: Parallel execution in CI/CD, shared remotes for read-only commands, Jest's parallel test runner
   - Acceptable because E2E tests provide unique value that integration tests cannot

2. **Binary must be built before E2E tests run**: Tests fail if `dist/cli.js` doesn't exist
   - Mitigation: E2E test setup checks for binary and provides clear error message, CI/CD runs `npm run prepare` before tests
   - Acceptable because it ensures tests run against current code

3. **Git operations in tests can be flaky in CI/CD**: Network issues, file system delays, etc.
   - Mitigation: Generous timeouts (1000s from existing config), retry logic for known flaky operations, comprehensive error messages
   - Already proven reliable in integration tests

4. **Temp directory cleanup failures**: Tests could leave orphaned directories
   - Mitigation: Existing `withTempDirectory` helper has proven cleanup logic, fail test loudly if cleanup fails, CI/CD can clean workspace between runs
   - Risk is low based on existing test stability

5. **Test interdependencies with shared remotes**: Write commands could corrupt shared state if categorized incorrectly
   - Mitigation: Clear documentation of which commands need isolation, test failures would surface this immediately, easy to fix by switching to isolated mode
   - Risk is low because write commands are clearly identifiable

## Out of Scope

**Will NOT be implemented in this design:**

- **Testing deprecated commands**: The `refactor` and `e2e` commands are being deprecated and will not receive E2E tests
- **Fixture-based test data**: Initial implementation uses programmatic generation; fixtures can be added later if needed
- **Custom subprocess wrapper**: We use proven `execa` library instead of building our own
- **Flat E2E directory structure**: We use mirrored command structure for better organization
- **Replacing integration tests**: Both test types coexist and serve different purposes
- **Mocking git operations in E2E**: E2E tests must use real git for true black-box validation
- **Visual regression testing**: CLI output validation is text-based only (no screenshot comparison)
- **Performance benchmarking**: Tests validate correctness, not performance metrics
- **Cross-platform testing**: Initially focus on Unix-like systems (macOS/Linux); Windows support can be added later if needed

## Success Criteria

How will we know this design is successful?

1. **E2E Infrastructure Works**: E2ETestRunner can execute any CLI command, capture output, and validate results
2. **Complete repos Coverage**: All 9 repos subcommands have E2E tests covering happy paths and key error scenarios
3. **Tests Run in CI/CD**: E2E tests run successfully in GitHub Actions with parallel execution
4. **Fast Enough**: Full E2E test suite completes in <15 minutes
5. **AI Agent Ready**: AI agents can generate and validate tests from specifications using established patterns
6. **Clear Documentation**: Test writing guide explains patterns, conventions, and best practices
7. **No Flaky Tests**: E2E tests are reliable and don't produce false failures
8. **Integration Tests Preserved**: Existing integration tests continue to work and provide value

## Next Steps

1. Review this design document with stakeholders
2. Refine any aspects based on feedback
3. Once approved, proceed to implementation planning: `/create_plan specs/2026-01-12_test-suite-implementation-ai-vibe/design.md`

This will create a detailed implementation plan based on the design decisions we've made.

## References

- Original research: [research.md](./research.md)
- Existing integration test pattern: [test/repos/CloneRepos.test.ts](../../test/repos/CloneRepos.test.ts)
- Test helper infrastructure: [test/helpers/remoteRepositories.ts](../../test/helpers/remoteRepositories.ts)
- CLI entry point: [src/cli.ts](../../src/cli.ts)
- Command architecture: [src/commands/CommandRunner.ts](../../src/commands/CommandRunner.ts)
