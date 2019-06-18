/**
 * Main E2E command
 */
import {ICommand, ICommandParameters} from '../models';
import {WdioConfigGenerator} from './WdioConfigGenerator';
import {TestRunner} from './TestRunner';
import {Global} from '../../Global';
import * as path from 'path';
import * as fs from 'fs';

export class E2E implements ICommand {
    private static readonly PARAMETER_BASE_URL: string = 'baseUrl';
    private static readonly PARAMETER_PLUGINS: string = 'plugins';
    private static readonly PARAMETER_BROWSER: string = 'browser';
    private static readonly PARAMETER_TIMEOUT: string = 'timeout';
    private static readonly PARAMETER_HEADLESS: string = 'headless';
    // Default
    private static readonly DEFAULT_BASE_URL: string = 'http://localhost:8083/';
    private static readonly DEFAULT_BROWSER: string = 'chrome';
    private static readonly DEFAULT_TIMEOUT: number = 30000;

    private pluginsToBeTested: string [];
    private baseUrl: string;
    private browser: string;
    private workingDir: string;
    private timeout: number;
    private headless: boolean;

    private testRunner: TestRunner | null = null;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.workingDir = process.cwd();

        const plugins = params[E2E.PARAMETER_PLUGINS];
        if (typeof plugins === 'string' && plugins.length > 0) {
            this.pluginsToBeTested = plugins.split(',').filter((plugin) => this.hasE2EAssets(plugin));
            if (this.pluginsToBeTested.length === 0) {
                console.error('All of the specified plugins do not have E2E assets or are not ready (see --verbose)');
                return false;
            }
        } else {
            this.pluginsToBeTested = this.findAllPluginsInWorkingDirectory();
        }

        console.log('Running E2E tests for: ', this.pluginsToBeTested.join(', '));

        const baseUrl = params[E2E.PARAMETER_BASE_URL];
        if (typeof baseUrl === 'string' && baseUrl.length > 0) {
            this.baseUrl = baseUrl;
        } else {
            this.baseUrl = E2E.DEFAULT_BASE_URL;
        }

        const browser = params[E2E.PARAMETER_BROWSER];
        if (typeof browser === 'string' && browser.length > 0) {
            this.browser = browser;
        } else {
            this.browser = E2E.DEFAULT_BROWSER;
        }

        const timeout = params[E2E.PARAMETER_TIMEOUT];
        if (typeof timeout === 'number') {
            this.timeout = timeout;
        } else {
            this.timeout = E2E.DEFAULT_TIMEOUT;
        }

        const headless = params[E2E.PARAMETER_HEADLESS];
        if (typeof headless === 'boolean') {
            this.headless = headless;
        }

        if (this.browser.toLowerCase() !== 'chrome') {
            this.headless = false;
        }

        this.testRunner = new TestRunner(this.pluginsToBeTested, this.workingDir);
        if (!this.testRunner.isWdioExecutableAvailable()) {
            console.error(`Failed to find wdio executable - make sure node_modules are installed in the main repository and you are on a branch based on 4.57 or higher`);
            return false;
        }

        return true;
    }

    public execute(): Promise<void> {
        if (this.pluginsToBeTested.length === 0) {
            return Promise.resolve();
        }

        const wdioGenerator = new WdioConfigGenerator(this.pluginsToBeTested, this.baseUrl, this.browser, this.timeout, this.workingDir, this.headless);
        console.log('Generating WDIO configuration files...');
        wdioGenerator.generateWdioConfig();
        console.log('Starting test runner...');

        return this.testRunner.runTests();
    }

    private hasE2EAssets(plugin: string): boolean {
        const pathToE2EAssets = path.join(this.workingDir, plugin, 'assets', 'e2e');
        if (!fs.existsSync(pathToE2EAssets)) {
            Global.isVerbose() && console.error(`Plugin ${plugin} does not have E2E assets - expected at: ${pathToE2EAssets}`);
            return false;
        }

        const pathToTsConfig = path.join(pathToE2EAssets, 'tsconfig.json');
        if (!fs.existsSync(pathToTsConfig)) {
            Global.isVerbose() && console.error(`Plugin ${plugin} does not have E2E tsconfig.json - run cplace-asc first`);
            return false;
        }

        return true;
    }

    private findAllPluginsInWorkingDirectory(): string[] {
        return fs.readdirSync(this.workingDir)
            .filter((name) => fs.statSync(path.join(this.workingDir, name)).isDirectory())
            .filter((name) => this.hasE2EAssets(name));
    }
}
