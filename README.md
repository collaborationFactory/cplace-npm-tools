# Document Control / Repository Information

| Item         | Value                                             |
|--------------|---------------------------------------------------|
| Owner        | Christian Kaltenbach, Vladimir Arsov              |
| Team         | none yet                                          |
| Project      | none                                              |
| Parent       | none                                              |
| Developed by | collaboration Factory AG                          |
| Description  | Our commandline utility to work with cplace code  |

# cplace CLI tools

![](https://github.com/collaborationFactory/cplace-npm-tools/workflows/Continuous%20Integration/badge.svg)

This package provides some CLI tools for working with cplace code.

## Usage

To install `cplace-cli` run the following command:

```bash
npm install -g @cplace/cli
```

After installation, you can just execute:

```bash
cplace-cli --help
```

to get the available commands and help:

```text
$  cplace-cli --help

Usage: cplace-cli [options] [command]

cplace CLI tools for repository management, release notes, and more

Options:
  -V, --version            output the version number
  -v, --verbose            Enable verbose output
  -h, --help               display help for command

Commands:
  release-notes [options]  Generate and manage release notes
  repos [options]          Repository operations for managing parent repositories
  flow [options]           Merge flow operations
  visualize [options]      Create branch dependency visualization
  version [options]        Version management operations
  help [command]           display help for command
```

### Release Notes Command

Generate release notes for a given release or between two commits:

```bash
cplace-cli release-notes --from <from> [--to <to>] [--lang <lang>] [--force]
cplace-cli release-notes --check [--size <size>]
cplace-cli release-notes --release <version>
```

**Options:**
- `--from <from>` - Starting commit (excluded from results)
- `--to <to>` - Ending commit (included in results). Defaults to "HEAD"
- `--lang <lang>` - Language for release notes. Defaults to "en"
- `--release <version>` - Create release notes for specific release version
- `--docs` - Store release notes as markdown in documentation/changelog/_index.md
- `--force` - Generate even if commits are commented out or in conflict
- `--check` - Check commit messages without generating notes
- `--size <size>` - Number of commits to check (default: 100)
            
            --docs
                Stores release notes as markdown in folder documentation/changelog/_index.md so that it can 
                be published to cplace documentation
                  
            If --force is set then release notes will also be generated if commits are commented out or in conflict.

            If --check is set then no release notes will be generated but the last <size> (default: 100) commits
            will be checked for message, i.e. the command will fail if the last <size> commits contain any messages
            that are not contained in all messages files or at least one entry in a messages file is commented out
            or in conflict.

            The release notes command can also be used to automatically merge two messages files in git:
            1. Add the following section to your .git/config file or global .gitconfig:
                [merge "cplace-msgs"]
                    name = cplace Release Notes Messages DB merger
                    driver = cplace-cli release-notes --merge --current %A --other %B --base %O
            2. Make sure that the .gitattributes file in your repository contains the following lines:
                release-notes/messages_*.db merge=cplace-msgs
                release-notes/explicits_*.db merge=cplace-msgs

### Repository Management Commands

The `repos` command provides comprehensive repository management capabilities:

```bash
cplace-cli repos [options] [command]
```

**Global Options:**
- `--force` - Force operation even if working copy is not clean
- `--sequential` - Run operations sequentially instead of in parallel  
- `--concurrency <number>` - Limit parallel execution concurrency (default: 15)

#### Update Repositories

```bash
cplace-cli repos update [options]
cplace-cli repos u [options]  # alias
```

**Options:**
- `--nofetch` - Do not fetch repositories
- `--reset-to-remote` - Hard reset to match remote repository state

Updates all parent repos. Tags instead of branches are supported in parent-repos.json by cplace-cli > 0.17.0 e.g.:
```json
"main": {
  "url": "git@github.com:collaborationFactory/cplace.git",
  "tag": "yourTag"
}
```

**Important Notes:**
- When using tags, branches are created locally to avoid detached-head state. Those are not removed automatically. The branch name starts with 'release-version/' followed by the version.
- If `--force` is set, the update will take place even if the working copies of the parent repos are not clean. **WARNING: Uncommitted changes WILL BE LOST.**
- If `--reset-to-remote` is set, the update will do a hard reset to make sure the local copy matches the remote repository state. **WARNING: Committed but not pushed changes WILL BE LOST.**
- If `--nofetch` is set, repositories will not be fetched, meaning the current version of each branch will be checked out.

**Update behavior:**
1. If a tag is configured for the parent repository it is updated to that tag
2. Else if a commit hash is configured, the repository is updated to that commit
3. Else if on a release branch (where the name follows the pattern 'release/$MAJOR.$MINOR'), the latest tag associated with that branch will be looked up in the remote repository and it will be updated to that latest tag
4. Else if there is no such tag or if on a feature/customer branch, it is updated to the HEAD of the remote branch
5. If 'useSnapshot' is true for the parent repository, it is updated to the HEAD of the remote branch
6. If no branch and no tag is configured the update will fail

#### Write Repository States

```bash
cplace-cli repos write [options]
cplace-cli repos w [options]  # alias
```

**Options:**
- `--freeze` - Write exact commit hashes of currently checked out parent repos
- `--un-freeze` - Clean up parent-repos.json by removing configured tags, tagMarkers or commit hashes
- `--latest-tag` - Update parent repositories with latest tag information

Write the states of the parent repos to parent-repos.json. If a commit has been configured it will be updated to the current state of the parent repository.

**Behavior with options:**
- If `--freeze` is set, the exact commit hashes of the currently checked out parent repos will be written regardless whether there already was a commit hash in the descriptor or not
- If `--un-freeze` is set, the parent-repos.json will be cleaned up. That is: configured tags, tagMarkers or commit hashes are removed. Other command flags will be ignored
- If `--latest-tag` is set, the cplace-cli will update the parent repositories as follows:
  1. If a tag was already configured for the repository it will be preserved
  2. Else if the checked out branch name starts with 'release-version/' (the pattern for the local tag branch name), the tag will be derived from the branch name
  3. Else if on a release branch (where the name follows the pattern 'release/$MAJOR.$MINOR'), the latest tag associated with that branch will be looked up in the remote repository. Additionally, a 'tagMarker' will be added to define the included lower bound of the version
  4. Else if there is no such tag or if on a feature/customer branch:
     - If a commit hash is already configured it will be preserved
     - Else the parent repository will only have the branch configured

If `--freeze` and `--latest-tag` are set, `--latest-tag` takes precedence. If there is no tag found for the parent repository the commit hash will be added if the repository is checked out.

#### Clone Repositories

```bash
cplace-cli repos clone [options]
cplace-cli repos c [options]  # alias
```

**Options:**
- `--depth <depth>` - Create shallow clone with history truncated to specified number of commits

Clones all parent repos if missing. If `--depth` is set to a positive integer, a shallow clone with a history truncated to the specified number of commits is created. The `--depth` parameter is ignored if a 'commit' is set to checkout in the parent repository.

**Clone behavior:**
1. If a tag is configured for the parent repository it is cloned on that tag
2. Else if a commit hash is configured, the repository is cloned to the HEAD of the branch. The specific commit needs to be checked out with the cplace-cli update command. `--depth` is ignored in that case
3. Else if on a release branch (where the name follows the pattern 'release/$MAJOR.$MINOR'), the latest tag associated with that branch will be looked up in the remote repository and checked out
4. Else if there is no such tag or if on a feature/customer branch, the HEAD of the branch is cloned
5. If 'useSnapshot' is true for the parent repository, the HEAD of the branch is cloned regardless of any other configuration
6. If no branch is configured (not recommended), the default branch will be cloned

#### Create Branches

```bash
cplace-cli repos branch <name> [options]
cplace-cli repos b <name> [options]  # alias
```

**Options:**
- `--parent <parent-repo-name>` - Override the topmost repo name (default: 'main')
- `--push` - Push the new branches after creation
- `--from <branch-name>` - Specify remote branch name to base new branches on

Creates a new branch `<name>` on the topmost repo and all its child repos. All affected repos will checkout the new branch and their parent-repos.json will be updated to match the branch name.

The topmost repo must be named 'main'. This can be overridden by providing the `--parent` parameter. If `--push` is set, then the new branches are pushed after creation. You can provide a remote-branch name using the `--from <branch-name>` parameter. This determines the remote branch based on which the new branches are created. If this parameter is missing, the local branches currently checked out are used.

#### Add Dependencies

```bash
cplace-cli repos add-dependency <name> [options]
cplace-cli repos d <name> [options]  # alias
```

**Options:**
- `--all` - Add all modules of the repository to the IDEA project, or all dependencies of the plugin

Adds a new dependency to another plugin or repository. If `<name>` is another sub-repository, the parent-repos.json will be updated to include this repository as a new dependency.

If `--all` is set, then also all modules of this repository will be added to the IDEA project. Otherwise `<name>` is treated as the name of a plugin and cplace-cli will try to resolve the corresponding IDEA module among all currently known referenced repositories. If `--all` is set, then all dependencies of the plugin will also be added as dependencies.

#### Merge Skeleton

```bash
cplace-cli repos merge-skeleton [options]
cplace-cli repos ms [options]  # alias
```

**Options:**
- `--base-branch <branch>` - Specify base branch to merge skeleton into (e.g., release/23.1)
- `--target-branch <branch>` - Create and checkout this branch from base branch for merge
- `--skeleton-branch <branch>` - Specify skeleton branch to merge (bypasses automatic selection)
- `--ours <files...>` - Specify files to automatically accept as ours in merge conflicts
- `--pull-request` - Create a pull request after successful merge (requires --target-branch)
- `--push` - Push changes to target branch after successful merge
- `--interactive` - Ask for decision on each newly added or conflicting file

Merges a branch from the skeleton repo to the specified base branch, or to a specified target branch that will be branched from the base branch. A skeleton branch will be selected automatically based on the cplace version.

If the merge is successful, the changes will be committed, but not pushed. If the merge was unsuccessful, fix the merge conflicts, add the changes with 'git add .' (without committing them) and run the same command again. The command will try to continue the merge.

**Option details:**
- `--base-branch` - specifies to which base branch of the repo to merge the skeleton (ex: release/23.1)
- `--target-branch` - if specified, this branch will be checked out from the base branch, and the skeleton will be merged in it instead of the base branch. The skeleton branch will be selected based on the cplace version from this branch
- `--skeleton-branch` - if specified (ex. '--skeleton-branch=version/7.0'), this skeleton branch will be merged to the selected base/target branch, bypassing the automatic selection and ignoring the compatibility with the current cplace version
- `--ours` - specify a file to be automatically accepted as ours in case of a merge conflict. For multiple files, use the parameter once per file (ex: '--ours=README.md --ours=version.gradle')
- `--pull-request` - creates a pull request if the merge was successful. This is only possible if a target branch is specified with --target-branch and if that branch is not already tracked
- `--push` - if specified, the changes will be pushed to the target branch if the merge was successful
- `--interactive` - if specified, the command will ask for a decision for each newly added or conflicting file. The choices provided are accept our (local) version, accept their (remote) version, or leave the conflict to be resolved manually

**Examples:**
```bash
# Merge auto detected skeleton version to release/23.1 and push to remote
cplace-cli repos merge-skeleton --base-branch=release/23.1 --push

# Checkout 'release/23.1', then checkout 'merge-skeleton' branch, merge auto detected skeleton version
# and create a pull request if successful and 'merge-skeleton' is not a tracked branch
cplace-cli repos merge-skeleton --base-branch=release/23.1 --target-branch=merge-skeleton --pull-request
```

#### Migrate Artifact Groups

```bash
cplace-cli repos migrate-artifact-groups
cplace-cli repos mag  # alias
```

Migrates artifact groups in the repository configuration.

#### Validate Branches

```bash
cplace-cli repos validate-branches [options]
cplace-cli repos vb [options]  # alias
```

**Options:**
- `--include <filters>` - Include branches matching these filters
- `--exclude <filters>` - Exclude branches matching these filters

Validates the consistency and integrity of repository branches based on the specified inclusion and exclusion filters.

### Flow Command

Merge changes upwards into all releases:

```bash
cplace-cli flow --upmerge [options]
```

**Options:**
- `--no-push` - Will not push changes, dry run only to check for conflicts
- `--release <version>` - Merge from this release version upwards (e.g. "4.38")
- `--all-customers` - Also merges into all customer-branches
- `--customer <customer>` - Also merge into the branches of the given customer
- `--show-files` - List files to be merged
- `--show-details` - Shows commit details when 10 or fewer commits need merging

Merge changes upwards into all releases. This needs a clean workspace, however it will not touch your local branches. All merges will be done on new, temporary local branches and will then be pushed.

If `--release <version>` is not specified and the current branch is tracking a release branch, this release version will be used. The `--all-customers` option applies to customer branches named 'customer/$customerName/$version', where $version must match the pattern mentioned for --release. The `--customer <customer>` option allows merging into branches of a specific customer following the same pattern.

### Visualize Command

Create visualization of remote branches and their dependencies:

```bash
cplace-cli visualize [options]
```

**Options:**
- `--regex-for-exclusion <regexForExclusion>` - Regex pattern for branches to exclude (default: "HEAD|attic/.*")
- `--regex-for-inclusion <regexForInclusion>` - Regex pattern for branches to include
- `--pdf` - Create a PDF from the .dot file (requires Graphviz)

Creates a visualization of the remote branches and their dependencies of the repository. The output is a .dot file. Use quotes if you want to use the "|" or the "*" symbol, or any other character that may be interpreted by your shell.

### Version Command

Version management operations:

```bash
cplace-cli version [options]
```

Provides version management utilities for the cplace project.

### Refactor Command

Plugin-specific refactoring operations:

```bash
cplace-cli refactor <subcommand> --plugin|-p <plugin>
```

**Subcommands:**
- `--test-sources` - Refactor old plugin source structure like 'src/classes' or 'src/java' to proper Maven-like structure with 'src/main/java' and 'src/test/java'
```

## Development

This project uses a **monorepo architecture** with **Nx** as the build system and **npm workspaces** for package management.

### Prerequisites

- **Node.js v22.12.0** (use `nvm use` to switch to the correct version)
- npm (included with Node.js)

### Project Structure

```
cplace-npm-tools/
├── packages/
│   ├── cli/                          # Main CLI entry point
│   ├── core/                         # Shared core functionality  
│   ├── git-utils/                    # Git operations and Repository class
│   ├── helpers/                      # Shared utility functions
│   └── command-repos/                # Repository management commands
├── test/                            # Legacy integration tests
└── documentation/                   # Project documentation
```

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development build (lint + compile):**
   ```bash
   npm run dev
   ```
   This runs ESLint (`npm run dev:lint`) and compiles TypeScript (`npm run dev:tsc`).

3. **Clean build artifacts:**
   ```bash
   npm run clean
   ```

4. **Full build:**
   ```bash
   npm run build
   ```

### Local Testing

To test your local changes:

```bash
npm run link
```

This will:
1. Clean previous builds
2. Run development build (lint + compile)
3. Link the CLI globally for testing

After linking, test with:
```bash
cplace-cli --help
```

**Clean up after testing:**
```bash
npm r -g @cplace/cli
```

### Testing

Run all tests:
```bash
npm test
```

The project uses **Jest** with **ts-jest** for TypeScript support and is configured for the monorepo structure with:
- Package-specific test configurations
- Module name mapping for `@cplace-cli/*` imports
- Extended timeout (1000s) for integration tests

### Package Development

Each package has its own:
- `package.json` with dependencies
- `tsconfig.json` for TypeScript configuration  
- `jest.config.cjs` for testing configuration

**Build individual packages:**
```bash
nx build @cplace-cli/core
nx build @cplace-cli/git-utils
```

## Publishing a new version

To publish a new version on the NPM registry take the following steps:

1. Manually bump the version number in `package.json` as desired (major / minor / patch).
2. Push the update to GitHub.
3. Create a new Release on GitHub:
   1. Create _a new tag_ matching the version you want to publish, e.g. `v0.20.3`.
   2. Put in the proper release notes as description of the Release.
4. On creating the Release (_not as a draft_) the GitHub workflow will run and publish the package to NPM automatically.
