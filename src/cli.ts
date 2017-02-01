#!/usr/bin/env node
/**
 * CLI entry point
 */
import * as meow from 'meow';

const cli = meow(`
    Usage:
        $ cplace-cli <command>
       
    Commands:
        release-notes <from> <to>:
            Generates release notes between the two given commits (excluding <from>, including <to>). 
`);

if (!cli.input.length) {
    console.error('missing required parameter <command>');
    cli.showHelp();
} else {
    console.log(cli.input[0]);
}
