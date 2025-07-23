/**
 * Repository management command using Commander.js
 */
import { Command } from 'commander';
import { Global, ICommandParameters } from '@cplace-cli/core';

// Import subcommands
import { UpdateRepos } from './subcommands/update.js';
import { WriteRepos } from './subcommands/write.js';
import { CloneRepos } from './subcommands/clone.js';
import { BranchRepos } from './subcommands/branch.js';
import { AddDependency } from './subcommands/add-dependency.js';
import { MergeSkeleton } from './subcommands/merge-skeleton.js';
import { MigrateArtifactGroup } from './subcommands/migrate-artifact-groups.js';
import { ValidateBranches } from './subcommands/validate-branches.js';

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
                const updateCommand = new UpdateRepos();
                if (updateCommand.prepareAndMayExecute(params)) {
                    await updateCommand.execute();
                }
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
                const writeCommand = new WriteRepos();
                if (writeCommand.prepareAndMayExecute(params)) {
                    await writeCommand.execute();
                }
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
                const cloneCommand = new CloneRepos();
                if (cloneCommand.prepareAndMayExecute(params)) {
                    await cloneCommand.execute();
                }
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
                const branchCommand = new BranchRepos();
                if (branchCommand.prepareAndMayExecute(params)) {
                    await branchCommand.execute();
                }
            } catch (error) {
                console.error('Branch repos failed:', error);
                process.exit(1);
            }
        });

    // Add-dependency subcommand
    repos
        .command('add-dependency <name>')
        .alias('d')  
        .description('Add a new dependency to another plugin or repository')
        .option('--all', 'Add all modules of this repository to the IDEA project')
        .action(async (name, options, command) => {
            Global.isVerbose() && console.log('Add dependency command:', name, options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options,
                name: name // Pass the dependency name
            };

            try {
                const addDependencyCommand = new AddDependency();
                if (addDependencyCommand.prepareAndMayExecute(params)) {
                    await addDependencyCommand.execute();
                }
            } catch (error) {
                console.error('Add dependency failed:', error);
                process.exit(1);
            }
        });

    // Merge-skeleton subcommand
    repos
        .command('merge-skeleton')
        .alias('ms')
        .description('Merge skeleton repo to current repo')
        .option('--base-branch <branch>', 'Base branch for pull request')
        .option('--target-branch <branch>', 'Target branch name')
        .option('--skeleton-branch <branch>', 'Skeleton branch to merge')
        .option('--pull-request', 'Create pull request after merge')
        .option('--push', 'Push changes after merge')
        .option('--ours <files...>', 'Files to accept "ours" version')
        .option('--interactive', 'Interactive conflict resolution')
        .action(async (options, command) => {
            Global.isVerbose() && console.log('Merge skeleton command:', options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options
            };

            try {
                const mergeSkeletonCommand = new MergeSkeleton();
                if (mergeSkeletonCommand.prepareAndMayExecute(params)) {
                    await mergeSkeletonCommand.execute();
                }
            } catch (error) {
                console.error('Merge skeleton failed:', error);
                process.exit(1);
            }
        });

    // Migrate-artifact-groups subcommand
    repos
        .command('migrate-artifact-groups')
        .alias('mag')
        .description('Migrate artifact groups from build.gradle to parent-repos.json')
        .action(async (options, command) => {
            Global.isVerbose() && console.log('Migrate artifact groups command:', options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options
            };

            try {
                const migrateCommand = new MigrateArtifactGroup();
                if (migrateCommand.prepareAndMayExecute(params)) {
                    await migrateCommand.execute();
                }
            } catch (error) {
                console.error('Migrate artifact groups failed:', error);
                process.exit(1);
            }
        });

    // Validate-branches subcommand
    repos
        .command('validate-branches')
        .alias('vb')
        .description('Validate branch consistency across repository dependencies')
        .option('--include <filters>', 'Include specific fields to validate (space-separated)')
        .option('--exclude <filters>', 'Exclude specific fields from validation (space-separated)')  
        .action(async (options, command) => {
            Global.isVerbose() && console.log('Validate branches command:', options);
            
            const parentOptions = command.parent?.opts() || {};
            const params: ICommandParameters = {
                ...parentOptions,
                ...options
            };

            try {
                const validateCommand = new ValidateBranches();
                if (validateCommand.prepareAndMayExecute(params)) {
                    await validateCommand.execute();
                }
            } catch (error) {
                console.error('Validate branches failed:', error);
                process.exit(1);
            }
        });

    return repos;
}