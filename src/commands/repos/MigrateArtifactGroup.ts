import * as Promise from 'bluebird';
import {Global} from '../../Global';
import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposDescriptor, IRepoStatus} from './models';
import {ICommandParameters} from '../models';
import * as path from 'path';
import {fs} from '../../p/fs';
import { cwd } from 'process';
import { EOL } from 'os';

/**
 * For each repository:
 *  - Add or update artifact group in parent-repos.json,
 *  - Add useSnapshot=true in parent-repos.json,
 *  - Delete 'cplace' and 'cplaceRepositories' blocks from build.gradle file
 */
export class MigrateArtifactGroup extends AbstractReposCommand {
    public static readonly BUILD_GRADLE_FILE: string = 'build.gradle';
    private static readonly CPLACE_REPOSITORIES: string = 'cplacerepositories';
    private static readonly ARTIFACT_GROUP: string = 'artifactGroup';

    protected pathToBuildGradle: string = path.join(cwd(), MigrateArtifactGroup.BUILD_GRADLE_FILE);

    protected buildFileContent: string[];

    protected currentReadIndex: number = 0;
    protected repoToGroupMap: Map<string, {}> = new Map<string, {}>();
    protected notUpdatedRepos: string[] = [];

    public execute(): Promise<void> {
        return Promise
            .resolve(Object.keys(this.parentRepos))
            .map((repoName: string) => this.handleRepo(repoName), {concurrency: 1})
            .then((states) => {
                const newParentRepos: IReposDescriptor = {};
                states.forEach((s) => {
                    newParentRepos[s.repoName] = s.status;
                });

                console.log('Updated artifact groups for repositories');
                this.writeNewParentRepos(newParentRepos);
                if (this.notUpdatedRepos.length > 0) {
                    console.log(`Repositories not found and not updated: ${this.notUpdatedRepos}`);
                }

                return Promise.resolve();
            });
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        // read build.gradle file and prepare map from repo name to artifact group
        if (fs.existsSync(this.pathToBuildGradle)) {
            const buildFile: string = fs.readFileSync(this.pathToBuildGradle, 'utf8');
            this.buildFileContent = buildFile.replace(/\r/g, '').split('\n');
            this.collectRepoNamesAndGroups();
            return true;
        } else {
            console.log('Cannot find build.gradle file in current location.');
            return false;
        }
    }

    private handleRepo(repoName: string): Promise<{ repoName: string; status: IRepoStatus }> {
        Global.isVerbose() && console.log(`[${repoName}]: start updating the artifact group in parent-repos.json`);
        const repoProperties = this.parentRepos[repoName];
        Global.isVerbose() && console.log(`[${repoName}]:`, 'repoProperties', repoProperties);

        const status: IRepoStatus = this.parentRepos[repoName];

        const normalizedRepoName = repoName.replace(/-/g, '').toLowerCase();
        let calculatedArtifactGroup: string;
        if (repoName === 'main') {
            calculatedArtifactGroup = 'cf.cplace';
        } else if (this.repoToGroupMap[MigrateArtifactGroup.CPLACE_REPOSITORIES][normalizedRepoName]) {
            calculatedArtifactGroup =
            this.repoToGroupMap[MigrateArtifactGroup.CPLACE_REPOSITORIES][normalizedRepoName][MigrateArtifactGroup.ARTIFACT_GROUP];
        }

        if (calculatedArtifactGroup) {
            status.artifactGroup = calculatedArtifactGroup.replace(/\'/g, '');
        } else {
            Global.isVerbose() && console.log(`[${repoName}]:`, 'artifact group not found in build.gradle');
            this.notUpdatedRepos.push(repoName);
        }
        status.useSnapshot = true;

        let cleanedBuildGradle: string[] = this.deleteBlockFromBuildFile(this.buildFileContent, 'cplace');
        cleanedBuildGradle = this.deleteBlockFromBuildFile(cleanedBuildGradle, 'cplaceRepositories');

        fs.writeFileSync(this.pathToBuildGradle, this.createStringFromContentArray(cleanedBuildGradle), 'utf8');

        return Promise.resolve({repoName, status});
    }

    private collectRepoNamesAndGroups(): void {
        Global.isVerbose() && console.log(`read repositories defined in build.gradle`);

        let foundRepositories: boolean = false;

        this.currentReadIndex = 0;
        while (this.currentReadIndex < this.buildFileContent.length) {
            const line = this.buildFileContent[this.currentReadIndex];
            if (line.trim().match(/cplaceRepositories\s*\{/)) {
                foundRepositories = true;
                this.repoToGroupMap = this.readRepositoriesMap(this.buildFileContent, 0);
                break;
            }
            this.currentReadIndex++;
        }
        if (!foundRepositories) {
            console.log('cplaceRepositories not found in build.gradle file.');
            this.repoToGroupMap[MigrateArtifactGroup.CPLACE_REPOSITORIES] = {};
        }
    }

    private readRepositoriesMap(buildFileContent: string[], level: number): Map<string, {}> {
        const resultMap = new Map<string, {}>();

        let key: string;
        let value: {};
        let currentLine: string;

        while (this.currentReadIndex < buildFileContent.length) {
            currentLine = buildFileContent[this.currentReadIndex];
            if (currentLine && currentLine.trim()) {
                if (currentLine.trim() === '}') {
                    return resultMap;
                } else if (currentLine.includes('=')) {
                    key = currentLine.split('=')[0].trim();
                    value = currentLine.split('=')[1].trim();
                    resultMap[key] = value;
                } else if (currentLine.includes('{')) {
                    this.currentReadIndex++;
                    key = currentLine.split('{')[0].trim();
                    value = this.readRepositoriesMap(buildFileContent, level + 1);
                    resultMap[key.toLowerCase()] = value;
                    if (level === 0) {
                        return resultMap;
                    }
                }
            }
            this.currentReadIndex++;
        }
    }

    private deleteBlockFromBuildFile(buildFileContent: string[], blockName: string): string[] {
        this.currentReadIndex = 0;
        const result: string[] = [];

        let blockStartFound: boolean = false;
        let blockEndFound: boolean = false;
        let bracketLevel: number = 0;

        const blockReplace: string = `${blockName}\\s*\\{`;
        const blockRegex: RegExp = new RegExp(blockReplace, 'g');

        while (this.currentReadIndex < buildFileContent.length) {
            const line = buildFileContent[this.currentReadIndex];

            if (!blockStartFound || blockEndFound) {
                if (line.trim().match(blockRegex)) {
                    blockStartFound = true;
                    bracketLevel++;
                } else {
                    result.push(line);
                }
            } else {
                // inside block
                if (line.match(/[\w\s]*\}/)) {
                    bracketLevel--;
                } else if (line.match(/[\w\s]*\{/)) {
                    bracketLevel++;
                }

                if (bracketLevel === 0) {
                    blockEndFound = true;
                }
            }

            this.currentReadIndex++;
        }

        return result;
    }

    private createStringFromContentArray(content: string[]): string {
        let lineEnding = '\n';
        const isWindows = process.platform === 'win32';
        if (process.platform === 'win32') {
           lineEnding = '\r\n';
        }

        let result: string = '';
        content.forEach((line) => result += line + lineEnding);
        return result;
    }
}
