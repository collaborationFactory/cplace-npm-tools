#!/usr/bin/env node
/**
 * CLI entry point using Commander.js
 */
import { Command } from 'commander';
import { Global } from '@cplace-cli/core';
import { createReposCommand } from '@cplace-cli/command-repos';
import updateNotifier from 'update-notifier';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version and update notifications
const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
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

// Create the main program
const program = new Command();

program
    .name('cplace-cli')
    .description('cplace CLI tools for repository management, release notes, and more')
    .version(packageJson.version)
    .option('-v, --verbose', 'Enable verbose output');

// Global options handler
program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    Global.parseParameters(opts);
});

// Placeholder commands - these will be replaced with actual command implementations
program
    .command('release-notes')
    .description('Generate and manage release notes')
    .option('--from <from>', 'Start commit')
    .option('--to <to>', 'End commit (default: HEAD)')
    .option('--lang <lang>', 'Language (default: en)')
    .option('--force', 'Force generation even with conflicts')
    .option('--check', 'Check message format')
    .option('--size <size>', 'Number of commits to check (default: 100)', '100')
    .action(async (options) => {
        console.log('Release notes command with options:', options);
        console.log('This command will be implemented in the migration phase.');
    });

// Add the repos command
program.addCommand(createReposCommand());

program
    .command('flow')
    .description('Merge flow operations')
    .option('--upmerge', 'Merge changes upwards')
    .option('--no-push', 'Don\'t push changes (dry run)')
    .option('--release <version>', 'Release version to merge from')
    .action(async (options) => {
        console.log('Flow command with options:', options);
        console.log('This command will be implemented in the migration phase.');
    });

program
    .command('visualize')
    .description('Create branch dependency visualization')
    .option('--regex-for-exclusion <regex>', 'Regex for exclusion (default: HEAD|attic/.*)')
    .option('--regex-for-inclusion <regex>', 'Regex for inclusion')
    .option('--pdf', 'Create PDF output')
    .action(async (options) => {
        console.log('Visualize command with options:', options);
        console.log('This command will be implemented in the migration phase.');
    });

program
    .command('version')
    .description('Version management operations')
    .option('--rewrite-versions', 'Rewrite versions for custom branches')
    .action(async (options) => {
        console.log('Version command with options:', options);
        console.log('This command will be implemented in the migration phase.');
    });

// Error handling
program.exitOverride();

try {
    await program.parseAsync();
} catch (err: any) {
    if (err.code === 'commander.unknownCommand') {
        console.error(`Unknown command: ${err.message}`);
        program.help();
    } else if (err.code === 'commander.help') {
        // Help was displayed, exit gracefully
        process.exit(0);
    } else {
        console.error('Error:', err.message);
        if (Global.isVerbose()) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}