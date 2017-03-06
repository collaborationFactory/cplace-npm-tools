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
        return new Promise<null>((resolve, reject) => {
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
                    promises.push(Git.status(repoGit, repoName, repoProperties, this.debug));
                    promises.push(Git.revParseHead(repoGit, repoName, repoProperties, this.debug));
                }
            });

            Promise.all(promises).then(
                (result) => {
                    if (this.debug) {
                        console.log('status and revparse successfully completed');
                    }
                    const newPropertiesAsString = JSON.stringify(this.obj, null, 2).replace(/[\n\r]/g, os.EOL);
                    if (this.debug) {
                        console.log('newPropertiesAsString', newPropertiesAsString);
                    }

                    fs.writeFileAsync(propertiesFileName, newPropertiesAsString, (err) => {
                        if (err) {
                            return console.log('an error occured while writing ' + propertiesFileName, err);
                        } else {
                            console.log(propertiesFileName + ' has been saved');
                        }
                    });
                },
                (err) => {
                    console.log('an error occurred:', err);
                });

            resolve();
        });
    }
}
