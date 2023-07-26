/**
 * Abstract base class for all repo commands
 */
import {Global} from '../../Global';
import * as fs from 'fs';
import {ICommand, ICommandParameters} from '../models';
import {IReposDescriptor} from './models';
import {IGitStatus, Repository} from '../../git';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as eol from 'eol';

export abstract class AbstractReposCommand implements ICommand {
    public static readonly PARENT_REPOS_FILE_NAME: string = 'parent-repos.json';
    public static readonly PARAMETER_CLONE_DEPTH: string = 'depth';

    protected static readonly PARAMETER_FORCE: string = 'force';
    protected static readonly PARAMETER_SEQUENTIAL: string = 'sequential';
    protected static readonly PARAMETER_CONCURRENCY: string = 'concurrency';
    protected static readonly NODE_MODULES: string = 'node_modules';

    protected parentRepos: IReposDescriptor;
    protected force: boolean;
    protected sequential: boolean;
    protected concurrency: number;
    protected depth: number;
    protected parentReposConfigPath: string;
    protected rootDir: string;

    public prepareAndMayExecute(params: ICommandParameters, rootDir?: string): boolean {
        Global.isVerbose() && console.log('running in verbose mode');

        this.rootDir = rootDir ? rootDir : process.cwd();

        this.force = !!params[AbstractReposCommand.PARAMETER_FORCE];
        if (this.force) {
            Global.isVerbose() && console.log('running in force mode');
        }

        this.sequential = !!params[AbstractReposCommand.PARAMETER_SEQUENTIAL];
        if (this.sequential) {
            Global.isVerbose() && console.log('running in sequential mode');
        }

        const depth = params[AbstractReposCommand.PARAMETER_CLONE_DEPTH];
        if (typeof depth === 'number' && !isNaN(depth)) {
            this.depth = depth;
        } else {
            this.depth = -1;
        }
        if (this.depth > 0) {
            Global.isVerbose() && console.log('running with depth for cloning = ' + this.depth);
        }

        const concurrency = params[AbstractReposCommand.PARAMETER_CONCURRENCY];
        if (typeof concurrency === 'number' && !isNaN(concurrency)) {
            this.concurrency = concurrency;
        } else {
            this.concurrency = 15;
        }
        if (this.concurrency > 0) {
            Global.isVerbose() && console.log('running with concurrency for parallel execution = ' + this.concurrency);
        }

        this.parentReposConfigPath = path.join(this.rootDir, AbstractReposCommand.PARENT_REPOS_FILE_NAME);
        if (!fs.existsSync(this.parentReposConfigPath)) {
            console.error('Cannot find repo description', this.parentReposConfigPath);
            return false;
        }

        try {
            this.parentRepos = JSON.parse(fs.readFileSync(this.parentReposConfigPath, 'utf8'));
        } catch (e) {
            console.error('Failed to parse repo description', this.parentReposConfigPath, e);
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
        const jsonContent = JSON.stringify(newParentRepos, null, 2);
        const newParentReposContent = this.convertLineEndings(`${jsonContent}\n`);
        Global.isVerbose() && console.log('new repo description', newParentReposContent);
        fs.writeFileSync(this.parentReposConfigPath, newParentReposContent, 'utf8');
        this.parentRepos = newParentRepos;
        return Promise.resolve();
    }

    protected convertLineEndings(content: string): string {
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            return eol.crlf(content);
        }
        return content;
    }
}
