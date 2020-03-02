/**
 * General update-repos command
 */
import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Repository} from '../../git';
import {Global} from '../../Global';
import * as path from 'path';
import * as fs from 'fs';
import {GradleBuild} from '../../helpers/GradleBuild';

export class UpdateRepos extends AbstractReposCommand {
    private static readonly PARAMETER_NO_FETCH: string = 'nofetch';
    private static readonly PARAMETER_RESET_TO_REMOTE: string = 'resetToRemote';

    protected noFetch: boolean;
    protected resetToRemote: boolean;

    public async execute(): Promise<void> {
        await Promise.all(
            Object.keys(this.parentRepos).map((repoName) => this.handleRepo(repoName))
        );
        Global.isVerbose() && console.log('all repositories successfully updated');
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.noFetch = params[UpdateRepos.PARAMETER_NO_FETCH] as boolean;
        if (this.noFetch) {
            Global.isVerbose() && console.log('running in nofetch mode');
        }
        this.resetToRemote = params[UpdateRepos.PARAMETER_RESET_TO_REMOTE] as boolean;
        if (this.resetToRemote) {
            Global.isVerbose() && console.log('ATTENTION: resetting to remote state!');
        }
        return true;
    }

    private moveNodeModules(repo: Repository): void {
        if (!fs.existsSync(path.join(repo.baseDir, AbstractReposCommand.NODE_MODULES))) {
            console.log(`[${repo.repoName.toUpperCase()}]: No ${AbstractReposCommand.NODE_MODULES} folder`);
        } else {
            if (fs.existsSync(path.join(repo.baseDir, AbstractReposCommand.__NODE_MODULES_COPY))) {
                console.log(`[${repo.repoName.toUpperCase()}]: ${AbstractReposCommand.__NODE_MODULES_COPY} folder already exists`);
                this.removeFolderInRepo(repo, AbstractReposCommand.__NODE_MODULES_COPY);
            }
            console.log(`[${repo.repoName.toUpperCase()}]: Moving ${AbstractReposCommand.NODE_MODULES} to ${AbstractReposCommand.__NODE_MODULES_COPY}`);
            fs.renameSync(path.join(repo.baseDir, AbstractReposCommand.NODE_MODULES),
                          path.join(repo.baseDir, AbstractReposCommand.__NODE_MODULES_COPY));
        }
    }

    private restoreNodeModules(repo: Repository): void {
        if (!fs.existsSync(path.join(repo.baseDir, AbstractReposCommand.__NODE_MODULES_COPY))) {
            console.log(`[${repo.repoName.toUpperCase()}]: No ${AbstractReposCommand.__NODE_MODULES_COPY} folder`);
        } else {
            if (fs.existsSync(path.join(repo.baseDir, AbstractReposCommand.NODE_MODULES))) {
                console.log(`[${repo.repoName.toUpperCase()}]: ${AbstractReposCommand.NODE_MODULES} folder already exists`);
                this.removeFolderInRepo(repo, AbstractReposCommand.NODE_MODULES);
            }
            console.log(`[${repo.repoName.toUpperCase()}]: Restoring ${AbstractReposCommand.NODE_MODULES} from ${AbstractReposCommand.__NODE_MODULES_COPY}`);
            fs.renameSync(path.join(repo.baseDir, AbstractReposCommand.__NODE_MODULES_COPY),
                          path.join(repo.baseDir, AbstractReposCommand.NODE_MODULES));
        }
    }

    private areNodeModulesCheckedIn(repo: Repository): boolean {
        const packageJsonPath = path.join(repo.baseDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log(`[${repo.repoName.toUpperCase()}]: package.json is not provided`);
            return false;
        } else {
            const packageJsonString = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonString);
            console.log(`[${repo.repoName.toUpperCase()}]: package.json version is ${packageJson.version}`);
            return packageJson.version === '1.0.0';
        }
    }

    private handleNodeModules(repo: Repository): void {
        if (this.areNodeModulesCheckedIn(repo)) {
            console.log(`[${repo.repoName.toUpperCase()}]: No need to restore ${AbstractReposCommand.NODE_MODULES}`);
            this.removeFolderInRepo(repo, AbstractReposCommand.__NODE_MODULES_COPY);
        } else {
            this.restoreNodeModules(repo);
        }
    }

    private async handleRepo(repoName: string): Promise<void> {
        Global.isVerbose() && console.log('repo', repoName);

        const repoProperties = this.parentRepos[repoName];
        Global.isVerbose() && console.log('repoProperties', repoProperties);

        const commit = repoProperties.commit;
        Global.isVerbose() && console.log('commit', commit);

        const branch = repoProperties.branch;
        Global.isVerbose() && console.log('branch', branch);

        const pathToRepo = path.join(process.cwd(), '..', repoName);
        const wasGradleBuild = new GradleBuild(pathToRepo).containsGradleBuild();

        const repo = new Repository(pathToRepo);
        if (!this.noFetch) {
            await repo.fetch();
        }

        await this.removeFolderInRepo(repo, AbstractReposCommand.__NODE_MODULES_COPY);
        const status = await repo.status();
        await this.checkRepoClean(repo, status);
        await this.moveNodeModules(repo);
        await repo.checkoutBranch(branch);
        await repo.resetHard();

        if (commit) {
            await repo.checkoutCommit(commit);
        } else if (this.resetToRemote) {
            await repo.resetHard(branch);
        } else {
            await repo.pullOnlyFastForward(branch);
        }

        await this.handleNodeModules(repo);

        const isGradleBuild = new GradleBuild(pathToRepo).containsGradleBuild();
        if (isGradleBuild !== wasGradleBuild) {
            const toFrom = wasGradleBuild ? 'away from' : 'back to';
            console.warn(`WARNING: Repository ${repoName} has changed ${toFrom} a Gradle build!`);
            console.warn(`         This might cause issues in IntelliJ - be aware.`);
        }

        Global.isVerbose() && console.log('successfully updated', repoName);
    }
}
