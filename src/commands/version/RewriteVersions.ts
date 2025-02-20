import { ICommand, ICommandParameters } from '../models';
import { AbstractReposCommand } from '../repos/AbstractReposCommand';
import { IReposDescriptor } from '../repos/models';
import * as path from 'path';
import { fs } from '../../p/fs';
import { Global } from '../../Global';
import { CplaceVersion } from "../../helpers/CplaceVersion";

interface IVersionConfig {
    majorVersion: number;
    minorVersion: number;
    patchVersion: number;
    classifier?: string;
}

export class RewriteVersions extends AbstractReposCommand implements ICommand {
    private static readonly VERSION_GRADLE_NAME: string = 'version.gradle';
    private reposWithCustomBranch: string[] = [];
    private versionConfig: IVersionConfig;

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        // Validate parent-repos.json exists and is valid (handled by parent class)
        if (!this.parentRepos) {
            console.error('Could not read parent-repos.json');
            return false;
        }

        try {
            // Validate version.gradle exists
            const versionGradlePath = path.join(this.rootDir, RewriteVersions.VERSION_GRADLE_NAME);
            if (!fs.existsSync(versionGradlePath)) {
                console.error(`No ${RewriteVersions.VERSION_GRADLE_NAME} found in working dir ${this.rootDir}`);
                return false;
            }
        } catch (err) {
            console.error(`Error validating version.gradle: ${err.message}`);
            return false;
        }

        return true;
    }

    public async execute(): Promise<void> {
        try {
            await this.readCplaceVersion();
            Global.isVerbose() && console.log('Successfully read cplace version:', this.versionConfig);

            await this.findReposWithCustomBranches();
            if (this.reposWithCustomBranch.length === 0) {
                console.log('No repositories with custom branches found. Nothing to do.');
                return;
            }
            Global.isVerbose() && console.log('Found repos with custom branches:', this.reposWithCustomBranch);

            const fakeVersion = `${this.versionConfig.majorVersion}.${this.versionConfig.minorVersion}.999`;
            Global.isVerbose() && console.log('Using fake version:', fakeVersion);

            await this.updateVersionGradleInAffectedRepos(fakeVersion);
            await this.updateArtifactVersionInAllParentRepos(fakeVersion);

            console.log('Successfully rewrote versions for custom branches');
        } catch (err) {
            throw new Error(`Failed to rewrite versions: ${err.message}`);
        }
    }

    private async readCplaceVersion(): Promise<void> {
        try {
            const versionGradlePath = path.join(this.rootDir, RewriteVersions.VERSION_GRADLE_NAME);
            const content = await fs.readFileAsync(versionGradlePath, 'utf8');
            const cplaceVersionMatch = content.match(/cplaceVersion\s*=\s*['"](\d+)\.(\d+)['"]/);

            if (cplaceVersionMatch) {
                this.versionConfig = {
                    majorVersion: parseInt(cplaceVersionMatch[1], 10),
                    minorVersion: parseInt(cplaceVersionMatch[2], 10),
                    patchVersion: 999
                };
                Global.isVerbose() && console.log(`Found cplace version major: ${this.versionConfig.majorVersion}, minor: ${this.versionConfig.minorVersion}`);
            } else {
                throw new Error('Could not find cplaceVersion in version.gradle');
            }
        } catch (err) {
            throw new Error(`Error reading cplace version: ${err.message}`);
        }
    }

    private async findReposWithCustomBranches(): Promise<void> {
        try {
            if (!fs.existsSync(this.parentReposConfigPath)) {
                throw new Error(`No parent-repos.json found in the root working dir ${this.rootDir}`);
            }

            Object.entries(this.parentRepos).forEach(([repoName, repoStatus]) => {
                const branch = repoStatus.branch;
                if (branch &&
                    !branch.startsWith('release/') &&
                    branch !== 'master' &&
                    branch !== 'main') {
                    this.reposWithCustomBranch.push(repoName);
                }
            });

            Global.isVerbose() && console.log('Found repos with custom branches:', this.reposWithCustomBranch);
        } catch (err) {
            throw new Error(`Error finding repos with custom branches: ${err.message}`);
        }
    }

    private async updateVersionGradleInAffectedRepos(newVersion: string): Promise<void> {
        for (const repoName of this.reposWithCustomBranch) {
            try {
                const repoPath = path.resolve(this.rootDir, '..', repoName);
                const versionGradlePath = path.join(repoPath, RewriteVersions.VERSION_GRADLE_NAME);

                if (fs.existsSync(versionGradlePath)) {
                    Global.isVerbose() && console.log(`Updating version.gradle of repo ${repoName}`);
                    const updated = CplaceVersion.updateVersionGradleFile(versionGradlePath, newVersion);
                    if (updated) {
                        console.log(`Updated version.gradle for ${repoName} to version ${newVersion}`);
                    } else {
                        Global.isVerbose() && console.log(`No update needed for ${repoName}, version already set to ${newVersion}`);
                    }
                } else {
                    Global.isVerbose() && console.log(`Skipping ${repoName} - no version.gradle found`);
                }
            } catch (err) {
                throw new Error(`Error updating version.gradle for repo ${repoName}: ${err.message}`);
            }
        }
    }

    private async updateArtifactVersionInAllParentRepos(newVersion: string): Promise<void> {
        const updateParentRepos = async (dirPath: string): Promise<void> => {
            const parentReposPath = path.join(dirPath, 'parent-repos.json');
            try {
                if (fs.existsSync(parentReposPath)) {
                    const content = await fs.readFileAsync(parentReposPath, 'utf8');
                    const reposDescriptor: IReposDescriptor = JSON.parse(content);

                    let modified = false;
                    this.reposWithCustomBranch.forEach(repoName => {
                        if (reposDescriptor[repoName]) {
                            reposDescriptor[repoName].artifactVersion = newVersion;
                            delete reposDescriptor[repoName].useSnapshot;
                            modified = true;
                        }
                    });

                    if (modified) {
                        await fs.writeFileAsync(parentReposPath, JSON.stringify(reposDescriptor, null, 2), 'utf8');
                        Global.isVerbose() && console.log(`Updated parent-repos.json in ${dirPath}`);
                    } else {
                        Global.isVerbose() && console.log(`No updates needed in parent-repos.json in ${dirPath}`);
                    }
                } else {
                    Global.isVerbose() && console.log(`No parent-repos.json found in ${dirPath}`);
                }
            } catch (err) {
                throw new Error(`Error updating parent-repos.json in ${dirPath}: ${err.message}`);
            }
        };

        try {
            // Update root parent-repos.json
            await updateParentRepos(this.rootDir);

            // Update parent-repos.json in each repo
            for (const repoName of Object.keys(this.parentRepos)) {
                const repoPath = path.resolve(this.rootDir, '..', repoName);
                await updateParentRepos(repoPath);
            }
        } catch (err) {
            throw new Error(`Error updating parent-repos.json files: ${err.message}`);
        }
    }
}
