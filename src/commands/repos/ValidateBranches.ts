import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposTransitiveDependencies} from './models';
import {Global} from '../../Global';
import * as fs from 'fs';
import * as path from 'path';

interface IReposDiffReport {
    reposWithDiff: Map<string, IReposDiff[]>;
}

interface IReposDiff {
    repoA: IReposTransitiveDependencies;
    repoB: IReposTransitiveDependencies;
    hasDiff: boolean;
    details: IReposDiffDetails;
}

interface IReposDiffDetails {
    url: boolean;
    branch: boolean;
    useSnapshot: boolean;
    artifactGroup: boolean;
    artifactVersion: boolean;
    tag: boolean;
    commit: boolean;
}

export class ValidateBranches extends AbstractReposCommand {

    private currentPath: string[] = [];
    private rootRepoName: string;

    public execute(): Promise<void> {
        this.rootRepoName = path.basename(this.rootDir);
        const rootDependencies: IReposTransitiveDependencies = {
            repoName: this.rootRepoName,
            repoPath: [...this.currentPath],
            repoStatus: null,
            reposDescriptor: this.parentRepos,
            transitiveDependencies: new Map<string, IReposTransitiveDependencies>()
        };
        this.currentPath.push(this.rootRepoName);
        return Promise
            .resolve(Object.keys(this.parentRepos)
                         .map((repoName: string) => this.handleRepo(repoName, rootDependencies), {concurrency: 1}))
            .then(() => {
                console.log(this.toPrintableDependencyTree(rootDependencies));
                const dependenciesMap = this.mapDependencies(rootDependencies);
                this.printReport(this.validateDependencies(dependenciesMap));
            });
    }

    /**
     * Builds the repository dependency tree recursively. Will throw an error if any circular dependencies are detected.
     * @param repoName the repo to add
     * @param parentDependencies the parent dependencies where further child repositories are added to.
     * @private
     */
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
            repoName,
            repoPath: [...this.currentPath],
            repoStatus: parentDependencies.reposDescriptor[repoName]
        };
        if (fs.existsSync(childConfigPath)) {
            childDependencies.reposDescriptor = JSON.parse(fs.readFileSync(childConfigPath, 'utf8'));
            childDependencies.transitiveDependencies = new Map<string, IReposTransitiveDependencies>();
            Object.keys(childDependencies.reposDescriptor)
                .map((nextChildRepoName: string) => this.handleRepo(nextChildRepoName, childDependencies), {concurrency: 1});
        }

        parentDependencies.transitiveDependencies.set(repoName, childDependencies);

        this.currentPath.pop();
    }

    private toPrintableDependencyTree(rootDependencies: IReposTransitiveDependencies): string {
        let tree: string = '';
        if (rootDependencies.transitiveDependencies) {
            for (const [key, value] of rootDependencies.transitiveDependencies.entries()) {
                const repoStatus = rootDependencies.reposDescriptor[key];
                tree += `\n${value.repoPath.join('/')} -> branch: ${repoStatus.branch}`
                    + `${repoStatus.tag ? ', tag: ' + repoStatus.tag : ''}`
                    + `${repoStatus.artifactGroup ? ', artifactGroup: ' + repoStatus.artifactGroup : ''}`
                    + `${repoStatus.artifactVersion ? ', artifactVersion:' + repoStatus.artifactVersion : ''}`;
                if (value) {
                    tree += this.toPrintableDependencyTree(value);
                }
            }
        }
        return tree;
    }

    /**
     * needs to check across each repo and validate the repo coordinates:
     * - branch
     * - artifactGroup
     * - artifactVersion?
     *
     * repoName, repoPath - if there is an error, coordinates
     *
     * @param rootDependencies
     * @private
     */
    private mapDependencies(rootDependencies: IReposTransitiveDependencies): Map<string, IReposTransitiveDependencies[]> {
        const repoDependencyMapping: Map<string, IReposTransitiveDependencies[]> = new Map();
        if (rootDependencies.transitiveDependencies) {
            for (const [repoName, transitiveDependencies] of rootDependencies.transitiveDependencies.entries()) {
                if (!repoDependencyMapping.has(repoName)) {
                    repoDependencyMapping.set(repoName, []);
                }
                repoDependencyMapping.get(repoName).push(transitiveDependencies);
                if (transitiveDependencies) {
                    const childDependencies = this.mapDependencies(transitiveDependencies);
                    childDependencies.forEach((value, key) => {
                        if (!repoDependencyMapping.has(key)) {
                            repoDependencyMapping.set(key, value);
                        } else {
                            repoDependencyMapping.set(key, repoDependencyMapping.get(key).concat(value));
                        }
                    });
                }
            }
        }
        return repoDependencyMapping;
    }

    private validateDependencies(dependenciesMap: Map<string, IReposTransitiveDependencies[]>): IReposDiffReport {
        const report: IReposDiffReport = {
            reposWithDiff: new Map<string, IReposDiff[]>()
        };
        for (const [repoName, transitiveDependencies] of dependenciesMap) {
            const reposDiff: IReposDiff[] = this.validateDependenciesToRepo(transitiveDependencies);
            if (reposDiff.length > 0) {
                if (report.reposWithDiff.has(repoName)) {
                    report.reposWithDiff.set(repoName, report.reposWithDiff.get(repoName).concat(reposDiff));
                } else {
                    report.reposWithDiff.set(repoName, reposDiff);
                }
            }
        }
        return report;
    }

    private validateDependenciesToRepo(transitiveDependencies: IReposTransitiveDependencies[]): IReposDiff[] {
        let prevRepo: IReposTransitiveDependencies;
        const reposDiff: IReposDiff[] = [];
        for (const currentRepo of transitiveDependencies) {
            if (prevRepo) {
                const diff = this.compareRepos(prevRepo, currentRepo);
                if (diff.hasDiff === true) {
                    reposDiff.push(diff);
                }
            }
            prevRepo = currentRepo;
        }
        return reposDiff;
    }

    private compareRepos(prevRepo: IReposTransitiveDependencies, currentRepo: IReposTransitiveDependencies): IReposDiff {
        const diff: IReposDiff = {
            repoA: prevRepo,
            repoB: currentRepo,
            hasDiff: false,
            details: {
                url: prevRepo.repoStatus.url !== currentRepo.repoStatus.url,
                branch: prevRepo.repoStatus.branch !== currentRepo.repoStatus.branch,
                useSnapshot: prevRepo.repoStatus.useSnapshot !== currentRepo.repoStatus.useSnapshot,
                artifactGroup: prevRepo.repoStatus.artifactGroup !== currentRepo.repoStatus.artifactGroup,
                artifactVersion: prevRepo.repoStatus.artifactVersion !== currentRepo.repoStatus.artifactVersion,
                tag: prevRepo.repoStatus.tag !== currentRepo.repoStatus.tag,
                commit: prevRepo.repoStatus.commit !== currentRepo.repoStatus.commit
            }
        };
        diff.hasDiff = Object.values(diff.details).includes(true);
        return diff;
    }

    private printReport(report: IReposDiffReport): void {
        if (report.reposWithDiff.size > 0) {
            console.log('has diff');
        } else {
            console.log(`No differences found for the transitive dependencies of ${this.rootRepoName}.`);
        }
    }
}