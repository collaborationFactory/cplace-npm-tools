/**
 * Repository management command using Commander.js
 */
import { Command } from 'commander';
import { Global, ICommandParameters } from '@cplace-cli/core';

// Import subcommands (these will be migrated progressively)
// import { UpdateRepos } from './subcommands/UpdateRepos.js';
// import { WriteRepos } from './subcommands/WriteRepos.js';
// import { CloneRepos } from './subcommands/CloneRepos.js';
// import { BranchRepos } from './subcommands/BranchRepos.js';

export function createReposCommand(): Command {
    const repos = new Command('repos');
    
    repos
        .description('Repository operations for managing parent repositories')
        .option('--force', 'Force operation even if working copy is not clean')
        .option('--sequential', 'Run operations sequentially instead of in parallel')
        .option('--concurrency <number>', 'Limit parallel execution concurrency', '15');

    // Update subcommand
    repos
        .command('update')
        .alias('u')
        .description('Update all parent repositories')
        .option('--nofetch', 'Do not fetch repositories')
        .option('--reset-to-remote', 'Hard reset to match remote repository state')
        .action(async (options, command) => {
            Global.isVerbose() && console.log('Update repos command:', options);
            
            // Convert Commander options to legacy ICommandParameters format
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options,
                update: true,
                u: true
            };

            try {
                // TODO: Implement UpdateRepos migration
                // const updateCommand = new UpdateRepos();
                // if (updateCommand.prepareAndMayExecute(params)) {
                //     await updateCommand.execute();
                // }
                console.log('Update repos functionality - to be implemented in migration');
                console.log('Parameters:', params);
            } catch (error) {
                console.error('Update repos failed:', error);
                process.exit(1);
            }
        });

    // Write subcommand  
    repos
        .command('write')
        .alias('w')
        .description('Write the states of parent repos to parent-repos.json')
        .option('--freeze', 'Write exact commit hashes of currently checked out repos')
        .option('--un-freeze', 'Clean up configured tags, tagMarkers or commit hashes')
        .option('--latest-tag', 'Update repositories with latest tags')
        .action(async (options, command) => {
            Global.isVerbose() && console.log('Write repos command:', options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options,
                write: true,
                w: true
            };

            try {
                // TODO: Implement WriteRepos migration
                console.log('Write repos functionality - to be implemented in migration');
                console.log('Parameters:', params);
            } catch (error) {
                console.error('Write repos failed:', error);
                process.exit(1);
            }
        });

    // Clone subcommand
    repos
        .command('clone')
        .alias('c')
        .description('Clone all parent repositories if missing')
        .option('--depth <depth>', 'Create shallow clone with specified depth', parseInt)
        .action(async (options, command) => {
            Global.isVerbose() && console.log('Clone repos command:', options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options,
                clone: true,
                c: true
            };

            try {
                // TODO: Implement CloneRepos migration  
                console.log('Clone repos functionality - to be implemented in migration');
                console.log('Parameters:', params);
            } catch (error) {
                console.error('Clone repos failed:', error);
                process.exit(1);
            }
        });

    // Branch subcommand
    repos
        .command('branch <name>')
        .alias('b')
        .description('Create a new branch on topmost repo and all child repos')
        .option('--parent <parent-repo-name>', 'Override parent repository name (default: main)')
        .option('--push', 'Push new branches after creation')
        .option('--from <branch-name>', 'Remote branch to base new branches on')
        .action(async (name, options, command) => {
            Global.isVerbose() && console.log('Branch repos command:', name, options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options,
                branch: name,
                b: name
            };

            try {
                // TODO: Implement BranchRepos migration
                console.log('Branch repos functionality - to be implemented in migration');
                console.log('Branch name:', name);
                console.log('Parameters:', params);
            } catch (error) {
                console.error('Branch repos failed:', error);
                process.exit(1);
            }
        });

    // Additional subcommands can be added here as they are migrated
    // - add-dependency
    // - merge-skeleton  
    // - migrate-artifact-groups
    // - validate-branches

    return repos;
}