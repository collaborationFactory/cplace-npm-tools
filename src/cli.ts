#!/usr/bin/env node
/**
 * CLI entry point
 */
import * as meow from 'meow';
import {CommandRunner} from './commands';
import {Global} from './Global';

/* tslint:disable */
const cli = meow(`
    Usage:
        $ cplace-cli <command>

    Commands:
        release-notes (--from <from> [--to <to>] [--lang <lang>] [--force]) | (--check [--size <size>])
            Generates release notes between the two given commits (excluding <from>, including <to>).
            If <to> is not given "HEAD" is used.
            If <lang> is not given "en" is used.
            
            If <force> is set then release notes will also be generated if commits are commented out or in conflict.
            
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
            --update|-u [--nofetch] [--reset-to-remote]:
                Updates all parent repos.
                If <force> is set the update will take place even if the working copies of the parent repos are not clean.
                    WARNING: Uncommited changes WILL BE LOST.
                If <resetToRemote> is set then the update will do a hard reset in order to make sure the local copy
                matches the remote repository state.
                    WARNING: Committed but not pushed changes WILL BE LOST.
            --write|-w [--freeze]:
                Write the states of the parent repos to parent-repos.json.
                If <freeze> is set the exact commit hashes of the currently checked out parent repos will be written regardless
                whether there already was a commit hash in the descriptor or not.
                If <force> is set the update will take place even if the working copies of the parent repos are not clean.
            --clone|-c:
                Clones all parent repos if missing. <force> has no effect for this command.
            --branch|-b <name> [--parent <parent-repo-name>] [--push] [--from <branch-name>]
                Creates a new branch <name> on the topmost repo and all its child repos. All affected repos will checkout the new branch and their
                parent-repos.json will be updated to match the branch name. The topmost repo must be named 'main'. This can be overridden by providing
                the --parent parameter. If --push is provided, the new branches are pushed after creation.
                You can provide a remote-branch name using the --from <branch-name> parameter. This determines the remote branch based on which
                the new branches are created. If this parameter is missing, the local branches currently checked out are used.
            --add-dependency|-d <name> [--all]
                Adds a new dependency to another plugin or repository.
                If <name> is another sub-repository, the parent-repos.json will be updated to include this repository as a new dependency. If the
                flag --all is given then also all modules of this repository will be added to the IDEA project. 
                Otherwise <name> is treated as the name of a plugin and cplace-cli will try to resolve the corresponding IDEA module among all
                currently known referenced repositories. When --all is given, all dependencies of the plugin will also be added as dependencies.
        
        visualize [--regex-for-exclusion <regexForExclusion>] [--regex-for-inclusion <regexForInclusion>] [--pdf]
            Creates a visualization of the remote branches and their dependencies of the repository. The output is a .dot file.
            If <regexForExclusion> is not given "HEAD|attic/.*" is used. Use quotes if you want to use the | symbol.
            Use --pdf to create a PDF from the .dot file. Requires Graphviz to be installed and the dot binary to be on the path.


        flow --upmerge [--no-push] [--release <version>] [--all-customers | --customer <customer>] [--show-files]
            Merge changes upwards into all releases. This needs a clean workspace, however it will not touch your local
            branches. All merges will be done on new, temporary local branches and will then be pushed to 

            --no-push
                Will not push changes, dry run only to check for conflicts

            --release <version>
                Merge from this release version upwards (e.g. "4.38"). If not specified and the current branch is tracking
                a release branch, this release version will be used.
            
            --all-customers
                Also merges into all customer-branches. This applies to customer branches named 'customer/$customerName/$version', where
                $version must merge the pattern mentioned for --release.
            
            --customer <customer>
                Also merge into the branches of the given customer. The customer name must match the same pattern as mentioned in --all-customers.
            
            --show-files
                List files to be merged
                
        refactor <subcommand> --plugin|-p <plugin>
            Handles plugin specific refactorings where <subcommand> is one of the following:
            --test-sources
                Will refactor an old plugin source structure like 'src/classes' or 'src/java' to a proper Maven-like structure with
                'src/main/java' and 'src/test/java'

    Global options:
        --verbose
            Print verbose information to console
`, {
    flags: {
        release: {
            type: 'string'
        }
    }
});
/* tslint:enable */

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
                console.error('Could not execute given command:');
                console.error('\t', e);
                process.exit(1);
            }
        )
        .catch(
            (e) => {
                console.error('Could not execute given command:');
                console.error('\t', e);
                Global.isVerbose() && console.error(e.stack);
                process.exit(1);
            }
        );
}
