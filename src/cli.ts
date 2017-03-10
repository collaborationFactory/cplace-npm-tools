#!/usr/bin/env node
/**
 * CLI entry point
 */
import * as meow from 'meow';
import {CommandRunner} from './commands';
import {Global} from './Global';

const cli = meow(`
    Usage:
        $ cplace-cli <command>
       
    Commands:
        release-notes --from <from> [--to <to>] [--lang <lang>]
            Generates release notes between the two given commits (excluding <from>, including <to>).
            If <to> is not given "HEAD" is used.
            If <lang> is not given "en" is used.
            
            The release notes command can also be used to automatically merge two messages files in git:
            1. Add the following section to your .git/config file or global .gitconfig:
                [merge "cplace-msgs"]
                    name = cplace Release Notes Messages DB merger
                    driver = cplace-cli release-notes --merge --current %A --other %B
            2. Make sure that the .gitattributes file in your repository contains the following line:
                release-notes/messages_*.db merge=cplace-msgs
        
        repos <subcommand> [--force]
            Handles repo specific actions where <subcommand> is one of the following:
            1. --update|-u [--nofetch]:
                Updates all parent repos.
                If <force> is set, the update will take place even if the working copies of the parent repos are not clean.                
            2. --write|-w:
                Write the states of the parent repos to parent-repos.json.
                If <force> is set, the update will take place even if the working copies of the parent repos are not clean.

    Global options:
        --verbose
            Print verbose information to console
`);

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
            },
            (e) => {
                console.error('Could not execute given command:');
                console.error('\t', e);
            }
        )
        .catch(
            (e) => {
                console.error('Could not execute given command:');
                console.error('\t', e);
                Global.isVerbose() && console.error(e.stack);
            }
        );
}
