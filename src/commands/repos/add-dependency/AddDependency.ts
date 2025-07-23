import {AbstractReposCommand} from '../AbstractReposCommand';
import * as path from 'path';
import * as fs from 'fs';
import {Global} from '../../../Global';
import {ICommandParameters} from '../../models';
import {Repos} from '../Repos';
import {DependencyManagement} from './DependencyManagement';
import {GradleDependencyManagement} from './GradleDependencyManagement';

/**
 * Add Dependency command
 */
export class AddDependency extends AbstractReposCommand {
    private static readonly PARAMETER_ALL: string = 'all';

    private dependencyManagement: DependencyManagement;
    private pluginOrRepoToAdd: string;
    private addAllFromRepo: boolean = false;

    public execute(): Promise<void> {
        if (fs.existsSync(path.resolve('..', this.pluginOrRepoToAdd))) {
            return this.addNewParentRepo(this.pluginOrRepoToAdd, this.addAllFromRepo);
        } else {
            return this.dependencyManagement.addSinglePlugin(this.pluginOrRepoToAdd, this.addAllFromRepo);
        }
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Detected Gradle-based build...');
        this.dependencyManagement = new GradleDependencyManagement(process.cwd(), this.parentRepos);

        if (params[Repos.PARAMETER_ADD_DEPENDENCY]) {
            this.pluginOrRepoToAdd = params[Repos.PARAMETER_ADD_DEPENDENCY] as string;
        } else {
            this.pluginOrRepoToAdd = params[Repos.PARAMETER_ADD_DEPENDENCY_SHORT] as string;
        }
        this.addAllFromRepo = !!params[AddDependency.PARAMETER_ALL];
        return !!this.pluginOrRepoToAdd;
    }

    private async addNewParentRepo(repoName: string, addAllFromRepo: boolean): Promise<void> {
        const newParentRepos = await this.dependencyManagement.getReposDescriptorWithNewRepo(repoName);
        await this.writeNewParentRepos(newParentRepos);
        if (addAllFromRepo) {
            await this.addAllPlugins(repoName);
        }
        await this.dependencyManagement.afterNewRepoDependencyAdded(repoName);
    }

    private addAllPlugins(repoName: string): Promise<void> {
        Global.isVerbose() && console.log(`Adding all plugins for ${repoName}`);
        return this.dependencyManagement.addAllPluginsFromRepository(repoName);
    }

}
