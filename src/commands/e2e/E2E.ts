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
    private static readonly BASE_URL: string = 'baseUrl';
    private static readonly PLUGINS: string = 'plugins';
    private static readonly BROWSER: string = 'browser';

    private static readonly TIMEOUT: string = 'timeout';
    private static readonly HEADLESS: string = 'headless';
    private static readonly DEFAULT_BASE_URL: string = 'http://localhost:8083/';
    private static readonly DEFAULT_BROWSER: string = 'chrome';
    private static readonly DEFAULT_TIMEOUT: number = 30000;
    private static readonly DEFAULT_HEADLESS: boolean = false;

    private pluginsToBeTested: string [];
    private baseUrl: string;
    private browser: string;
    private workingDir: string;
    private timeout: number;
    private headless: boolean;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.workingDir = process.cwd();

        const plugins = params[E2E.PLUGINS];
        if (typeof plugins === 'string' && plugins.length > 0) {
            this.pluginsToBeTested = plugins.split(',').filter((plugin) => this.hasE2EAssets(plugin));

            if (this.pluginsToBeTested.length === 0) {
                console.error('All of the specified plugins do not have E2E assets or are not ready (see --verbose)');
                return false;
            }
        } else {
            Global.isVerbose() && console.log('Running E2E tests for all plugins...');
            this.pluginsToBeTested = this.findAllPluginsInWorkingDirectory();
            console.log('Running E2E tests for: ', this.pluginsToBeTested.join(', '));
        }

        const baseUrl = params[E2E.BASE_URL];
        if (typeof baseUrl === 'string' && baseUrl.length > 0) {
            this.baseUrl = baseUrl;
        } else {
            this.baseUrl = E2E.DEFAULT_BASE_URL;
        }

        const browser = params[E2E.BROWSER];
        if (typeof browser === 'string' && browser.length > 0) {
            this.browser = browser;
        } else {
            this.browser = E2E.DEFAULT_BROWSER;
        }

        const timeout = params[E2E.TIMEOUT];
        if (typeof timeout === 'number') {
            this.timeout = timeout;
        } else {
            this.timeout = E2E.DEFAULT_TIMEOUT;
        }

        const headless = params[E2E.HEADLESS];
        if (typeof headless === 'boolean') {
            this.headless = true;
        } else {
            this.headless = E2E.DEFAULT_HEADLESS;
        }

        return true;
    }

    public execute(): Promise<void> {
        const wdioGenerator = new WdioConfigGenerator(this.pluginsToBeTested, this.baseUrl, this.browser, this.timeout, this.workingDir, this.headless);
        console.log('Generation WDIO configuration files...');
        wdioGenerator.generateWdioConfig();
        console.log('Starting test runner...');

        const testRunner = new TestRunner(this.pluginsToBeTested, this.workingDir);
        return testRunner.runTests();
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
