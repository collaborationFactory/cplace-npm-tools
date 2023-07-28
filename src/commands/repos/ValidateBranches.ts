import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposTransitiveDependencies} from './models';
import * as fs from 'fs';
import * as path from 'path';

interface IReposDiffReport {
    reposWithDiff: Map<string, IReposDiff[]>;
    diffStatistic: Map<string, number>;
}

interface IReposDiff {
    repoA: IReposTransitiveDependencies;
    repoB: IReposTransitiveDependencies;
    normalizedValidatedPairKey: string;
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
        return new Promise<void>((resolve) => {
            this.currentPath.push(this.rootRepoName);
            Object.keys(this.parentRepos)
                .map((repoName: string) => this.createDependencyTree(repoName, rootDependencies), {concurrency: 1});
            const dependenciesMap = this.mapDependencies(rootDependencies);
            const report = this.validateDependencies(dependenciesMap);
            this.printReport(report);
            console.log('Dependency tree:\n', this.toPrintableDependencyTree(rootDependencies));
            resolve();
        });
    }

    /**
     * Builds the repository dependency tree recursively. Will throw an error if any circular dependencies are detected.
     * @param repoName the repo to add
     * @param parentDependencies the parent dependencies where further child repositories are added to.
     * @private
     */
    private createDependencyTree(repoName: string, parentDependencies: IReposTransitiveDependencies): void {
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
                .map((nextChildRepoName: string) => this.createDependencyTree(nextChildRepoName, childDependencies), {concurrency: 1});
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
            reposWithDiff: this.createDiffs(dependenciesMap),
            diffStatistic: null
        };
        report.diffStatistic = this.calculateDiffStatistic(report);
        return report;
    }

    private createDiffs(dependenciesMap: Map<string, IReposTransitiveDependencies[]>): Map<string, IReposDiff[]> {
        const reposWithDiff: Map<string, IReposDiff[]> = new Map();
        for (const [repoName, transitiveDependencies] of dependenciesMap) {
            const reposDiff: IReposDiff[] = this.validateDependenciesToRepo(transitiveDependencies);
            if (reposDiff.length > 0) {
                if (reposWithDiff.has(repoName)) {
                    reposWithDiff.set(repoName, reposWithDiff.get(repoName).concat(reposDiff));
                } else {
                    reposWithDiff.set(repoName, reposDiff);
                }
            }
        }
        return reposWithDiff;
    }

    private validateDependenciesToRepo(transitiveDependencies: IReposTransitiveDependencies[]): IReposDiff[] {
        const reposDiff: IReposDiff[] = [];
        const pairsValidated: Map<string, boolean> = new Map();
        for (const currentRepo of transitiveDependencies) {
            for (const nextRepo of transitiveDependencies) {
                if (currentRepo !== nextRepo) {
                    const normalizedValidatedPairKey = this.getNormalizedValidatedPairKey(currentRepo, nextRepo);
                    if (!pairsValidated.has(normalizedValidatedPairKey)) {
                        pairsValidated.set(normalizedValidatedPairKey, true);
                        const diff = this.compareRepos(currentRepo, nextRepo);
                        diff.normalizedValidatedPairKey = normalizedValidatedPairKey;
                        if (diff.hasDiff === true) {
                            reposDiff.push(diff);
                        }
                    }
                }
            }
        }
        return reposDiff;
    }

    private getNormalizedValidatedPairKey(currentRepo: IReposTransitiveDependencies, nextRepo: IReposTransitiveDependencies): string {
        return [currentRepo.repoPath.join('/'), nextRepo.repoPath.join('/')].sort().join(' <-> ');
    }

    private compareRepos(prevRepo: IReposTransitiveDependencies, currentRepo: IReposTransitiveDependencies): IReposDiff {
        const diff: IReposDiff = {
            repoA: prevRepo,
            repoB: currentRepo,
            normalizedValidatedPairKey: null,
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

    private calculateDiffStatistic(report: IReposDiffReport): Map<string, number> {
        const pathStatistics: Map<string, number> = new Map();
        report.reposWithDiff.forEach((diffs) => {
            diffs.forEach((diff) => {
                this.updateRepoPathDiffCount(pathStatistics, diff.repoA.repoPath.join('/'));
                this.updateRepoPathDiffCount(pathStatistics, diff.repoB.repoPath.join('/'));
            });
        });
        return pathStatistics;
    }

    private updateRepoPathDiffCount(pathStatistics: Map<string, number>, repoPath: string): void {
        if (pathStatistics.has(repoPath)) {
            pathStatistics.set(repoPath, pathStatistics.get(repoPath) + 1);
        } else {
            pathStatistics.set(repoPath, 1);
        }
    }

    private printReport(report: IReposDiffReport): void {
        if (report.reposWithDiff.size > 0) {
            let repoReport = `[${this.rootRepoName}] has conflicting parent repo configurations!`;
            repoReport += this.diffsPerPathReport(report);
            repoReport += this.conflictingPathsReport(report);
            console.log(repoReport);
        } else {
            console.log(`[${this.rootRepoName}] has NO conflicts.`);
        }
    }

    private diffsPerPathReport(report: IReposDiffReport): string {
        let repoReport = `\n\nCount of divergences to other parent repo configurations found per repository path:`;
        [...report.diffStatistic.entries()]
            .sort((a, b) => b[1] - a[1])
            .forEach(([key, value]) => {
                repoReport += `\n${key}: ${value}`;
            });
        return repoReport;
    }

    private conflictingPathsReport(report: IReposDiffReport): string {
        let repoReport = `\n\nConflicting repository paths:`;
        report.reposWithDiff.forEach((diffs) => {
            diffs.forEach((diff) => {
                repoReport += `\n${diff.normalizedValidatedPairKey}`;
                Object.entries(diff.details).forEach(([key, value]) => {
                    if (value) {
                        repoReport += `\n- ${key}`;
                    }
                });
            });
        });
        return repoReport;
    }
}
