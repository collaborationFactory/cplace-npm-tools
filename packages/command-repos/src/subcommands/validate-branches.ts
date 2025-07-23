import { AbstractReposCommand } from '../utils/AbstractReposCommand.js';
import { IReposDescriptor, IRepoStatus } from '../models.js';
import { Global, ICommandParameters, fs } from '@cplace-cli/core';
import * as path from 'path';
import { AsciiTree } from 'oo-ascii-tree';

export interface IReposValidationResult {
    rootDependencies: IReposTransitiveDependencies;
    dependenciesMap: Map<string, IReposTransitiveDependencies[]>;
    report: IReposDiffReport;
}

export interface IReposTransitiveDependencies {
    repoName: string;
    repoPath: string[];
    repoStatus: IRepoStatus;
    reposDescriptor?: IReposDescriptor;
    transitiveDependencies?: Map<string, IReposTransitiveDependencies>;
    missing?: boolean;
}

export interface IReposDiffReport {
    reposWithDiff: Map<string, IReposDiff[]>;
    diffStatistic: Map<string, number>;
}

export interface IReposDiff {
    repoA: IReposTransitiveDependencies;
    repoB: IReposTransitiveDependencies;
    normalizedValidatedPairKey: string;
    hasDiff: boolean;
    details: IReposDiffDetails;
}

export interface IReposDiffDetails {
    url: boolean;
    branch: boolean;
    useSnapshot: boolean;
    artifactGroup: boolean;
    artifactVersion: boolean;
    tag: boolean;
    commit: boolean;
}

export class ValidateBranches extends AbstractReposCommand {

    public static readonly PARAMETER_INCLUDE: string = 'include';
    public static readonly PARAMETER_EXCLUDE: string = 'exclude';

    private missingRepoPaths: string[] = [];
    private currentPath: string[] = [];
    private rootRepoName: string;
    private allowedFilters: string[] = ['url', 'branch', 'useSnapshot', 'artifactGroup', 'artifactVersion', 'tag', 'tagMarker', 'latestTagForRelease', 'commit', 'description'];
    private includeList: string[];
    private defaultExcludeList: string[] = ['url', 'useSnapshot', 'tagMarker', 'latestTagForRelease', 'description'];
    private excludeList: string[] = this.defaultExcludeList;

    public execute(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.validateAndReport();
            resolve();
        });
    }

    /**
     * Public visibility and return value for test.
     */
    public validateAndReport(): IReposValidationResult {
        const rootDependencies: IReposTransitiveDependencies = {
            repoName: this.rootRepoName,
            repoPath: [...this.currentPath],
            repoStatus: null,
            reposDescriptor: this.parentRepos,
            transitiveDependencies: new Map<string, IReposTransitiveDependencies>()
        };
        this.currentPath.push(this.rootRepoName);
        Object.keys(this.parentRepos)
            .forEach((repoName: string) => this.createDependencyTree(repoName, rootDependencies));
        const dependenciesMap = this.mapDependencies(rootDependencies);
        const report = this.validateDependencies(dependenciesMap);
        this.printReport(report);
        console.log('\nDependency tree:\n', this.toPrintableAsciiTree(rootDependencies));

        if (this.missingRepoPaths.length > 0) {
            throw new Error(`[${this.rootRepoName}]: Missing repositories! Reference paths:\n${this.missingRepoPaths.join('\n')}
Please configure all transitive repository dependencies and clone all repos with the cplace-cli.`);
        }
        return {
            rootDependencies,
            dependenciesMap,
            report
        };
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.rootRepoName = path.basename(this.rootDir);
        if (params[ValidateBranches.PARAMETER_INCLUDE]) {
            const value = params[ValidateBranches.PARAMETER_INCLUDE];
            if (value === 'all') {
                this.includeList = this.allowedFilters;
            } else {
                this.includeList = value.toString().split(' ');
                this.validateListParameters(this.includeList);
            }
            Global.isVerbose() && console.log(`[${this.rootRepoName}]:`, 'Configured include list: ', this.includeList);
        }
        if (params[ValidateBranches.PARAMETER_EXCLUDE]) {
            const value = params[ValidateBranches.PARAMETER_EXCLUDE];
            if (value === 'all') {
                this.excludeList = this.allowedFilters;
            } else {
                this.excludeList = value.toString().split(' ');
                this.validateListParameters(this.excludeList);
            }
            Global.isVerbose() && console.log(`[${this.rootRepoName}]:`, 'Configured excludeList list: ', this.excludeList);
        }

        return true;
    }

    private validateListParameters(list: string[]): void {
        list.forEach((filter: string) => {
            if (!this.allowedFilters.includes(filter)) {
                throw new Error(`Unsupported filter [${filter}]. Allowed are ${this.allowedFilters}`);
            }
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

        const childDependencies: IReposTransitiveDependencies = {
            repoName,
            repoPath: [...this.currentPath],
            repoStatus: parentDependencies.reposDescriptor[repoName]
        };
        const repoPath = path.join(this.rootDir, '..', repoName);
        if (!fs.existsSync(repoPath)) {
            childDependencies.missing = true;
            this.missingRepoPaths.push(`${parentDependencies.repoPath?.join(' -> ')} -> * ${repoName}`);
        } else {
            const childConfigPath = path.join(repoPath, AbstractReposCommand.PARENT_REPOS_FILE_NAME);
            if (fs.existsSync(childConfigPath)) {
                childDependencies.reposDescriptor = JSON.parse(fs.readFileSync(childConfigPath, 'utf8'));
                childDependencies.transitiveDependencies = new Map<string, IReposTransitiveDependencies>();
                Object.keys(childDependencies.reposDescriptor)
                    .forEach((nextChildRepoName: string) => this.createDependencyTree(nextChildRepoName, childDependencies));
            }
        }
        parentDependencies.transitiveDependencies.set(repoName, childDependencies);

        this.currentPath.pop();
    }

    private toPrintableAsciiTree(rootDependencies: IReposTransitiveDependencies): string {
        const tree = new AsciiTree(this.rootRepoName);
        if (rootDependencies.transitiveDependencies) {
            this.addChildNodes(tree, rootDependencies);
        }
        return tree.toString();
    }

    private addChildNodes(tree: AsciiTree, dependencies: IReposTransitiveDependencies): void {
        for (const [key, value] of dependencies.transitiveDependencies.entries()) {
            const repoStatus = dependencies.reposDescriptor[key];
            const repoName = value.missing ? `${key} *** missing ***` : key;
            const childTree = new AsciiTree(repoName);

            Object.entries(repoStatus).forEach(([fieldName, fieldValue]) => {
                if (fieldValue && this.addIfNotFiltered(fieldName)) {
                    childTree.add(new AsciiTree(`--> ${fieldName}: ${fieldValue}`));
                }
            });

            tree.add(childTree);
            if (value.transitiveDependencies) {
                this.addChildNodes(childTree, value);
            }
        }
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
                url: false,
                branch: false,
                useSnapshot: false,
                artifactGroup: false,
                artifactVersion: false,
                tag: false,
                commit: false
            }
        };

        Object.keys(diff.details).forEach((key) => {
            if (this.addIfNotFiltered(key)) {
                diff.details[key] = prevRepo.repoStatus[key] !== currentRepo.repoStatus[key];
            }
        });

        diff.hasDiff = Object.values(diff.details).includes(true);
        return diff;
    }

    private addIfNotFiltered(key: string): boolean {
        return this.includeList ? this.includeList.includes(key) : !this.excludeList.includes(key);
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