/**
 * Version management command using Commander.js
 */
import { Command } from 'commander';
import { Global, ICommandParameters } from '@cplace-cli/core';
import { RewriteVersions } from './RewriteVersions.js';

export function createVersionCommand(): Command {
    const version = new Command('version');
    
    version
        .description('Version management operations for cplace repositories')
        .option('--rewrite-versions', 'Rewrite versions to .999 pattern for custom branches')
        .action(async (options) => {
            Global.isVerbose() && console.log('Version command:', options);
            
            if (options.rewriteVersions) {
                const params: ICommandParameters = {
                    rewriteVersions: true
                };
                
                try {
                    const rewriteCommand = new RewriteVersions();
                    if (rewriteCommand.prepareAndMayExecute(params)) {
                        await rewriteCommand.execute();
                    }
                } catch (error) {
                    console.error('Rewrite versions failed:', error);
                    process.exit(1);
                }
            } else {
                console.error('No version command specified. Use --help for available options.');
                process.exit(1);
            }
        });
    
    return version;
}