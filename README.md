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

    Usage:
        $ cplace-cli <command>

    Commands:
        release-notes (--from <from> [--to <to>] [--lang <lang>] [--force]) | (--check [--size <size>])
            Generates release notes for a given release or between the two given commits (excluding <from>, including <to>).
            If <to> is not given "HEAD" is used.
            If <lang> is not given "en" is used.

            --release <version>
                Create release notes for commits between the head of the release Branch for the given release 
                and the head of the predecessor release branch.
                (Release takes precedence over --from / --to mode)
            
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

        repos <subcommand> [--force]
            Handles repo specific actions where <subcommand> is one of the following:

            --update|-u [--nofetch] [--reset-to-remote] [--sequential]: Updates all parent repos.
                Tags instead of branches are supported in parent-repos.json by cplace-cli > 0.17.0 e.g.:
                "main": {
                  "url": "git@github.com:collaborationFactory/cplace.git",
                  "tag": "yourTag"
                },
                Please note: When using tags branches are created locally to avoid detached-head state. Those are
                not removed automatically. The branch name starts with 'release-version/' followed by the version.
                If --force is set, then the update will take place even if the working copies of the parent repos are
                    not clean.
                    WARNING: Uncommitted changes WILL BE LOST.
                If --reset-to-remote is set, then the update will do a hard reset in order to make sure the local copy
                    matches the remote repository state.
                    WARNING: Committed but not pushed changes WILL BE LOST.
                If --nofetch is set, then the repositories will not be fetched, meaning that the current version of each
                    branch will be checked out.
                If --sequential is set, then the repositories will be updated one after another,
                    which takes longer but makes the verbose log easier to read.
                Update behavior:
                1. If a tag is configured for the parent repository it is updated to that tag,
                2. Else if a commit hash is configured, the repository is updated to that commit.
                3. Else if on a release branch (where the name follows the pattern 'release/$MAJOR.$MINOR)',
                   the latest tag associated with that branch will be looked up in the remote repository and it will be updated to that latest tag.
                   Note: if a 'tagMarker' is configured, the version of the latest tag must be newer (greater) or equal to the tag marker.
                4. Else if there is no such tag or if on a feature/customer branch, it is updated to the HEAD of the remote branch.
                5. If 'useSnapshot' is true for the parent repository, it is updated to the HEAD of the remote branch.
                6. If no branch and no tag is configured the update will fail.

            --write|-w [--freeze] [--un-freeze] [--latest-tag]:
                Write the states of the parent repos to parent-repos.json. If a commit has been configured it will be updated
                to the current state of the parent repository.
                If --freeze is set, then the exact commit hashes of the currently checked out parent repos will
                    be written regardless whether there already was a commit hash in the descriptor or not.
                If --un-freeze is set, the parent-repos.json will be cleaned up. That is: configured tags, tagMarkers or commit hashes are removed.
                    Other command flags will be ignored.
                If --force is set, then an update to the commit hashes (as with --freeze) will take place even if the working copies of the parent repos
                    are not clean.
                If --latest-tag is set, the cplace-cli will update the parent repositories as follows: 
                   1. If a tag was already configured for the repository it will be preserved.
                   2. Else if the checked out branch name starts with 'release-version/' (the pattern for the local tag branch name),
                      the tag will be derived from the branch name.
                   3. Else if on a release branch (where the name follows the pattern 'release/$MAJOR.$MINOR)',
                      the latest tag associated with that branch will be looked up in the remote repository.
                      Additionally, a 'tagMarker' will be added to define the included lower bound of the version. 
                   4. Else if there is no such tag or if on a feature/customer branch:
                      a) If a commit hash is already configurd it will be updated to the currently checked out parent repositories commit hash .
                      b) Else the parent repository will only have the branch configured.
                If --freeze and --latest-tag are set, --latest-tag takes precedence. If there is no tag found for the parent repository
                    the commit hash will always be added.

            --clone|-c [--depth <depth>] :
                Clones all parent repos if missing.
                If --depth is set to a positive integer, a shallow clone with a history truncated to the specified number of commits is created.
                The --depth parameter is ignored if a 'commit' is set to checkout in the parent repository.
                The --force setting has no effect for this command.
                Clone behavior:
                1. If a tag is configured for the parent repository it is cloned on that tag,
                2. Else if a commit hash is configured, the repository is cloned to the HEAD of the branch. The specific commit needs to be checked
                   out with the cplace-cli update command. --depth is ignored in that case.
                3. Else if on a release branch (where the name follows the pattern 'release/$MAJOR.$MINOR)',
                   the latest tag associated with that branch will be looked up in the remote repository and checked out.
                   Note: if a 'tagMarker' is configured, the version of the latest tag must be newer (greater) or equal to the tag marker.
                4. Else if there is no such tag or if on a feature/customer branch, the HEAD of the branch is cloned.
                5. If 'useSnapshot' is true for the parent repository, the HEAD of the branch is cloned regradless of any other configuration.
                6. If no branch is configured (not recommended), the default branch will be cloned.

            --branch|-b <name> [--parent <parent-repo-name>] [--push] [--from <branch-name>]
                Creates a new branch <name> on the topmost repo and all its child repos. All affected repos will
                checkout the new branch and their parent-repos.json will be updated to match the branch name.
                The topmost repo must be named 'main'. This can be overridden by providing the --parent parameter.
                If --push is set, then the new branches are pushed after creation.
                You can provide a remote-branch name using the --from <branch-name> parameter. This determines the
                remote branch based on which the new branches are created. If this parameter is missing, the local
                branches currently checked out are used.

            --add-dependency|-d <name> [--all]
                Adds a new dependency to another plugin or repository.
                If <name> is another sub-repository, the parent-repos.json will be updated to include this repository
                as a new dependency.
                If --all is set, then also all modules of this repository will be added to the IDEA project.
                Otherwise <name> is treated as the name of a plugin and cplace-cli will try to resolve the
                corresponding IDEA module among all currently known referenced repositories.
                If --all is set, then all dependencies of the plugin will also be added as dependencies.

            --merge-skeleton|-m [--target-branch=<target-branch-name>] [--skeleton-branch=<skeleton-branch-name]
                                [--ours=<file-name>] [--pull-request] [--push]:
                Merges a branch from the skeleton repo to the current branch or to the specified target branch.
                If no options are specified, the current branch is used as a target branch. A skeleteon branch 
                will be selected automatically based on the cplace version. If the merge is successful, 
                the changes will be committed, but not pushed.
                
                --target-branch - if specified, this branch will be checked out and the skeleton will be merged 
                                  in it. The skeleton branch will be selected based on the cplace version from
                                  this branch.
                --skeleton-branch - if specified (ex. '--skeleton-branch=version/7.0'), this skeleton branch will
                                    be merged to the selected target branch, bypassing the automatic selection and 
                                    ignoring the compatibility with the current cplace version.
                --ours - specify a file to be automatically accepted as ours in case of a merge conflict.
                         For multiple files, use the parameter once per file 
                         ex: '--ours=README.md --ours=version.gradle'.
                --pull-request - creates a pull request if the merge was successful. This is only possible if the 
                                 target branch (currently checked out or specified with --target-branch) is not 
                                 already tracked.
                --push - if specified, the changes will be pushed to the target branch if the merge was successful

        visualize [--regex-for-exclusion <regexForExclusion>] [--regex-for-inclusion <regexForInclusion>] [--pdf]
            Creates a visualization of the remote branches and their dependencies of the repository.
            The output is a .dot file.
            If <regexForExclusion> is not given, then "HEAD|attic/.*" is used. Use quotes if you want to use
            the "|" or the "*" symbol, or any other character that may be interpreted by your shell.
            Use --pdf to create a PDF from the .dot file. Requires Graphviz to be installed and the dot binary to
            be on the path.

        flow --upmerge [--no-push] [--release <version>] [--all-customers | --customer <customer>] [--show-files]
            Merge changes upwards into all releases. This needs a clean workspace, however it will not touch your
            local branches. All merges will be done on new, temporary local branches and will then be pushed.

            --no-push
                Will not push changes, dry run only to check for conflicts

            --release <version>
                Merge from this release version upwards (e.g. "4.38"). If not specified and the current branch is
                tracking a release branch, this release version will be used.

            --all-customers
                Also merges into all customer-branches. This applies to customer branches named
                'customer/$customerName/$version', where $version must merge the pattern mentioned for --release.

            --customer <customer>
                Also merge into the branches of the given customer. The customer name must match the same pattern
                as mentioned in --all-customers.

            --show-files
                List files to be merged

        refactor <subcommand> --plugin|-p <plugin>
            Handles plugin specific refactorings where <subcommand> is one of the following:
            --test-sources
                Will refactor an old plugin source structure like 'src/classes' or 'src/java' to a proper Maven-like
                structure with 'src/main/java' and 'src/test/java'

        e2e [--baseUrl <baseUrl>] [--context <context>] [--tenantId <tenantId>] [--e2eToken <token>]
            [--browser <browser>] [--plugins <plugins>] [--specs <specs>] [--timeout <timeout>] [--headless]
            [--noInstall] [--jUnit <?reportsPath>] [--screenshot <?screenshotPath>] [--allure <?allureOutputPath>]

            --baseUrl to configure where to run the tests against (default: 'http://localhost:8083')
            --context to define in which context cplace is running (default: '/intern/tricia/')
            --tenantId to define against which tenant the tests are run (default: '' single tenant mode)
            --e2eToken to define the Test Setup Handler E2E token (default: '')
            --browser to specify which browser to use (default: Chrome)
            --plugins to specify a comma separated list of plugins to run tests for
              (default: all plugins in the current repository)
            --specs to specify the pattern used to search for specification files inside plugins
              (default: '**/*.spec.ts')
            --timeout to specify a global Timeout for Test Execution
            --headless currently only possible in Chrome and Firefox
            --noInstall will skip the check for new Selenium Drivers (required to run offline, default: false)
            --jUnit will create jUnit reports and allows you to specify the location where the reports are stored
              (default: './e2eJunitReports')
            --screenshot will create Screenshots on each failed Test and store them in given path
              (default: './e2eScreenshots')
            --allure will create Allure Reporter output files and store them in the given path
              (default: './allure-output')
            --logLevel will adjust the logLevel in wdio configuraiton
              (default: 'error', supported options: 'trace | debug | info | warn | error | silent')
            --specFileRetries The number of times to retry the entire specfile when it fails as a whole
              (default: 0)
            --chromeDriverVersion will adjust the version of the Chrome driver
              (default: latest version)

    Global options:
        --verbose
            Print verbose information to console
```

## Development

Before you can work with the repository, you need to install node modules once:

```bash
npm install
```

Typescript is compiled and linted by running:

```bash
npm run dev
```

This will execute both tslint (`npm run dev:lint`) as well as run the Typescript compiler (`npm run dev:tsc`).

To test your local changes with `cplace-cli` on the command line you have to `link` your local npm package by running:

```bash
npm link
```

This will first recompile the Typescript sources and do the linting before setting up and linking the binary executable.
When `npm link` is completed, you can just use `cplace-cli` as usual to test it out.
When the installation failed because `cplace-cli` was already installed, you can either remove it by running `npm r -g @cplace/cli`, or run `npm link --force`.

> Remember to clean your local linked package after testing by running `npm r -g @cplace/cli` to remove it and do a regular install again (`npm i -g @cplace/cli`).

To execute the available unit tests run:

```bash
npm run test
```

## Publishing a new version

To publish a new version on the NPM registry take the following steps:

1. Manually bump the version number in `package.json` as desired (major / minor / patch).
2. Push the update to GitHub.
3. Create a new Release on GitHub:
   1. Create _a new tag_ matching the version you want to publish, e.g. `v0.20.3`.
   2. Put in the proper release notes as description of the Release.
4. On creating the Release (_not as a draft_) the GitHub workflow will run and publish the package to NPM automatically.
