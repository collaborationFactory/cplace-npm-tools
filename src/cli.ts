#!/usr/bin/env node
/**
 * CLI entry point
 */
import * as meow from 'meow';
import {CommandRunner, UnknownCommandError} from './commands';
import {Global} from './Global';
import * as updateNotifier from 'update-notifier';
import * as fs from 'fs';
import * as path from 'path';
import hardRejection from 'hard-rejection';

const packageJsonContent = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8');
const packageJson = JSON.parse(packageJsonContent);

// Checks for available update on every startup
const notifier = updateNotifier({
                                    pkg: {
                                        name: packageJson.name,
                                        version: packageJson.version
                                    },
                                    updateCheckInterval: 0
                                });
notifier.notify();

// Register a handler for unhandled rejections, which gives an explanation to the user and kills the process.
// This call takes precedence over the default registration from meow because we call first.
hardRejection((stack) => {
    console.error('Internal error: Unhandled promise rejection! Aborting.');
    console.error(stack);
    // System.exit(1) will be called by hardRejection
});

// noinspection SpellCheckingInspection
const cli = meow(
    // helpMessage is wrapped to 120 characters
    /* tslint:disable:no-trailing-whitespace */
    `
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

            --update|-u [--nofetch] [--reset-to-remote] [--sequential] [--concurrency]: Updates all parent repos.
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
                If --concurrency is set to a positive integer (> 0) only that batch of parallel executed 'processes' are run at the same time.
                    This allows to circumvent possible limits of remote api calls. Use 0 or negative values for unlimited concurrency.
                    Ignored if If '--sequential' is set.
                    Default is 15.
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
                    If the current branch of the repository does not exist remotely, the command will fail. 
                    If the branch is a local only branch created during checking out a tag, the --latest-tag flag must be used                     
                    as well. Else the remote branch must be created first since the repo cannot be frozen to a non-existing 
                    branch. This would fail any other builds, locally for other developers and especially on CI/CD.
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
                      a) If a commit hash is already configured it will be preserved.
                      b) Else the parent repository will only have the branch configured.
                If --freeze and --latest-tag are set, --latest-tag takes precedence. If there is no tag found for the parent repository
                    the commit hash will be added if the repository is checked out.

            --clone|-c [--depth <depth>] [--sequential] [--concurrency]:
                Clones all parent repos if missing.
                If --depth is set to a positive integer, a shallow clone with a history truncated to the specified number of commits is created.
                The --depth parameter is ignored if a 'commit' is set to checkout in the parent repository.
                The --force setting has no effect for this command.
                If --sequential is set, then the repositories will be cloned one after another,
                    which takes longer but makes the verbose log easier to read.
                If --concurrency is set to a positive integer (> 0) only that batch of parallel executed 'processes' are run at the same time.
                    This allows to circumvent possible limits of remote api calls. Use 0 or negative values for unlimited concurrency.
                    Ignored if If '--sequential' is set.
                    Default is 15.
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

            --merge-skeleton|-m [--base-branch=<base-branch>] [--target-branch=<target-branch>] 
                                [--skeleton-branch=<skeleton-branch-name] [--ours=<file-name>] 
                                [--pull-request] [--push] [--interactive]:
                Merges a branch from the skeleton repo to the specified base branch, or to a specified target branch
                that will be branched from the base branch. A skeleton branch will be selected automatically based on 
                the cplace version. 
                If the merge is successful, the changes will be committed, but not pushed.
                If the merge was unsuccessful, fix the merge conflicts, add the changes with 'git add .' (without 
                commiting them) and run the same command again. The command will try to continue the merge.
                
                --base-branch - specifies to which base branch of the repo to merge the skeleton (ex: release/23.1). 
                --target-branch - if specified, this branch will be checked out from the base branch, and the skeleton 
                                  will be merged in it instead of the base branch. 
                                  The skeleton branch will be selected based on the cplace version from this branch.
                --skeleton-branch - if specified (ex. '--skeleton-branch=version/7.0'), this skeleton branch will
                                    be merged to the selected base/target branch, bypassing the automatic selection and 
                                    ignoring the compatibility with the current cplace version.
                --ours - specify a file to be automatically accepted as ours in case of a merge conflict.
                         For multiple files, use the parameter once per file 
                         ex: '--ours=README.md --ours=version.gradle'.
                --pull-request - creates a pull request if the merge was successful. This is only possible if a 
                                 target branch is specified with --target-branch and if that branch is not 
                                 already tracked.
                --push - if specified, the changes will be pushed to the target branch if the merge was successful
                --interactive - if specified, the command will ask for a decision for each newly added or conflicting file.
                                The choices provided are accept our (local) version, accept their (remote) version,
                                or leave the conflict to be resolved manually.

                ex: cplace-cli repos --merge-skeleton --base-branch=release/23.1 --push 
                    (merge auto detected skeleton version to release/23.1 and push to remote)

                    cplace-cli repos --merge-skeleton --base-branch=release/23.1 --target-branch=merge-skeleton --pull-request
                    (will checkout 'release/23.1', then checkout 'merge-skeleton' branch, merge auto detected skeleton version
                    and create a pull request if it was succesfull and 'merge-skeleton' is not a tracked branch)

            --migrate-artifact-groups
                The command makes several changes to the 'build.gradle' file and 'parent-repos.json', needed for
                migrating to automatic versions calculation and patch releases.
                1.  The property 'artifactGroup' will be added in the 'parent-repos.json' file for each repository.
                    The artifact groups are read from the root 'build.gradle' file. The 'build.gradle' file should
                    have a propper format of the 'cplaceRepositories' block for the command to be successfull:
                        cplaceRepositories {
                            repoName1 {
                                artifactGroup = 'group.id1'
                            }
                            repoName2 {
                                artifactGroup = 'group.id2'
                            }
                            ...
                        }
                2.  The 'useSnapshots' property will be added in the 'parent-repos.json' for each repository. 
                3.  The 'cplace' and 'cplaceRepositories' blocks will be removed from the 'build.gradle' file

            --validateBranches [--include <list of included fields | all>] [--exclude <list of excluded fields | all>]
                Validates the parent-repos.json files of all repositories of the integration/root repository to support finding unwanted differences.
                Prints a basic report to the terminal which contains the count of divergences by repository path, the conflicting repository paths and the dependency tree.
                Before running the validation, all expected repositories must be cloned and updated to the correct branches or tags.
                An include list or an exclude list allow to filter which fields of parent-repos.json are validated and part of the report.
                Allowed filters are: [all, url, branch, useSnapshot, artifactGroup, artifactVersion, tag, tagMarker, commit, description]
                When no include or exclude list is provided, the default exclude list is used: [url, useSnapshot, tagMarker, description].
                If both lists are provided the include list will be used.
                Items in the list are space separated, for example '--exclude "branch artifactGroup artifactVersion"'.
                Using the 'all'-filter:
                '--include all' validates and prints all fields.
                '--exclude all' does no validation but is useful to print the raw dependency structure of the parent repositories.
                Note that the data is only taken from the locally checked out files.

            --workflows [--list] [--add-workflows <names>] [--add-interactive] [--skeleton-branch <name>] [--force] [--dry-run]
                Manages GitHub Actions workflows from the skeleton repository.

                --list
                    List available workflows from skeleton repository with their current status

                --add-workflows <names>
                    Add specified workflows (space-separated list of workflow filenames)
                    Example: --add-workflows "ci.yml deploy.yml test.yml"

                --add-interactive
                    Interactive mode to select and add workflows using arrow keys and checkboxes
                    Supports --skeleton-branch to specify a different skeleton branch

                --skeleton-branch <name>
                    Override automatic branch detection and use specific skeleton branch

                --force
                    Skip conflict prompts and overwrite existing files

        visualize [--regex-for-exclusion <regexForExclusion>] [--regex-for-inclusion <regexForInclusion>] [--pdf]
            Creates a visualization of the remote branches and their dependencies of the repository.
            The output is a .dot file.
            If <regexForExclusion> is not given, then "HEAD|attic/.*" is used. Use quotes if you want to use
            the "|" or the "*" symbol, or any other character that may be interpreted by your shell.
            Use --pdf to create a PDF from the .dot file. Requires Graphviz to be installed and the dot binary to
            be on the path.

        flow --upmerge [--no-push] [--release <version>] [--all-customers | --customer <customer>] [--show-files] [--show-details]
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
            
            --show-details
                Shows commit details when 10 or fewer commits
                need merging, otherwise displays a summary grouped by author.

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
              

        version --rewrite-versions
            Rewrites versions in the version.gradle and parent-repos.json files for custom branches.
            This command helps manage versions for non-release branches by:
            1. Finding repositories with custom branches (non-release/master/main)
            2. Setting their version to major.minor.999 in version.gradle
            3. Updating artifactVersion in all parent-repos.json files
            4. Removing useSnapshot flag for affected repositories

    Global options:
        --verbose
            Print verbose information to console
`,
    /* tslint:enable:no-trailing-whitespace */
    {
        flags: {
            release: {
                type: 'string'
            }
        }
    }
);

if (!cli.input.length) {
    console.error('missing required parameter <command>');
    cli.showHelp();
} else {
    Global.parseParameters(cli.flags);

    Global.isVerbose() && console.log('input', cli.input, 'flags', cli.flags);

    CommandRunner
        .run(cli.input[0], cli.flags)
        .then(
            () => {
                // completed
                process.exit(0);
            },
            (e) => {
                console.error('Could not execute given command "' + cli.input[0] + '":');
                if (e instanceof Error) {
                    console.error('\t' + e.message);
                    Global.isVerbose() && console.error(e.stack);
                } else {
                    // the promise can reject with a string
                    console.error('\t' + e);
                }

                // Only show help for unknown command errors
                if (e instanceof UnknownCommandError) {
                    cli.showHelp();
                }

                process.exit(1);
            }
        );
}
