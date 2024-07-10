import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { getPathToE2E, getPathToSpecFiles } from './util';
import { WdioConfigGenerator } from './WdioConfigGenerator';

export class TestRunner {

    private readonly plugins: string[];
    private readonly workingDir: string;
    private readonly mainRepoDir: string;
    private readonly specsParameter: string;

    constructor(
        plugins: string[],
        workingDir: string,
        mainRepoDir: string,
        specsParameter: string
    ) {
        this.workingDir = workingDir;
        this.plugins = plugins;
        this.mainRepoDir = mainRepoDir;
        this.specsParameter = specsParameter;
    }

    public async runTests(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const launcherModule = require(this.getWdioCliExecutable());
        let hasFailedTest: boolean = false;
        for (const plugin of this.plugins) {
            if (!this.specsParameter || (this.specsParameter && this.isSpecInPlugin(plugin))) {
                const e2eAssetPath = getPathToE2E(this.workingDir, plugin);
                const wdioConf = path.join(e2eAssetPath, WdioConfigGenerator.WDIO_CONF_NAME);

                process.chdir(this.mainRepoDir);
                const launcher = new launcherModule.default(wdioConf, { args: [''] });
                let testsFailed = false;
                try {
                    const exitCode = await launcher.run();
                    testsFailed = exitCode !== 0;
                } catch (e) {
                    testsFailed = true;
                } finally {
                    process.chdir(this.workingDir);
                }

                if (testsFailed) {
                    hasFailedTest = true;
                    console.warn(`One of the E2E Tests in plugin ${plugin} has failed`);
                }
            }
        }
        if (hasFailedTest) {
            throw new Error(`One of the E2E Tests has failed`);
        }
    }

    public isSpecInPlugin(plugin: string): boolean {
        const specsFolder = getPathToSpecFiles(this.workingDir, plugin);
        return glob.sync(path.join(specsFolder, this.specsParameter)).length > 0;
    }

    public isWdioExecutableAvailable(): boolean {
        return fs.existsSync(this.getWdioCliExecutable());
    }

    private getWdioCliExecutable(): string {
        if (!fs.existsSync(this.mainRepoDir)) {
            console.error(`Could not find main repository :( Expected it at: ${this.mainRepoDir}`);
            throw new Error();
        }

        return path.resolve(
            this.mainRepoDir,
            'node_modules',
            '@wdio',
            'cli',
            'build',
            'launcher.js'
        );
    }
}
