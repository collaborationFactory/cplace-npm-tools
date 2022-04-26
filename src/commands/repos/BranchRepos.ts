/**
 * repo --branch command
 */

import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Repository} from '../../git';
import {Repos} from './Repos';
import {fs} from '../../p/fs';
import * as Promise from 'bluebird';
import {IReposDescriptor} from './models';
import {enforceNewline} from '../../util';

export class BranchRepos extends AbstractReposCommand {
    private static readonly PARAMETER_PARENT: string = 'parent';
    private static readonly PARAMETER_PUSH: string = 'push';
    private static readonly PARAMETER_FROM: string = 'from';

    private parentRepoPath: string = 'main';
    private branchName: string;
    private push: boolean;
    private branchFrom: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        let branchName = params[Repos.PARAMETER_BRANCH];
        if (typeof branchName !== 'string') {
            branchName = params[Repos.PARAMETER_BRANCH_SHORT];
        }
        if (typeof branchName !== 'string') {
            console.log('No branch name given.');
            return false;
        }
        const branchFrom = params[BranchRepos.PARAMETER_FROM];
        if (typeof branchFrom === 'string') {
            console.log(`Branching off ${branchFrom}`);
            this.branchFrom = branchFrom;
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
            .map((repo) => this.push ? repo.push('origin', this.branchName) : Promise.resolve(), {concurrency: 1});
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
        return repo.fetch({})
            .then(() => repo.status())
            .then((status) => this.checkRepoClean(repo, status))
            .then(() => repo);
    }

    private checkoutBranch(repo: Repository): Promise<Repository> {
        const params = [`-b${this.branchName}`];
        if (this.branchFrom) {
            params.push(`origin/${this.branchFrom}`);
        }
        return repo.checkoutBranch(params)
            .then(() => repo);
    }

    private adjustParentReposJsonAndCommit(repo: Repository): Promise<Repository> {
        if (repo.baseDir === `../${this.parentRepoPath}`) {
            return Promise.resolve(repo);
        }
        try {
            const filename = `${repo.baseDir}/${AbstractReposCommand.PARENT_REPOS_FILE_NAME}`;
            const descriptorFile = fs.readFileSync(filename, 'utf8');
            const reposDescriptor: IReposDescriptor = JSON.parse(descriptorFile);

            Object.keys(reposDescriptor).forEach((key) => {
                reposDescriptor[key].branch = this.branchName;
                reposDescriptor[key].commit = undefined;
            });

            const newReposDescriptorContent = enforceNewline(JSON.stringify(reposDescriptor, null, 2));
            return fs.writeFileAsync(filename, newReposDescriptorContent, 'utf8')
                .then(() => repo.add(AbstractReposCommand.PARENT_REPOS_FILE_NAME))
                .then(() => repo.commit(`Adjust parent-repos.json to new branch ${this.branchName}`, AbstractReposCommand.PARENT_REPOS_FILE_NAME))
                .then(() => repo);
        } catch (e) {
            console.error('Failed to update repo description', e);
            return Promise.reject(`Failed to update repo descriptor ${AbstractReposCommand.PARENT_REPOS_FILE_NAME}`);
        }
    }
}