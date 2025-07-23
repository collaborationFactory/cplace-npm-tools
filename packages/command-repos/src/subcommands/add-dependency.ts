import { AbstractReposCommand } from '../utils/AbstractReposCommand.js';
import * as path from 'path';
import { fs, Global, ICommandParameters, statAsync } from '@cplace-cli/core';
import { Repository } from '@cplace-cli/git-utils';
import { IReposDescriptor } from '../models.js';
import { StatusResult } from 'simple-git';

/**
 * Add Dependency command
 */
export class AddDependency extends AbstractReposCommand {
    private static readonly PARAMETER_ALL: string = 'all';

    private pluginOrRepoToAdd: string;
    private addAllFromRepo: boolean = false;

    public execute(): Promise<void> {
        if (fs.existsSync(path.resolve('..', this.pluginOrRepoToAdd))) {
            return this.addNewParentRepo(this.pluginOrRepoToAdd, this.addAllFromRepo);
        } else {
            // For now, implement basic plugin addition
            // Full GradleDependencyManagement implementation can be added later
            return Promise.reject(`Plugin dependency management not yet implemented in migration. Repository ${this.pluginOrRepoToAdd} not found.`);
        }
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Detected Gradle-based build...');

        // Get the plugin/repo name from Commander.js parameters  
        this.pluginOrRepoToAdd = params.name as string; // Commander.js argument
        this.addAllFromRepo = !!params[AddDependency.PARAMETER_ALL];
        return !!this.pluginOrRepoToAdd;
    }

    private async addNewParentRepo(repoName: string, addAllFromRepo: boolean): Promise<void> {
        const newParentRepos = await this.getReposDescriptorWithNewRepo(repoName);
        await this.writeNewParentRepos(newParentRepos);
        
        if (addAllFromRepo) {
            await this.addAllPlugins(repoName);
        }
        
        // TODO: Implement afterNewRepoDependencyAdded logic if needed
        Global.isVerbose() && console.log(`Successfully added repository dependency: ${repoName}`);
    }

    private async getReposDescriptorWithNewRepo(repositoryName: string): Promise<IReposDescriptor> {
        if (Object.keys(this.parentRepos).indexOf(repositoryName) >= 0) {
            throw new Error(`Repository ${repositoryName} is already a dependency.`);
        }

        const repoPath = path.resolve(this.rootDir, '..', repositoryName);
        
        // Validate repository directory exists and is valid
        const stats = await statAsync(repoPath);
        if (!stats.isDirectory()) {
            throw new Error(`expected a repository directory named: ${repositoryName}`);
        }
        
        if (!this.isValidRepository(repoPath)) {
            throw new Error(`repository ${repositoryName} is not valid!`);
        }

        // Get repository information
        const repo = new Repository(repoPath);
        const status: StatusResult = await repo.status();
        const url = await repo.getOriginUrl();

        return {
            ...this.parentRepos,
            [repositoryName]: {
                branch: status.current,
                url
            }
        } as IReposDescriptor;
    }

    private isValidRepository(repoPath: string): boolean {
        // Basic validation - check if .git directory exists
        return fs.existsSync(path.join(repoPath, '.git'));
    }

    private addAllPlugins(repoName: string): Promise<void> {
        Global.isVerbose() && console.log(`Adding all plugins for ${repoName}`);
        // TODO: Implement full plugin addition logic from GradleDependencyManagement
        // For now, just log that this feature needs full implementation
        console.warn(`Warning: --all flag for adding all plugins from ${repoName} not yet fully implemented in migration.`);
        return Promise.resolve();
    }
}