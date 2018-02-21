/**
 * repo --branch command
 */

import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Repository} from '../../git';
import {Repos} from './Repos';
import {fs} from '../../p/fs';
import * as Promise from 'bluebird';

export class BranchRepos extends AbstractReposCommand {
    private static readonly PARAMETER_PARENT: string = 'parent';
    private static readonly PARAMETER_PUSH: string = 'push';

    private parentRepoPath: string = 'main';
    private branchName: string;
    private push: boolean;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        let branchName = params[Repos.PARAMETER_BRANCH];
        if (typeof branchName !== 'string') {
            branchName = params[Repos.PARAMETER_BRANCH_SHORT];
        }
        if (typeof branchName !== 'string') {
            console.log('No branch name given.');
            return false;
        }
        this.branchName = branchName;
        this.push = params[BranchRepos.PARAMETER_PUSH] === true;

        const parent = params[BranchRepos.PARAMETER_PARENT];
        if (typeof parent === 'string') {
            this.parentRepoPath = parent;
        }
        console.log(`Parent repo is ${this.parentRepoPath}`);
        return true;
    }

    public execute(): Promise<void> {
        return this.findRepos()
            .map((repo) => this.validateRepoClean(repo))
            .map((repo) => this.checkoutBranch(repo), {concurrency: 1})
            .map((repo) => this.adjustParentReposJsonAndCommit(repo), {concurrency: 1})
            .map((repo) => this.push ? repo.push() : Promise.resolve(), {concurrency: 1});
    }

    private findRepos(): Promise<Repository[]> {
        return fs.readdirAsync('../')
            .map((dir: string) => this.checkRepo(dir))
            .filter((repo) => repo);
    }

    private checkRepo(dir: string): Repository {
        if (dir === this.parentRepoPath || fs.existsSync(`../${dir}/${AbstractReposCommand.PARENT_REPOS_FILE_NAME}`)) {
            return new Repository(`../${dir}`);
        }
    }

    private validateRepoClean(repo: Repository): Promise<Repository> {
        return repo.fetch()
            .then(() => repo.status())
            .then((status) => this.checkRepoClean(repo, status))
            .then(() => repo);
    }

    private checkoutBranch(repo: Repository): Promise<Repository> {
        return repo.checkoutBranch(`-b${this.branchName}`)
            .then(() => repo);
    }

    private adjustParentReposJsonAndCommit(repo: Repository): Promise<Repository> {
        return repo;
    }
}