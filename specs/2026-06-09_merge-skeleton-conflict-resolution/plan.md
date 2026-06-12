# Keep `version.gradle` as "ours" on skeleton-merge conflicts — Implementation Plan

## Overview

When `repos --merge-skeleton` merges a skeleton branch into a cplace customer repo, `version.gradle` can end up carrying the skeleton's (older) version instead of the repo's expected version. We will make the command **always keep the local ("ours") `version.gradle` whenever it conflicts during the merge**, so the skeleton's version is never adopted.

## Current State Analysis

- Conflict resolution is driven by `FILE_MERGE_STATUS_MAP` (`src/commands/repos/MergeSkeleton.ts:26-53`), keyed on git's 2-char porcelain status. `version.gradle` has no special handling: a `UU` ("both modified") or `AA` ("both added") conflict both default to `resolve` (`MergeSkeleton.ts:47-48`), i.e. left for manual resolution.
- `execute()` only routes files from `status.created` and `status.conflicted` through `handleFile` (`MergeSkeleton.ts:115-128`).
- `handleFile` (`MergeSkeleton.ts:205-227`) maps status → decision and records it into `this.ours` / `this.theirs` (or leaves it for manual `resolve`). In **non-interactive** mode it performs **no git calls** — it only consults the map and mutates the sets.
- Decisions are applied in `acceptDecisionsAndContinueMerge` (`MergeSkeleton.ts:314-344`): "ours" files reach `git checkout --ours <file>` + `git add` (`:326-329`) — unless the file is in `status.created` (→ delete, `:319-322`) or `index === 'D'` (→ `git rm`, `:323-325`).
- A CLI `--ours=<file>` option already pre-seeds `this.ours` during parsing (`MergeSkeleton.ts:172-176`).

### Key Discoveries
- **An `AA` ("both added") file lands in `conflicted` only, never in `created`.** Confirmed in simple-git's status parser: `...conflicts("A","A","U")` appends to `result.conflicted` (`node_modules/simple-git/dist/cjs/index.js:3237-3239,3345`). `created` is only populated for `" A"` / `"A "` / `"AM"` (`:3291-3312`). This is why forcing `version.gradle` to "ours" is safe — it will not hit the created-file *delete* branch in `acceptDecisionsAndContinueMerge`.
- **`git checkout --ours` works for both `AA` and `UU`** because both expose stage 2 ("ours"). For `AA` there is no merge base (stage 1), but stage 2/3 exist.
- **Why we must inject at `handleFile`, not pre-seed `this.ours`** (like `--ours` does): `acceptDecisionsAndContinueMerge` runs `git checkout --ours` for every entry in `this.ours` unconditionally. If `version.gradle` were pre-seeded but did *not* actually conflict, that command would fail ("path does not have our version"). `handleFile` is only invoked for files that are genuinely conflicted/created, so adding `version.gradle` there guarantees it only becomes "ours" when a conflict stage actually exists.
- `version.gradle` is read by `CplaceVersion` from the **repo root** (`src/helpers/CplaceVersion.ts:24-26`), and git reports the root file as the path `version.gradle`.
- No existing test file for `MergeSkeleton`; sibling commands are unit-tested directly (e.g. `test/helpers/SkeletonManager.test.ts`, `test/commands/repos/workflows/WorkflowsAdd.test.ts`). The repos integration harness (`test/helpers/remoteRepositories.ts`) exists but `MergeSkeleton`'s end-to-end path depends on the live GitHub skeleton remote, so it is not suited to a hermetic unit test.

## Desired End State

Running `repos --merge-skeleton` on a repo where `version.gradle` conflicts with the skeleton resolves that conflict automatically by keeping the **local** `version.gradle`; the merge continues without manual intervention for that file, and the repo's version is unchanged by the skeleton.

Verification: a unit test proves `handleFile` forces `version.gradle` into `this.ours` for `UU` and `AA` (interactive and non-interactive), while other files keep their existing status-map behavior; the project builds, lints, and all tests pass.

## What We're NOT Doing

- **No** semantic/version-aware reconciliation (no "keep the higher version" via `CplaceVersion.compareTo`). We always keep ours. (This was Option B in the research; explicitly out of scope.)
- **No** handling of a non-conflicting *clean* take of `version.gradle`. Per the established assumption, the file always conflicts for these repos (it is present and differs on both sides), so there is no clean-merge path to intercept. Documented as an accepted limitation.
- **No** new CLI flag — behavior is always on.
- **No** change to `parent-repos.json`, `gradle.properties`, or any other file. Scope is `version.gradle` only (kept extensible via a set).
- **No** end-to-end test against the live skeleton remote.

## Implementation Approach

Add a small allow-list of "always keep ours" files and short-circuit `handleFile` for them before the status-map lookup / interactive prompt. This reuses the existing apply path (`git checkout --ours` + `git add`) with zero changes to `acceptDecisionsAndContinueMerge`.

---

## Phase 1: Force `version.gradle` to "ours" on conflict

### Overview
Introduce `ALWAYS_OURS` and make `handleFile` resolve those files to "ours" unconditionally.

### Changes Required:

#### 1. `MergeSkeleton` static allow-list
**File**: `src/commands/repos/MergeSkeleton.ts`
**Changes**: Add a static set near the other static members (after `FILE_MERGE_STATUS_MAP` / `GH_CLI_COMMAND`, around `:55`).

```typescript
/**
 * Files whose local ("ours") version must always be kept when they conflict
 * during a skeleton merge, regardless of the git status code. This prevents the
 * skeleton's version.gradle (which may carry an older version) from being adopted.
 * Matched against the exact path git reports (repo-root files).
 */
protected static readonly ALWAYS_OURS: Set<string> = new Set<string>(['version.gradle']);
```

#### 2. Short-circuit in `handleFile`
**File**: `src/commands/repos/MergeSkeleton.ts`
**Changes**: At the very top of `handleFile` (`:205`), before the `FILE_MERGE_STATUS_MAP` lookup, force "ours" for allow-listed files (also skips the interactive prompt).

```typescript
private async handleFile(fileName: string, localStatus: string, remoteStatus: string, interactive: boolean, messagePrefix: string): Promise<void> {

    // Always keep our version of allow-listed files (e.g. version.gradle), regardless
    // of the merge status or interactive mode, so the skeleton's version is never adopted.
    if (MergeSkeleton.ALWAYS_OURS.has(fileName)) {
        console.log(`Keeping our version of '${fileName}' (always kept on conflict)`);
        this.ours.add(fileName);
        return;
    }

    // get the corresponding merge status from the map
    const mergeStatus = MergeSkeleton.FILE_MERGE_STATUS_MAP.get(`${localStatus}${remoteStatus}`);
    // ... unchanged ...
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run dev:tsc`
- [x] Lint passes: `npm run dev:lint`
- [x] Full build passes: `npm run dev`

#### Manual Verification:
- [x] Code review confirms `acceptDecisionsAndContinueMerge` is unchanged and the "ours" path (`git checkout --ours` + `git add`) handles `version.gradle` for both `UU` and `AA`.

---

## Phase 2: Unit tests for the forced-ours decision

### Overview
Add the first `MergeSkeleton` test, exercising `handleFile`'s non-git decision logic directly.

### Changes Required:

#### 1. New test file
**File**: `test/commands/repos/MergeSkeleton.test.ts`
**Changes**: Test `handleFile` (private; accessed via `as any`). In non-interactive mode it makes no git calls; the `version.gradle` short-circuit also skips the interactive prompt, so no mocking is required.

```typescript
import { MergeSkeleton } from '../../../src/commands/repos/MergeSkeleton';

describe('MergeSkeleton.handleFile', () => {
    function newCmd(): any {
        return new MergeSkeleton() as any;
    }

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('keeps our version.gradle on a UU conflict (non-interactive)', async () => {
        const cmd = newCmd();
        await cmd.handleFile('version.gradle', 'U', 'U', false, 'Conflict on file');
        expect(cmd.ours.has('version.gradle')).toBe(true);
        expect(cmd.theirs.has('version.gradle')).toBe(false);
    });

    it('keeps our version.gradle on an AA conflict (new/empty repo)', async () => {
        const cmd = newCmd();
        await cmd.handleFile('version.gradle', 'A', 'A', false, 'Conflict on file');
        expect(cmd.ours.has('version.gradle')).toBe(true);
        expect(cmd.theirs.has('version.gradle')).toBe(false);
    });

    it('keeps our version.gradle even in interactive mode without prompting', async () => {
        const cmd = newCmd();
        const promptSpy = jest.spyOn(cmd, 'userChoiceOursTheirsMerge');
        await cmd.handleFile('version.gradle', 'U', 'U', true, 'Conflict on file');
        expect(cmd.ours.has('version.gradle')).toBe(true);
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('leaves other conflicted files to the default (resolve) behavior', async () => {
        const cmd = newCmd();
        await cmd.handleFile('some/other/File.java', 'U', 'U', false, 'Conflict on file');
        expect(cmd.ours.has('some/other/File.java')).toBe(false);
        expect(cmd.theirs.has('some/other/File.java')).toBe(false);
    });

    it('keeps the default ours behavior for a one-sided local modification', async () => {
        const cmd = newCmd();
        await cmd.handleFile('src/Foo.java', 'M', ' ', false, 'Conflict on file');
        expect(cmd.ours.has('src/Foo.java')).toBe(true);
    });
});
```

### Success Criteria:

#### Automated Verification:
- [x] New test passes: `npx jest test/commands/repos/MergeSkeleton.test.ts`
- [~] Full suite: `npm test` → 298 passed, 50 failed. ALL 50 failures are pre-existing and environmental: the git-clone integration harness (`test/helpers/remoteRepositories.ts:274`) fails on this Windows env because the temp clone path (containing the 8.3 short name `VLADIM~1` + backslashes) gets mangled (`fatal: '...' does not appear to be a git repository`). These suites (CloneRepos/UpdateRepos/WriteRepos/ValidateBranches/DependencyManagement) do not import or exercise any file changed by this plan. Not a regression from this change.
- [x] Lint passes: `npm run dev:lint`

#### Manual Verification:
- [x] Test names/intents reviewed; `UU`, `AA`, interactive, and non-allow-listed cases are all covered.

---

## Phase 3: Documentation

### Overview
Document the new automatic behavior so users understand `version.gradle` is always kept.

### Changes Required:

#### 1. CLI help text
**File**: `src/cli.ts`
**Changes**: In the `--merge-skeleton` section (`:189-222`), add a line noting that the local `version.gradle` is always kept on conflict (skeleton's version is never adopted).

#### 2. Commands documentation
**File**: `documentation/list-of-available-commands/README.md` (and top-level `README.md` if it mirrors the merge-skeleton section)
**Changes**: Mirror the same note in the `repos --merge-skeleton` description.

### Success Criteria:

#### Automated Verification:
- [x] Build still passes: `npm run dev`

#### Manual Verification:
- [x] `cplace-cli repos --help` (or reading `cli.ts` help block) shows the new note.
- [x] Documentation reads clearly and matches the implemented behavior.

---

## Testing Strategy

### Unit Tests:
- `handleFile` forces `version.gradle` → `this.ours` for `UU` and `AA`, in both interactive and non-interactive modes (prompt skipped).
- Non-allow-listed files retain existing status-map behavior (`UU` → resolve/no-op; `M ` → ours).

### Integration Tests:
- Not automated (live skeleton remote dependency). Covered by manual testing below.

### Manual Testing Steps:
1. **New/empty repo (`AA`)**: Create a repo whose `version.gradle` differs from the skeleton's and has unrelated history, run `cplace-cli repos --merge-skeleton --skeleton-branch=<branch>`, and confirm the resulting `version.gradle` retains the local version and the merge completes without manual conflict resolution for that file.
2. **Established repo (`UU`)**: In a repo that has locally modified `version.gradle`, run the command and confirm the local `version.gradle` is kept and the merge continues.
3. **Other conflicts unaffected**: Confirm genuine conflicts in non-`version.gradle` files still default to manual `resolve` (and that `--interactive` still prompts for them).
4. **Interactive mode**: Run with `--interactive` and confirm no prompt appears for `version.gradle` (a log line indicates it was kept) while other files still prompt.

## Performance Considerations
None — one `Set.has` check per handled file.

## Migration Notes
None. Behavior change only affects how `version.gradle` conflicts are auto-resolved during `merge-skeleton`; no data or config migration. Backward compatible with existing `--ours`/`--interactive` usage.

## References
- Research: [research.md](./research.md) — see "DECISION: keep ours for `version.gradle` on conflict"
- Conflict map & handler: `src/commands/repos/MergeSkeleton.ts:26-53,205-227,314-344`
- simple-git status parsing (AA → conflicted): `node_modules/simple-git/dist/cjs/index.js:3237-3239,3288-3345`
- Existing sibling test pattern: `test/helpers/SkeletonManager.test.ts`
