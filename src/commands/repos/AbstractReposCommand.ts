/**
 * Abstract base class for all repo commands
 */
import {Global} from '../../Global';
import * as fs from 'fs';
import {ICommand, ICommandParameters} from '../models';
import {IReposDescriptor} from './models';
import {IGitStatus, Repository} from '../../git';
import {enforceNewline} from '../../util';
import * as path from 'path';
import * as rimraf from 'rimraf';

export abstract class AbstractReposCommand implements ICommand {
    protected static readonly PARENT_REPOS_FILE_NAME: string = 'parent-repos.json';
    protected static readonly PARAMETER_FORCE: string = 'force';
    protected static readonly PARAMETER_SEQUENTIAL: string = 'sequential';
    protected static readonly NODE_MODULES: string = 'node_modules';

    protected parentRepos: IReposDescriptor;
    protected force: boolean;
    protected sequential: boolean;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('running in verbose mode');

        this.force = !!params[AbstractReposCommand.PARAMETER_FORCE];
        if (this.force) {
            Global.isVerbose() && console.log('running in force mode');
        }

        this.sequential = !!params[AbstractReposCommand.PARAMETER_SEQUENTIAL];
        if (this.sequential) {
            Global.isVerbose() && console.log('running in sequential mode');
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

    protected removeFolderInRepo(repo: Repository, folderName: string): void {
        if (fs.existsSync(path.join(repo.baseDir, folderName))) {
            console.log(`[${repo.repoName}]: Removing ${folderName} folder`);
            rimraf.sync(path.join(repo.baseDir, folderName));
        }
    }

    protected async checkRepoClean(repo: Repository, status: IGitStatus): Promise<IGitStatus> {
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
            return status;
        } else {
            throw new Error(`working copy of repo ${repo.repoName} is not clean`);
        }
    }

    protected writeNewParentRepos(newParentRepos: IReposDescriptor): Promise<void> {
        const newParentReposContent = enforceNewline(JSON.stringify(newParentRepos, null, 2));
        Global.isVerbose() && console.log('new repo description', newParentReposContent);
        return fs
            .writeFileAsync(AbstractReposCommand.PARENT_REPOS_FILE_NAME, newParentReposContent, 'utf8')
            .then(() => {
                this.parentRepos = newParentRepos;
            });
    }
}
