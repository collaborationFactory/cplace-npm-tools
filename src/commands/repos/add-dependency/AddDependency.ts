import {AbstractReposCommand} from '../AbstractReposCommand';
import * as path from 'path';
import * as fs from 'fs';
import * as Promise from 'bluebird';
import {Global} from '../../../Global';
import {ICommandParameters} from '../../models';
import {Repos} from '../Repos';
import {DependencyManagement} from './DependencyManagement';
import {IdeaDependencyManagement} from './IdeaDependencyManagement';
import {GradleBuild} from '../../../helpers/GradleBuild';
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
        const potentialGradleBuild = new GradleBuild(process.cwd());
        if (potentialGradleBuild.containsGradleBuild()) {
            this.dependencyManagement = new GradleDependencyManagement(process.cwd(), this.parentRepos);
        } else {
            this.dependencyManagement = new IdeaDependencyManagement(process.cwd(), this.parentRepos);
        }

        if (params[Repos.PARAMETER_ADD_DEPENDENCY]) {
            this.pluginOrRepoToAdd = params[Repos.PARAMETER_ADD_DEPENDENCY] as string;
        } else {
            this.pluginOrRepoToAdd = params[Repos.PARAMETER_ADD_DEPENDENCY_SHORT] as string;
        }
        this.addAllFromRepo = !!params[AddDependency.PARAMETER_ALL];
        return !!this.pluginOrRepoToAdd;
    }

    private addNewParentRepo(repoName: string, addAllFromRepo: boolean): Promise<void> {
        return this.dependencyManagement.getReposDescriptorWithNewRepo(repoName)
            .then((newParentRepos) => this.writeNewParentRepos(newParentRepos))
            .then(() => !addAllFromRepo ? Promise.resolve() : this.addAllPlugins(repoName));
    }

    private addAllPlugins(repoName: string): Promise<void> {
        Global.isVerbose() && console.log(`Adding all plugins for ${repoName}`);
        return this.dependencyManagement.addAllPluginsFromRepository(repoName);
    }

}
