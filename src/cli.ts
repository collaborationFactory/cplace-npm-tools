#!/usr/bin/env node
/**
 * CLI entry point
 */
import * as meow from 'meow';
import {CommandRunner} from './commands';
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

            --update|-u [--nofetch] [--reset-to-remote] [--sequential]: Updates all parent repos.
                Tags instead of branches are supported in parent-repos.json by cplace-cli > 0.17.0 e.g.:
                "main": {
                  "url": "git@github.com:collaborationFactory/cplace.git",
                  "tag": "yourTag"
                },
                Please note: When using tags branches are created locally to avoid detached-head state. Those are
                not removed automatically.
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

            --write|-w [--freeze]:
                Write the states of the parent repos to parent-repos.json.
                If --freeze is set, then the exact commit hashes of the currently checked out parent repos will
                be written regardless whether there already was a commit hash in the descriptor or not.
                If --force is set, then the update will take place even if the working copies of the parent repos
                are not clean.

            --clone|-c [--depth <depth>] :
                Clones all parent repos if missing.
                If --depth is set to a positive integer, a shallow clone with a history truncated to the specified number of commits is created.
                The --depth parameter is ignored if a 'commit' is set to checkout in the parent repository.
                The --force setting has no effect for this command.

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
                process.exit(1);
            }
        );
}
