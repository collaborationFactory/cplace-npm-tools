/**
 * General write-repos-state command
 */
import * as Promise from 'bluebird';
import * as os from 'os';
import {Git} from '../../git';
import {fs} from '../../p/fs';
import {AbstractReposCommand, propertiesFileName} from '../AbstractReposCommand';

export class WriteReposState extends AbstractReposCommand {

    public execute(): Promise<void> {
        return new Promise<null>(async (resolve, reject) => {
            const promises = [];

            Object.keys(this.obj).forEach((repoName) => {
                if (this.obj.hasOwnProperty(repoName)) {
                    if (this.debug) {
                        console.log('repo', repoName);
                    }

                    const repoProperties = this.obj[repoName];
                    if (this.debug) {
                        console.log('repoProperties', repoProperties);
                    }

                    const repoGit = Git.repoGit(repoName);

                    promises.push(Git.status(repoGit, repoName, repoProperties, this.force, this.debug));
                    promises.push(Git.revParseHead(repoGit, repoName, repoProperties, this.debug));
                }
            });

            try {
                await Promise.all(promises);
                if (this.debug) {
                    console.log('status and revparse successfully completed');
                }
                const newPropertiesAsString = JSON.stringify(this.obj, null, 2).replace(/[\n\r]/g, os.EOL);
                if (this.debug) {
                    console.log('newPropertiesAsString', newPropertiesAsString);
                }

                await fs.writeFileAsync(propertiesFileName, newPropertiesAsString, {});
                console.log(propertiesFileName + ' has been saved');
            } catch (e) {
                console.log('an error occurred:', e);
            }

            resolve();
        });
    }
}
