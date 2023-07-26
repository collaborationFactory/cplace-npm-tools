import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposTransitiveDependencies} from './models';
import {Global} from '../../Global';
import * as fs from 'fs';
import * as path from 'path';

export class ValidateBranches extends AbstractReposCommand {

    private currentPath: string[] = [];

    public execute(): Promise<void> {
        const rootRepoName = path.basename(this.rootDir);
        const rootDependencies: IReposTransitiveDependencies = {
            repoName: rootRepoName,
            reposDescriptor: this.parentRepos,
            transitiveDependencies: new Map<string, IReposTransitiveDependencies>()
        };
        this.currentPath.push(rootRepoName);
        return Promise
            .resolve(Object.keys(this.parentRepos)
                         .map((repoName: string) => this.handleRepo(repoName, rootDependencies), {concurrency: 1}))
            .then((childRepos) => {
                console.log('ValidateBranches execute', childRepos);
                this.printDependencyTree(rootDependencies);
            });
    }

    private handleRepo(repoName: string, parentDependencies: IReposTransitiveDependencies): void {
        Global.isVerbose() && console.log(`[${repoName}]: starting traversing the parent-repos.json`);
        const repoProperties = this.parentRepos[repoName];
        Global.isVerbose() && console.log(`[${repoName}]:`, 'repoProperties', repoProperties);

        if (this.currentPath.includes(repoName)) {
            throw new Error(`[${repoName}]: Circular dependency to Repository ${repoName} detected in dependency path [${this.currentPath}]!`);
        }

        this.currentPath.push(repoName);

        const repoPath = path.join(this.rootDir, '..', repoName);
        if (!fs.existsSync(repoPath)) {
            throw new Error(`[${repoName}]: Repository ${repoName} not cloned to the expected path ${repoPath}. Please clone all repos with the cplace-cli.`);
        }
        const childConfigPath = path.join(repoPath, AbstractReposCommand.PARENT_REPOS_FILE_NAME);
        const childDependencies: IReposTransitiveDependencies = {
            repoName
        };
        if (fs.existsSync(childConfigPath)) {
            // throw new Error(`[${repoName}]: Repository ${repoName} has no ${AbstractReposCommand.PARENT_REPOS_FILE_NAME} in ${repoPath}..`);
            childDependencies.reposDescriptor = JSON.parse(fs.readFileSync(childConfigPath, 'utf8'));
            childDependencies.transitiveDependencies = new Map<string, IReposTransitiveDependencies>();
            Object.keys(childDependencies.reposDescriptor)
                .map((nextChildRepoName: string) => this.handleRepo(nextChildRepoName, childDependencies), {concurrency: 1});
        }

        parentDependencies.transitiveDependencies.set(repoName, childDependencies);

        this.currentPath.pop();
    }

    private printDependencyTree(rootDependencies: IReposTransitiveDependencies): void {
        for (const [key, value] of rootDependencies.transitiveDependencies.entries()) {
            this.logMapElements(key, value);
        }
    }

    private logMapElements(key: string, childDependencies: IReposTransitiveDependencies): void {
        console.log(`m[${key}] = ${JSON.stringify(childDependencies.reposDescriptor)}`);
        if (childDependencies.transitiveDependencies) {
            for (const [childKey, childValue] of childDependencies.transitiveDependencies.entries()) {
                this.logMapElements(childKey, childValue);
            }
        }
    }
}