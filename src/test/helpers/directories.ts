import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import rimraf = require('rimraf');

export function createTempDirectory(suffix: string): string {
    const dirPath = path.join(
        os.tmpdir(),
        `${new Date().getTime()}-cplace-cli-test-${suffix}`
    );
    fs.mkdirSync(dirPath);
    return dirPath;
}

// tslint:disable-next-line:no-any
export function withTempDirectory(suffix: string, func: (dir: string, ...args: any[]) => Promise<void>, ...args: any[]): Promise<void> {
    // tslint:disable-next-line:promise-must-complete
    return new Promise((resolve, reject) => {
        const cleanup = (error?: Error) => {
            rimraf(dir, (e) => {
                if (e) {
                    console.error('failed to remove directory', e);
                }
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        };

        const dir = createTempDirectory(suffix);
        func(dir, ...args)
            .then(() => {
                cleanup();
            })
            .catch((error) => {
                cleanup(error);
            });
    });
}
