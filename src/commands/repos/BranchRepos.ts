/**
 * repo --branch command
 */

import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Repository} from '../../git';
import {Repos} from './Repos';
import {fs, readdirAsync, writeFileAsync} from '../../p/fs';
import {IReposDescriptor} from './models';
import {enforceNewline} from '../../util';
import * as path from 'path';

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

    public async execute(): Promise<void> {
        const repos = await this.findRepos();
        
        // Validate all repos concurrently (no concurrency restriction on original line 52)
        const validatedRepos = await Promise.all(repos.map(repo => this.validateRepoClean(repo)));
        
        // Process sequentially (concurrency: 1)
        const checkedOutRepos: Repository[] = [];
        for (const repo of validatedRepos) {
            const result = await this.checkoutBranch(repo);
            checkedOutRepos.push(result);
        }
        
        // Process sequentially (concurrency: 1)
        const adjustedRepos: Repository[] = [];
        for (const repo of checkedOutRepos) {
            const result = await this.adjustParentReposJsonAndCommit(repo);
            adjustedRepos.push(result);
        }
        
        // Process sequentially (concurrency: 1)
        if (this.push) {
            for (const repo of adjustedRepos) {
                await repo.push('origin', this.branchName);
            }
        }
    }

    private async findRepos(): Promise<Repository[]> {
        const dirs = await readdirAsync('../');
        const repos = dirs
            .map((dir: string) => this.checkRepo(dir))
            .filter((repo) => repo);
        return repos;
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
        // check if this is cplace main repo
        if (repo.workingDir === path.resolve('..', this.parentRepoPath)) {
            return Promise.resolve(repo);
        }
        try {
            const filename = path.join(repo.workingDir, AbstractReposCommand.PARENT_REPOS_FILE_NAME);
            const descriptorFile = fs.readFileSync(filename, 'utf8');
            const reposDescriptor: IReposDescriptor = JSON.parse(descriptorFile);

            Object.keys(reposDescriptor).forEach((key) => {
                reposDescriptor[key].branch = this.branchName;
                reposDescriptor[key].commit = undefined;
            });

            const newReposDescriptorContent = enforceNewline(JSON.stringify(reposDescriptor, null, 2));
            return writeFileAsync(filename, newReposDescriptorContent, 'utf8')
                .then(() => repo.add(AbstractReposCommand.PARENT_REPOS_FILE_NAME))
                .then(() => repo.commit(`Adjust parent-repos.json to new branch ${this.branchName}`, AbstractReposCommand.PARENT_REPOS_FILE_NAME))
                .then(() => repo);
        } catch (e) {
            console.error('Failed to update repo description', e);
            return Promise.reject(`Failed to update repo descriptor ${AbstractReposCommand.PARENT_REPOS_FILE_NAME}`);
        }
    }
}