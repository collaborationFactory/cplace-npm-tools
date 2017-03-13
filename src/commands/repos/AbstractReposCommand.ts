/**
 * Abstract base class for all repo commands
 */
import * as Promise from 'bluebird';
import {Global} from '../../Global';
import {fs} from '../../p/fs';
import {ICommand, ICommandParameters} from '../models';
import {IReposDescriptor} from './models';
import {IGitStatus, Repository} from '../../git';

export abstract class AbstractReposCommand implements ICommand {
    protected static readonly PARENT_REPOS_FILE_NAME: string = 'parent-repos.json';
    protected static readonly PARAMETER_FORCE: string = 'force';

    protected parentRepos: IReposDescriptor;
    protected force: boolean;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('running in verbose mode');

        this.force = !!params[AbstractReposCommand.PARAMETER_FORCE];
        if (this.force) {
            Global.isVerbose() && console.log('running in force mode');
        }

        if (!fs.existsSync(AbstractReposCommand.PARENT_REPOS_FILE_NAME)) {
            console.error('Cannot find repo description', AbstractReposCommand.PARENT_REPOS_FILE_NAME);
            return false;
        }

        try {
            this.parentRepos = JSON.parse(fs.readFileSync(AbstractReposCommand.PARENT_REPOS_FILE_NAME, 'utf8'));
        } catch (e) {
            console.error('Failed to parse repo description', AbstractReposCommand.PARENT_REPOS_FILE_NAME, e);
            return false;
        }

        Global.isVerbose() && console.log('properties', this.parentRepos);
        return this.doPrepareAndMayExecute(params);
    }

    public abstract execute(): Promise<void>;

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        return true;
    }

    protected checkRepoClean(repo: Repository, status: IGitStatus): Promise<IGitStatus> {
        const isRepoClean =
            status.not_added.length === 0 &&
            status.deleted.length === 0 &&
            status.modified.length === 0 &&
            status.created.length === 0 &&
            status.conflicted.length === 0;

        if (isRepoClean || this.force) {
            if (!isRepoClean) {
                console.warn(`working copy of repo ${repo.repoName} is not clean; continue due to force flag`);
            }
            return Promise.resolve(status);
        } else {
            return Promise.reject(`working copy of repo ${repo.repoName} is not clean`);
        }
    }
}
