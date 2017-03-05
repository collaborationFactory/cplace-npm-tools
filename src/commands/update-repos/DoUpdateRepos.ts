/**
 * Command for updating repos
 */
import * as Promise from 'bluebird';
import {FLAG_VERBOSE} from '../../cli';
import {Git} from '../../git';
import {fs} from '../../p/fs';
import {ICommand, ICommandParameters} from '../models';

const propertiesFileName = 'parent-repos.json';

export class DoUpdateRepos implements ICommand {

    private debug: boolean;

    private obj: {};

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.debug = params[FLAG_VERBOSE] as boolean;
        if (this.debug) {
            console.log('running in verbose mode');
        }

        this.obj = JSON.parse(fs.readFileSync(propertiesFileName, 'utf8'));
        if (this.debug) {
            console.log('properties', this.obj);
        }

        return true;
    }

    public execute(): Promise<void> {
        return new Promise<null>((resolve, reject) => {
            Object.keys(this.obj).forEach((repoName) => {
                if (this.debug) {
                    console.log('repo', repoName);
                }
                const repoProperties = this.obj[repoName];
                if (this.debug) {
                    console.log('repoProperties', repoProperties);
                }
                const commit = repoProperties.commit;
                if (this.debug) {
                    console.log('commit', commit);
                }
                const branch = repoProperties.branch;
                if (this.debug) {
                    console.log('branch', branch);
                }

                const repoGit = Git.repoGit(repoName);

                return Git.fetch(repoGit, repoName).then(
                    Git.status(repoGit, repoName, repoProperties, this.debug)).then(
                    Git.checkoutBranch(repoGit, repoName, branch, this.debug)).then(
                    Git.checkoutCommit(repoGit, repoName, commit).then(
                        Git.resetHard(repoGit, repoName)
                    ));
            });

            resolve();
        });
    }
}
