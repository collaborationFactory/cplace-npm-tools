# Fix Remaining 4 Test Failures

## Context

After fixing test isolation issues (temp directory race condition and process.chdir() mutex lock), 4 tests remain consistently failing. These are **NOT** flaky tests - they fail deterministically due to actual bugs in the tests or commands.

## Current Status

- **Total Tests**: 348
- **Passing**: 344 (96%)
- **Failing**: 4 (consistent, reproducible)

## Failing Tests

### 1. BranchRepos Tests (2 failures)

**File**: `test/repos/BranchRepos.test.ts`

#### Test 1: "should create branch across all repos"
**Error**:
```
Expected substring: "feature/new-feature"
Received string:    ""
```
**Line**: Line 35 in test assertion
**Issue**: The command runs but branches are not created or not found in the sibling repositories

#### Test 2: "should create branch from specific source branch"
**Error**:
```
ENOENT: no such file or directory, open '.../working/rootRepo/parent-repos.json'
Failed to update repo descriptor parent-repos.json
```
**Location**: `src/commands/repos/BranchRepos.ts:93` (readFileSync)
**Issue**: The `parent-repos.json` file doesn't exist in rootRepo when the command tries to read it

### 2. MergeSkeleton Tests (2 failures)

**File**: `test/repos/MergeSkeleton.test.ts`

#### Test 1: "should detect and merge skeleton branch automatically"
**Error**:
```
Fix conflicts manually and rerun the same command or use the --interactive option to resolve conflicts interactively.
```
**Issue**: Merge operation encounters conflicts that aren't being resolved automatically

#### Test 2: "should handle merge conflicts with --ours strategy"
**Error**:
```
Fix conflicts manually and rerun the same command or use the --interactive option to resolve conflicts interactively.
```
**Issue**: Even with `ours: true` parameter, conflicts aren't being resolved

## Root Cause Analysis

### BranchRepos Command Issue

The `BranchRepos` command (src/commands/repos/BranchRepos.ts) has the following flow:

1. **Line 59**: `findRepos()` - Lists directories in `../` (parent of current directory)
2. **Line 65**: Checks each directory for `parent-repos.json` file
3. **Line 66**: Creates `Repository` instances for matching directories

**Problem**: The command uses **relative paths** (`../`) which depend on `process.cwd()`. The test setup may not match the expected directory structure.

**Test Setup** (from `test/helpers/remoteRepositories.ts`):
- Creates structure: `/tmp/.../working/rootRepo`, `/tmp/.../working/main`, etc.
- Clones repos but may not create `parent-repos.json` in all of them
- `writeParentRepos()` method (line 231-241) **filters out ROOT_REPO** when writing parent-repos.json

**Key Code** (remoteRepositories.ts:231-241):
```typescript
private static writeParentRepos(rootDir: string, newParentRepos: IReposDescriptor): void {
    const filtered: IReposDescriptor = {};
    Object.keys(newParentRepos).forEach((name) => {
        if (name !== ROOT_REPO) {  // <- Filters out 'rootRepo'!
            filtered[name] = newParentRepos[name];
        }
    });
    // Writes to rootDir/parent-repos.json
}
```

This explains why `rootRepo/parent-repos.json` exists (contains main, test_1, test_2) but other repos might not have the file.

### MergeSkeleton Command Issue

The `MergeSkeleton` command attempts to merge a skeleton branch but encounters real merge conflicts. The `--ours` strategy isn't working as expected, possibly due to:
1. Git merge configuration not being set up correctly
2. The test setup creating conflicting changes that can't be auto-resolved
3. The command not properly invoking the merge strategy

## Investigation Steps

### For BranchRepos:

1. **Verify directory structure**: Add debug logging to see what `findRepos()` actually finds
   ```typescript
   // In BranchRepos.ts:59
   return fs.readdirAsync('../')
       .tap(dirs => console.log('Found directories:', dirs))
       .map((dir: string) => this.checkRepo(dir))
   ```

2. **Check parent-repos.json creation**: Verify that parent-repos.json is created in all required repos
   ```bash
   # In test
   ls -la /tmp/.../working/*/parent-repos.json
   ```

3. **Test the command manually** in the test environment structure:
   ```bash
   cd /tmp/.../working/rootRepo
   ls ../ # Should show: main, test_1, test_2, rootRepo
   cat parent-repos.json
   cat ../main/parent-repos.json  # Does this exist?
   ```

### For MergeSkeleton:

1. **Check git merge configuration**: Verify git is configured to handle merge strategies
   ```typescript
   // Before merge
   await repo.raw(['config', 'merge.ours.driver', 'true']);
   ```

2. **Inspect merge conflict details**: Add logging to see what files are conflicting
   ```typescript
   // In MergeSkeleton.ts
   const status = await repo.status();
   console.log('Conflicted files:', status.conflicted);
   ```

3. **Verify skeleton branch setup**: Check that the test is creating the skeleton branch correctly
   ```bash
   git log --all --oneline --graph
   ```

## Recommended Fixes

### Option A: Fix Test Setup (Recommended)

**For BranchRepos**:
1. Ensure `parent-repos.json` is created in **all** sibling repos, not just rootRepo
2. Modify `writeParentRepos()` or create a test-specific version that writes to all repos
3. Update test helper to match the command's expectations

**For MergeSkeleton**:
1. Simplify test scenarios to avoid real conflicts
2. Or set up git merge drivers properly before running tests
3. Ensure the `--ours` strategy is properly passed to git

### Option B: Fix Commands

**For BranchRepos**:
1. Make the command more robust - handle missing parent-repos.json
2. Add better error messages
3. Consider using absolute paths instead of relative paths

**For MergeSkeleton**:
1. Improve merge conflict handling
2. Ensure `--ours` strategy is properly applied
3. Add better conflict detection and user feedback

## Files to Review

### Test Files
- `test/repos/BranchRepos.test.ts` - The failing tests
- `test/repos/MergeSkeleton.test.ts` - The failing tests
- `test/helpers/remoteRepositories.ts` - Test infrastructure

### Command Files
- `src/commands/repos/BranchRepos.ts` - Command implementation
- `src/commands/repos/MergeSkeleton.ts` - Command implementation
- `src/git/Repository.ts` - Git operations wrapper

## Quick Win: Skip Tests Temporarily

If you need to ship quickly, mark these tests as skipped:

```typescript
// In BranchRepos.test.ts
test.skip('should create branch across all repos', async () => {
// In MergeSkeleton.test.ts
test.skip('should detect and merge skeleton branch automatically', async () => {
```

Add a comment referencing this document.

## Running Tests

```bash
# Run only failing tests
npm test -- test/repos/BranchRepos.test.ts
npm test -- test/repos/MergeSkeleton.test.ts

# Run serially for clearer output
npm test -- test/repos/BranchRepos.test.ts --runInBand

# Run all tests
npm test
```

## Success Criteria

- [ ] All 348 tests passing
- [ ] No flaky tests (consistent pass/fail)
- [ ] BranchRepos creates branches in all repos
- [ ] MergeSkeleton handles conflicts with --ours strategy
- [ ] Tests complete in < 2 minutes

## Related Commits

- `e495483` - Fix temp directory race condition
- `e04b5ff` - Add process.chdir() mutex lock for test isolation

## Estimated Effort

**2-4 hours** - Most of the work is understanding the test setup and adjusting expectations or implementation.
