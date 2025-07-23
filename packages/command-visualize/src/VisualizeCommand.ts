/**
 * Branch visualization command using Commander.js
 */
import { Command } from 'commander';
import { Global } from '@cplace-cli/core';
import { Visualize } from './Visualize.js';

export function createVisualizeCommand(): Command {
    const visualize = new Command('visualize');
    
    visualize
        .description('Create branch dependency visualization')
        .option('--regex-for-exclusion <regex>', 'Regex for excluding branches', 'HEAD|attic/.*')
        .option('--regex-for-inclusion <regex>', 'Regex for including branches', '')
        .option('--pdf', 'Generate PDF output instead of DOT file')
        .action(async (options) => {
            Global.isVerbose() && console.log('Visualize command options:', options);
            
            try {
                const visualizer = new Visualize({
                    regexForExclusion: options.regexForExclusion,
                    regexForInclusion: options.regexForInclusion,
                    pdf: options.pdf
                });
                
                await visualizer.execute();
            } catch (error) {
                console.error('Visualization failed:', error);
                if (Global.isVerbose() && error instanceof Error) {
                    console.error(error.stack);
                }
                process.exit(1);
            }
        });
    
    return visualize;
}