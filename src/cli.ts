#!/usr/bin/env node
/**
 * CLI entry point
 */
import * as meow from 'meow';
import {CommandRunner} from './commands';

const FLAG_VERBOSE = 'verbose';

const cli = meow(`
    Usage:
        $ cplace-cli <command>
       
    Commands:
        release-notes --from <from> [--to <to>] [--lang <lang>]
            Generates release notes between the two given commits (excluding <from>, including <to>).
            If <to> is not given "HEAD" is used.
            If <lang> is not given "en" is used.
             
    Global options:
        --${FLAG_VERBOSE}
            Print verbose information to console
`);

if (!cli.input.length) {
    console.error('missing required parameter <command>');
    cli.showHelp();
} else {
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
                if (cli.flags[FLAG_VERBOSE]) {
                    console.error(e.stack);
                }
            }
        );
}
