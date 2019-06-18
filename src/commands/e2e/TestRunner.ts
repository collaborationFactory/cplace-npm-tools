import * as path from 'path';
import * as fs from 'fs';
import {WdioConfigGenerator} from './WdioConfigGenerator';

export class TestRunner {

    private readonly plugins: string[];
    private readonly workingDir: string;

    constructor(plugins: string[],
                workingDir: string) {
        this.workingDir = workingDir;
        this.plugins = plugins;
    }

    public async runTests(): Promise<void> {
        const launcherModule = require(this.getWdioCliExecutable());
        for (const plugin of this.plugins) {
            const wdioConf = path.join(this.workingDir, plugin, 'assets', 'e2e', WdioConfigGenerator.WDIO_CONF_NAME);
            const launcher = new launcherModule.default(wdioConf, {args: ['']});
            await launcher.run();
        }
    }

    public isWdioExecutableAvailable(): boolean {
        return fs.existsSync(this.getWdioCliExecutable());
    }

    private getWdioCliExecutable(): string {
        let mainRepoDir;
        if (fs.existsSync(path.join(this.workingDir, 'cf.cplace.platform'))) {
            mainRepoDir = this.workingDir;
        } else {
            mainRepoDir = path.join(this.workingDir, '..', 'main');
            if (!fs.existsSync(mainRepoDir)) {
                console.error(`Could not find main repository :( Expected it at: ${mainRepoDir}`);
                throw new Error();
            }
        }

        return path.resolve(
            mainRepoDir,
            'node_modules',
            '@wdio',
            'cli',
            'build',
            'launcher.js'
        );
    }
}
