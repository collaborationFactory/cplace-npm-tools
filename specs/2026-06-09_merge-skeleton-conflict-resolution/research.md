---
date: 2026-06-09T12:16:13+02:00
git_commit: 37e54753ae5c4d4852a12ee900d7b650d4b544af
branch: master
topic: "repos --merge-skeleton implementation, conflict resolution, and version.gradle handling"
tags: [research, codebase, merge-skeleton, conflict-resolution, version-gradle, skeleton-manager, cplace-version]
status: complete
last_updated: 2026-06-09
last_updated_note: "Added follow-up research for preventing version.gradle from being taken from the skeleton branch"
---

# Research: `repos --merge-skeleton` implementation, conflict resolution, and version.gradle

**Date**: 2026-06-09T12:16:13+02:00
**Git Commit**: 37e54753ae5c4d4852a12ee900d7b650d4b544af
**Branch**: master

## Research Question
Research the merge skeleton implementation (command `repos --merge-skeleton`). Also research how conflicts are resolved, with specific interest in the `version.gradle` file.

## Summary

The `repos --merge-skeleton` command (param name `mergeSkeleton`, short `-m`) merges a branch from the external **cplace skeleton repository** (`cplace-customer-repo-skeleton`) into the current customer repo, using git's native merge plus a programmatic conflict-resolution layer.

Key findings:

1. **Command wiring**: `repos --merge-skeleton` → `Repos.ts` dispatches to `MergeSkeleton` (`src/commands/repos/MergeSkeleton.ts`). The skeleton-repo plumbing (remote setup, branch selection, version gating, file reads) lives in the reusable `SkeletonManager` helper.

2. **Skeleton branch auto-selection**: If `--skeleton-branch` is not given, the branch is chosen automatically from the local cplace version via a hard-coded `CPLACE_VERSION_TO_SKELETON_VERSION` map, using `CplaceVersion.compareTo`. Skeleton operations are gated to cplace ≥ 5.4.

3. **Conflict resolution is generic and NOT version-aware**: Conflicts are resolved by a lookup table keyed on git's two-character status code (`FILE_MERGE_STATUS_MAP`), which maps each status to a default action of `ours`, `theirs`, or `resolve` (manual). In non-interactive mode the default action is applied automatically; in `--interactive` mode the user is prompted per file. Decisions are applied with `git checkout --ours/--theirs` followed by `git add`, then `git merge --continue`.

4. **`version.gradle` has NO special-case conflict handling.** ⚠️ This contradicts the premise of the question. During the merge, `version.gradle` flows through the exact same generic ours/theirs/resolve handler as every other file. A typical "both modified" (`UU`) conflict on `version.gradle` defaults to **`resolve`** (manual). The only `version.gradle`-aware logic in the whole flow happens **before** the merge: parsing the version to pick the skeleton branch and to validate the minimum supported cplace version. Semantic reconciliation of the version number (e.g. `.999` rewrites) lives in a completely separate command, `version --rewrite` (`RewriteVersions`), which is **not** invoked by merge-skeleton.

## Detailed Findings

### Command wiring & CLI surface

- CLI help / usage: `src/cli.ts:189-222` documents `--merge-skeleton|-m` with options `--base-branch`, `--target-branch`, `--skeleton-branch`, `--ours`, `--pull-request`, `--push`, `--interactive`.
- Dispatch: `src/commands/repos/Repos.ts:27-28` defines `PARAMETER_MERGE_SKELETON = 'mergeSkeleton'` / short `'m'`; `Repos.ts:46-47` instantiates `MergeSkeleton`.
- Parameter parsing & validation: `MergeSkeleton.prepareAndMayExecute` (`src/commands/repos/MergeSkeleton.ts:151-203`).
  - `--pull-request` requires both `--base-branch` and `--target-branch`, and that the `gh` CLI is installed (`MergeSkeleton.ts:178-193`).
  - `--ours` accepts a string or array of file names that should always be resolved to "ours" (`MergeSkeleton.ts:172-176`).

### End-to-end execution flow

`MergeSkeleton.execute` (`src/commands/repos/MergeSkeleton.ts:73-149`):

1. Open repo at cwd and verify it is a git repo (`:74-77`).
2. `SkeletonManager.ensureSkeletonRemote(repo)` — add the `skeleton` remote if missing and fetch (`:80`, impl `SkeletonManager.ts:37-48`).
3. Capture status; check whether repo is mid-merge via `repo.isRepoMerging()` (`:83-84`).
4. `prepareBranch` — if not already merging: validate clean tree, optionally checkout `--base-branch`, then checkout/create `--target-branch` (`:85`, impl `:257-299`).
5. `SkeletonManager.validateCplaceVersion()` — parse version, gate to ≥ 5.4 (`:90`).
6. Resolve skeleton branch to merge: explicit `--skeleton-branch` else auto-detect (`:91`, `getSkeletonBranchToMerge` `:301-307`).
7. If not already merging: fast-forward pull the tracked target branch, then `mergeSkeletonBranch(...)` which calls `repo.merge` with `noEdit: true, noCommit: true` (`:94-106`, `:309-312`).
8. Re-read status; if now in a merging state (`:109-113`):
   - For each **created** file → `handleFile(..., 'New file')` (`:115-120`).
   - For each **conflicted** file → `handleFile(..., 'Conflict on file')` (`:123-128`).
   - `acceptDecisionsAndContinueMerge(repo)` applies decisions and continues the merge (`:130-136`).
9. On success, optionally create a PR (`createPullRequest`, `:352-364`) and/or push (`pushBranch`, `:346-350`).

### Conflict resolution mechanism (the core of the question)

**Status → action table** — `FILE_MERGE_STATUS_MAP` at `src/commands/repos/MergeSkeleton.ts:26-53`. Keyed on the 2-char `XY` git porcelain status (`index` + `working_dir`). Highlights:
- Merge-conflict codes: `DD` both deleted → `theirs`; `AU` added by us → `ours`; `UD` deleted by them → `resolve`; `UA` added by them → `resolve`; `DU` deleted by us → `ours`; `AA` both added → `resolve`; **`UU` both modified → `resolve`** (`:42-48`).
- Non-conflict / index states: `M ` modified → `ours`, ` M` work-tree changed → `theirs`, `A ` new file → `ours`, `D ` deleted → `ours`, `??` untracked → `theirs`, etc. (`:27-52`).

**Per-file decision** — `handleFile` (`src/commands/repos/MergeSkeleton.ts:205-227`):
- Looks up the merge status from the map by `${localStatus}${remoteStatus}` (`:208`).
- If `--interactive`: prompts the user via `userChoiceOursTheirsMerge` ( `@inquirer/prompts` `expand`) with the table's `defaultAction` preselected (`:211-213`, `:229-251`).
- If non-interactive: uses the table's `defaultActionLong` directly (`:215`).
- Records the result into `this.ours`, `this.theirs`, or does nothing for `resolve` (leaving the conflict in the tree for manual fixing) (`:218-226`).

Note `--ours` file names supplied on the CLI are pre-seeded into `this.ours` during parsing (`:172-176`), forcing those files to "ours" regardless of status.

**Applying decisions** — `acceptDecisionsAndContinueMerge` (`src/commands/repos/MergeSkeleton.ts:314-344`):
- For each "ours" file (`:316-330`):
  - If it is a newly **created** file → unstage and delete it (`git restore --staged` + `fs.unlinkSync`) (`:319-322`).
  - Else if locally deleted (`index === 'D'`) → `git rm --sparse` (`:323-325`).
  - Else → `git checkout --ours <file>` then `git add -A -f` (`:326-329`).
- For each "theirs" file → `git checkout --theirs <file>` then `git add -A -f --sparse` (`:332-337`).
- Finally `git -c core.editor=true merge --continue` (`:339-343`). If git still reports unresolved conflicts (any `resolve` files left untouched), this throws and `execute` reports: *"Fix conflicts manually and rerun the same command or use the --interactive option..."* (`:131-135`).

**Rerun semantics**: Because step 3 detects an in-progress merge, re-running the command after manually fixing `resolve` files skips the merge and goes straight to applying decisions + `merge --continue`.

### How `version.gradle` is treated during conflict resolution

⚠️ **There is no `version.gradle`-specific branch anywhere in `MergeSkeleton`.** It is matched only by its git status code:
- A "both modified" conflict on `version.gradle` yields `UU` → default action **`resolve`** (`MergeSkeleton.ts:48`). In non-interactive mode this is left **unresolved**, and `merge --continue` will fail until the user fixes it manually (or reruns with `--interactive` and chooses ours/theirs, or passes `--ours=version.gradle`).
- The content of `version.gradle` is never parsed, diffed, or numerically reconciled during the merge. There is no logic that says "keep the higher version" during conflict resolution.

The only place `version.gradle` is read in the merge-skeleton flow is **before** merging, via `CplaceVersion`:
- `SkeletonManager.validateCplaceVersion()` (`SkeletonManager.ts:109-122`) — `CplaceVersion.initialize()`, log detected version, throw if `< 5.4`.
- `SkeletonManager.getSkeletonBranchForVersion()` (`SkeletonManager.ts:55-87`) — pick the skeleton branch.

### Skeleton branch auto-selection & version parsing

`CPLACE_VERSION_TO_SKELETON_VERSION` map (`src/helpers/SkeletonManager.ts:17-31`) maps `{major,minor,patch}` thresholds → skeleton branch names (`version/2.0` … `version/25.4`).

`getSkeletonBranchForVersion` (`SkeletonManager.ts:55-87`):
- Honors an explicit override (`:56-59`).
- Iterates the map entries from highest to lowest and picks the first whose threshold satisfies `CplaceVersion.compareTo(key) >= 0` (`:70-77`) — i.e. the highest threshold the current version is ≥ to.
- Fallback `version/25.4` with a warning if no match (`:79-83`).

**`version.gradle` format & parsing** (`src/helpers/CplaceVersion.ts`):
- File constants `version.gradle` / `build.gradle` (`:5-6`); singleton `_version` (`:8`); fields `major, minor, patch, snapshot` (`:10-15`).
- `initialize()` (`:17-62`): resolves both files relative to cwd; if `build.gradle` missing assumes `1.0.0` (`:31-33`); else `determineVersion` (`:35`), splits on `-` for snapshot suffix (`:41-48`, snapshot true only if suffix contains "snapshot"), splits numeric on `.`, requires ≥ 3 parts else throws (`:49-52`). Throws if called twice (`:18-22`).
- `determineVersion` (`:73-84`): first looks for a `version` line in `build.gradle`; if absent, looks for `currentVersion` then `cplaceVersion` in `version.gradle`.
- `getVersionString` (`:167-184`): finds the first line whose trim `startsWith` the pattern, splits on `=`, strips quotes.
- `compareTo` (`:144-156`): compares major→minor→patch numerically; non-finite patch treated as `0`; **snapshot ignored**.
- `toString` (`:124-133`): renders `major.minor`, appends `.patch` if finite, appends `-SNAPSHOT` if snapshot.

`version.gradle` field structure (from fixtures `test/version/RewriteVersions.test.ts:196-211`):
```
ext {
    currentVersion='24.2.9'
    createdOnBranch='release/24.2'
    cplaceVersion='24.2'
}
```
- `cplaceVersion` — `major.minor` only.
- `currentVersion` — full `major.minor.patch` (optionally `-CLASSIFIER`/`-SNAPSHOT`).
- `createdOnBranch` — informational, not parsed for version data.

### The separate version-rewrite logic (NOT part of merge-skeleton)

`version --rewrite` → `RewriteVersions` (`src/commands/version/RewriteVersions.ts`) is the only place that **writes** `version.gradle`. It is independent of merge-skeleton:
- `PATCH_VERSION_CUSTOM_BRANCH = 999` (`:21`).
- `readCplaceVersion` (`:74-93`): its own regex `cplaceVersion\s*=\s*['"](\d+)\.(\d+)['"]` (`:78`) to read major+minor; forces patch to `999` (`:84`). Does NOT use `CplaceVersion.initialize()`.
- `findReposWithCustomBranches` (`:95-115`): repos whose branch is set and is not `release/*`, `master`, or `main`.
- `updateVersionGradleInAffectedRepos` (`:117-138`) → calls `CplaceVersion.updateVersionGradleFile(...)`.
- `updateArtifactVersionInAllParentRepos` (`:140-183`): sets `artifactVersion` and deletes `useSnapshot` in `parent-repos.json`.

`CplaceVersion.updateVersionGradleFile` (`src/helpers/CplaceVersion.ts:94-122`): rewrites the `currentVersion=` line if its value differs (string equality, `:101-105`); if no `currentVersion` line exists, inserts one before the first closing `}` (`:109-112`); writes only if changed (`:118-120`).

### Skeleton remote file access (used by sibling `--workflows` command)

`SkeletonManager` also exposes read helpers used by other skeleton features (e.g. `repos --workflows`): `getFilesFromRemoteBranch` (`:128-156`), `getFileContentFromRemote` (`:162-181`), `listWorkflowsInBranch` (`:186-206`), `fileExistsInRemote` (`:211-230`), `copyFileFromRemote` (`:235-254`). These use `git ls-tree`/`git show`/`git cat-file` against `skeleton/<branch>` without checking the branch out. They are not part of the merge-skeleton conflict path.

## Code References
- `src/commands/repos/MergeSkeleton.ts:26-53` — `FILE_MERGE_STATUS_MAP`: git-status → default ours/theirs/resolve action.
- `src/commands/repos/MergeSkeleton.ts:73-149` — `execute`: full merge-skeleton orchestration.
- `src/commands/repos/MergeSkeleton.ts:205-227` — `handleFile`: per-file ours/theirs/resolve decision.
- `src/commands/repos/MergeSkeleton.ts:229-251` — `userChoiceOursTheirsMerge`: interactive prompt.
- `src/commands/repos/MergeSkeleton.ts:314-344` — `acceptDecisionsAndContinueMerge`: applies decisions, `git merge --continue`.
- `src/commands/repos/MergeSkeleton.ts:309-312` — `mergeSkeletonBranch`: `repo.merge` with `noCommit`.
- `src/commands/repos/Repos.ts:27-28,46-47` — command registration/dispatch.
- `src/cli.ts:189-222` — help text and usage examples.
- `src/helpers/SkeletonManager.ts:17-31` — version→skeleton-branch map.
- `src/helpers/SkeletonManager.ts:55-87` — `getSkeletonBranchForVersion`.
- `src/helpers/SkeletonManager.ts:109-122` — `validateCplaceVersion` (≥ 5.4 gate).
- `src/helpers/CplaceVersion.ts:17-62` — `initialize` (version.gradle/build.gradle parse).
- `src/helpers/CplaceVersion.ts:73-84` — `determineVersion`.
- `src/helpers/CplaceVersion.ts:94-122` — `updateVersionGradleFile` (write path, used by RewriteVersions only).
- `src/helpers/CplaceVersion.ts:144-156` — `compareTo`.
- `src/commands/version/RewriteVersions.ts:74-93,117-138` — `.999` rewrite of version.gradle (separate command).
- `test/version/RewriteVersions.test.ts:196-211` — version.gradle fixture structure.
- `test/helpers/CplaceVersion.test.ts:6-47` — `determineVersion` tests.

## Architecture Insights

- **Separation of orchestration vs. skeleton plumbing**: `MergeSkeleton` owns the merge/conflict workflow; `SkeletonManager` is a reusable static helper for remote setup, branch selection, version gating, and remote file reads (shared with `repos --workflows`). The class comment notes it was "Extracted from MergeSkeleton.ts to enable reuse."
- **Conflict policy is declarative & file-agnostic**: All resolution policy is encoded in one status-code table. This keeps the logic simple but means there is **no per-file semantic merging** — including for `version.gradle`. The cost is that semantically important files (like `version.gradle`) default to `resolve` on `UU` and must be handled manually, via `--interactive`, or via `--ours`.
- **Version parsing is duplicated**: `CplaceVersion` uses a line-`startsWith` parser while `RewriteVersions.readCplaceVersion` uses its own regex. Two sources of truth for reading `version.gradle`.
- **`compareTo` ignores snapshot and treats missing patch as 0** — only major/minor/patch ordering matters for branch selection.
- **Non-interactive default leans conservative for true conflicts**: `UU`/`AA`/`UA`/`UD` all default to `resolve`, so genuine two-sided conflicts are never silently auto-resolved; only clear one-sided states auto-pick ours/theirs.

## Historical Context (from specs/)
No prior `specs/` documents exist in the repository (the `specs/` directory did not exist before this research). This is the first research document.

## Related Research
None yet — this is the first entry under `specs/`.

## Open Questions
- The question assumed `version.gradle` gets special conflict treatment. It does not. Is that the intended behavior, or is a `version.gradle`-aware merge (e.g. "keep the higher cplace version") a desired enhancement? `CplaceVersion.compareTo` + `updateVersionGradleFile` already provide the primitives to implement such a custom resolver if wanted.
- Should `version.gradle` be added to a default `--ours` set for merge-skeleton, so the customer repo's version always wins automatically instead of defaulting to manual `resolve`?
- `getSkeletonBranchToMerge` does not call `SkeletonManager.validateSkeletonBranchExists`, so an explicit `--skeleton-branch` typo would only fail later at the `git merge` step rather than with a clear up-front error.

---

## Follow-up Research 2026-06-09T12:33:28+02:00

### Question
The skeleton repo does **not** have a dedicated branch per cplace release. When merging, the latest skeleton branch *not newer than* the cplace release version is used (e.g. a `release/25.3` repo merges skeleton `version/25.3`, but a hypothetical `release/25.5` repo would still merge the newest available `version/25.4`). The skeleton branch carries its own `version.gradle` whose version is typically **older/different** from the cplace repo's actual release version. Sometimes the merge silently takes `version.gradle` from the skeleton, leaving the cplace repo with an older-than-expected version. **Goal: prevent `version.gradle` from being taken directly from the skeleton branch.**

### Root cause (confirmed in code)

The dangerous case is **NOT a conflict** — it is a *clean* 3-way merge where only the skeleton side changed `version.gradle` relative to the merge base. Git resolves that automatically by taking "theirs" (the skeleton), and the current code never gets a chance to intervene:

1. `MergeSkeleton.execute` only iterates `this.status.created` and `this.status.conflicted` when deciding which files to handle (`src/commands/repos/MergeSkeleton.ts:115-128`). A silently auto-merged `version.gradle` is a **clean staged modification** (`M ` / `MM`), so it appears in *neither* list and is never passed to `handleFile`. → No decision is ever made for it.
2. The merge is run with `--no-commit` (`MergeSkeleton.ts:311` → `Repository.merge` adds `--no-commit` at `src/git/Repository.ts:775`) and also `--allow-unrelated-histories` (`Repository.ts:776`). Because of `--no-commit`, the repo stays in a merging state even on a clean merge, so `isRepoMerging()` returns true (`Repository.ts:1256-1267`) and the post-merge block *does* run — meaning **there is a viable hook point to fix this**, the code just doesn't inspect cleanly-merged files today.
3. `--allow-unrelated-histories` means the merge base can be empty/shallow, which makes git *more* likely to adopt one side's file wholesale without a conflict.

**Important limitation of the existing `--ours` mechanism:** Passing `--ours=version.gradle` does **not** fix this case. `acceptDecisionsAndContinueMerge` resolves "ours" files with `git checkout --ours -- <file>` (`MergeSkeleton.ts:327`), but `git checkout --ours` only works on a path that has conflict stages. For a cleanly-merged (non-conflicted) `version.gradle`, that command errors ("path does not have our version"). So the current "ours" path is conflict-only and cannot protect a silently auto-merged file.

**Why `.gitattributes merge=ours` is also insufficient:** A custom `merge=ours` driver (the pattern hinted at in `CLAUDE.md`) is only invoked when git detects a conflict on that path (both sides changed). In the exact failure scenario here (only the skeleton changed `version.gradle`), git never invokes the driver — it fast-resolves to theirs. So a merge driver alone would not close the gap.

### Solution ideas (ranked)

#### Option A — Unconditionally restore `version.gradle` to "ours" after the merge (recommended, simplest robust fix)
After the merge and before `merge --continue`, explicitly restore the cplace repo's own `version.gradle` regardless of whether git flagged a conflict:
- Use `git checkout HEAD -- version.gradle` (during an in-progress merge, `HEAD` is still the target/customer branch tip = "ours"), then `git add -- version.gradle`. This works for **both** the conflict case and the silent clean-merge case (unlike `git checkout --ours`, which is conflict-only).
- Implement as a hardcoded "always keep ours" set (e.g. `ALWAYS_OURS = new Set(['version.gradle'])`) merged into `this.ours` handling, but routed through a code path that uses `git checkout HEAD --` rather than `git checkout --ours`.
- Primitives already exist; this is a small change in `acceptDecisionsAndContinueMerge` (`MergeSkeleton.ts:314-344`) plus iterating all tracked-modified files, not just `created`/`conflicted`.
- Trade-off: the cplace repo's `version.gradle` *always* wins — intentional changes to `version.gradle` coming from the skeleton (rare; the skeleton's version field is not meant to drive customer versions) would be dropped. Given the field semantics, this is almost always what you want.

#### Option B — Post-merge semantic reconciliation via `CplaceVersion.compareTo` (most precise)
Capture the cplace repo's version *before* the merge, then after the merge re-parse `version.gradle` and, if the merged value is **older** than the pre-merge value, rewrite it back using the existing `CplaceVersion.updateVersionGradleFile(...)` (`src/helpers/CplaceVersion.ts:94-122`) and `CplaceVersion.compareTo(...)` (`:144-156`).
- Keeps any *newer* version the skeleton might legitimately introduce, but never regresses.
- Slightly more logic (must read the pre-merge version before `repo.merge`, and re-`initialize` is awkward because `CplaceVersion` is a throw-on-reinit singleton — would need a non-singleton parse helper or reset).
- Best "correctness" story; pairs well as a safety net even on top of Option A.

#### Option C — Restore the whole merge-base/customer version-relevant files
Generalize Option A to a configurable exclusion list (`version.gradle`, possibly `parent-repos.json`, `gradle.properties`) of files that should never be adopted from the skeleton. Surfaces as a CLI flag/default. Same mechanism as A, broader scope.

#### Option D — Don't let git auto-merge the file: capture & re-apply
Before merge, stash/record `version.gradle`; after merge, overwrite the working-tree `version.gradle` with the captured content and `git add`. Functionally equivalent to A but file-content based rather than git-ref based; useful if the file should be preserved byte-for-byte.

### Recommendation
Implement **Option A as the default behavior** (hardcode `version.gradle` into an always-keep-ours set, applied to *all* modified files post-merge — not just conflicted/created — using `git checkout HEAD -- <file>`), and optionally layer **Option B** as a verification step that logs/asserts the final version did not regress. This closes the silent clean-merge gap, which neither the current `--ours` flag nor a `.gitattributes merge=ours` driver can close.

### Key code change locations
- `src/commands/repos/MergeSkeleton.ts:115-128` — extend the post-merge loop to also consider cleanly-modified files (`this.status.modified` / `status.staged`), not only `created` + `conflicted`.
- `src/commands/repos/MergeSkeleton.ts:314-344` — in `acceptDecisionsAndContinueMerge`, add an always-keep-ours path that uses `git checkout HEAD -- <file>` + `git add` (works on non-conflicted paths, unlike the existing `git checkout --ours` at `:327`).
- `src/helpers/CplaceVersion.ts:94-122,144-156` — reusable primitives for Option B (rewrite + compare).

### Scope refinement: this manifests on *new* repos (reported observation)

The silent take is observed **only on new/freshly-created customer repos**, never on established ones. This is fully consistent with the root cause:

- A **new** repo is created from the skeleton and shares history with it, but has **not yet locally modified `version.gradle`** — so for that file, "ours" still equals the merge base. The skeleton branch *did* change `version.gradle`, so git sees changes on only one side → clean auto-merge → the skeleton's (older/placeholder) version is silently adopted, overwriting the version the new repo was expected to carry.
- An **established** repo has already bumped/customized `version.gradle` (diverged from the ancestor). Now both sides differ from the base → `UU` conflict → falls into the manual `resolve` default, which is why the bug never surfaces there.

Implication for reproduction: the deciding factor is "has the local `version.gradle` diverged from the shared ancestor?", and new repos are precisely the population where it has not.

### CORRECTION: new repos are *empty* and `merge-skeleton` is the initialization step

Further input from the user: new repos are **empty**, and the skeleton merge is run to **initialize** them (bring in build infrastructure, workflows, and `version.gradle` for the first time). This changes the mechanism and the fix:

- The empty repo and the skeleton have **unrelated histories** — which is exactly why `Repository.merge` passes `--allow-unrelated-histories` (`src/git/Repository.ts:776`). The merge base is effectively empty.
- `version.gradle` is contributed **entirely by the skeleton** — there is no meaningful "ours" copy to preserve. **Option A (keep ours) does NOT apply to the init case.**
- The version is "older than expected" for the structural reason in the original question: the skeleton has **no dedicated branch per cplace release**, so a repo targeting a version newer than the newest skeleton branch receives the newest available branch (`version/25.4`, the last entry of `CPLACE_VERSION_TO_SKELETON_VERSION` at `src/helpers/SkeletonManager.ts:17-31`), whose `version.gradle` carries the skeleton's own lower version.

**Revised recommended fix for the init case:** after the skeleton init merge, **explicitly set `version.gradle` to the intended target cplace version** rather than leaving the skeleton's value. The primitive already exists — `CplaceVersion.updateVersionGradleFile(versionGradlePath, newVersion)` (`src/helpers/CplaceVersion.ts:94-122`) — and `RewriteVersions` (`src/commands/version/RewriteVersions.ts`) already does essentially this for the `.999` custom-branch case.

**Open design dependency:** the command must obtain the *expected* version independently of the (skeleton-supplied) `version.gradle`. Candidate sources: (a) derive from `--base-branch`/`--target-branch` name (e.g. `release/25.4` → `25.4.0`); (b) a `version.gradle`/`build.gradle` seeded into the repo before the merge (would also affect `validateCplaceVersion`, which otherwise assumes `1.0.0` on an empty repo and throws the `< 5.4` error at `SkeletonManager.ts:119-121`); (c) a new explicit CLI parameter (e.g. `--cplace-version=25.4.0`); (d) external config. This source is the key open decision before implementing.

Note also: on a literally-empty repo, `CplaceVersion.initialize()` finds no `build.gradle` and assumes `1.0.0` (`src/helpers/CplaceVersion.ts:31-33`), which makes `validateCplaceVersion` throw "Skeleton operations work only for cplace versions 5.4 or higher" (`SkeletonManager.ts:119-121`). So either the empty repo already carries a minimal `version.gradle`/`build.gradle` with the target version, or the init flow must supply the version some other way — reinforcing that the "expected version" needs a defined source.

### DECISION: keep ours for `version.gradle` on conflict

Chosen approach (user decision): because `merge-skeleton` cannot run without a readable version (`validateCplaceVersion` throws otherwise), assume `version.gradle` is **always present on our side**. Therefore the fix is simply: **when `version.gradle` conflicts, keep ours.**

Rationale and mechanics:
- Every conflict exposes an "ours" stage, so `git checkout --ours -- version.gradle` keeps the local file. This covers both populations:
  - **New/empty repos**: unrelated histories → `version.gradle` present on both sides → `AA` ("both added") conflict.
  - **Established repos**: both sides modified it → `UU` ("both modified") conflict.
- Since the file is always present and differs on both sides, it always appears in `status.conflicted` and flows through `handleFile` (`MergeSkeleton.ts:123-128`). There is no clean-merge / silent-take path to handle under this assumption, so the `git checkout HEAD -- <file>` workaround discussed earlier is unnecessary.

Implementation (small):
- Seed `version.gradle` into the default `this.ours` set (e.g. a hardcoded `ALWAYS_OURS`), or short-circuit `handleFile` to force the `'ours'` decision for `version.gradle`.
- The existing apply path already does the right thing: `acceptDecisionsAndContinueMerge` runs `git checkout --ours <file>` + `git add` for "ours" files (`src/commands/repos/MergeSkeleton.ts:327-328`). For an `AA`/`UU` conflict `fileDescriptor.index` is `'A'`/`'U'` (not `'D'`) and the file is not in `status.created`, so control reaches that branch correctly.

Accepted limitation: this only acts on conflicts. A non-conflicting clean take of `version.gradle` would not be intercepted — but that scenario does not occur for these repos (the file is always modified on both sides), so it is an accepted, documented limitation rather than a gap.
