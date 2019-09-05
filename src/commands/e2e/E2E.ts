/**
 * Main E2E command
 */
import {ICommand, ICommandParameters} from '../models';
import {WdioConfigGenerator} from './WdioConfigGenerator';
import {TestRunner} from './TestRunner';
import {Global} from '../../Global';
import * as path from 'path';
import * as fs from 'fs';
import {IE2EContext} from './E2EEnvTemplate';
import {getPathToMainRepo} from '../../util';

export class E2E implements ICommand {
    public static readonly IE: string = 'internet explorer';
    public static readonly EDGE: string = 'MicrosoftEdge';

    private static readonly PARAMETER_BASE_URL: string = 'baseUrl';
    private static readonly PARAMETER_CONTEXT: string = 'context';
    private static readonly PARAMETER_TENANTID: string = 'tenantId';
    private static readonly PARAMETER_E2E_TOKEN: string = 'e2eToken';

    private static readonly PARAMETER_PLUGINS: string = 'plugins';
    private static readonly PARAMETER_SPECS: string = 'specs';
    private static readonly PARAMETER_BROWSER: string = 'browser';
    private static readonly PARAMETER_TIMEOUT: string = 'timeout';
    private static readonly PARAMETER_HEADLESS: string = 'headless';
    private static readonly PARAMETER_NO_INSTALL: string = 'noInstall';
    private static readonly PARAMETER_JUNIT: string = 'jUnit';
    private static readonly PARAMETER_SCREENSHOT: string = 'screenshot';

    // Default
    private static readonly DEFAULT_BASE_URL: string = 'http://localhost:8083';
    private static readonly DEFAULT_CONTEXT: string = '/intern/tricia/';
    private static readonly DEFAULT_BROWSER: string = 'chrome';
    private static readonly DEFAULT_TIMEOUT: number = 30000;
    private static readonly DEFAULT_JUNITREPORTPATH: string = './e2eJunitReports';
    private static readonly DEFAULT_SCREEENSHOTPATH: string = './e2eScreenshots';

    private workingDir: string;
    private mainRepoDir: string;

    private baseUrl: string;
    private context: string;
    private tenantId: string;
    private e2eToken: string;

    private pluginsToBeTested: string[];
    private specs: string;
    private browser: string;
    private timeout: number;
    private headless: boolean;
    private noInstall: boolean;
    private jUnitReportPath: string;
    private screenshotPath: string;

    private testRunner: TestRunner | null = null;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.workingDir = process.cwd();
        this.mainRepoDir = getPathToMainRepo(this.workingDir);
        if (!this.mainRepoDir) {
            console.error(`Could not determine path to main repo!`);
            return false;
        }

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

        const specs = params[E2E.PARAMETER_SPECS];
        if (typeof specs === 'string' && specs.length > 0) {
            this.specs = specs;
        }

        // NOTE: The slashes of baseUrl and context need to match the
        // specifications required by the cplace base system. Also see the E2EENV
        // comments in main.

        const baseUrl = params[E2E.PARAMETER_BASE_URL] || params[E2E.PARAMETER_BASE_URL.toLowerCase()];
        if (typeof baseUrl === 'string' && baseUrl.length > 0) {
            this.baseUrl = baseUrl;
            if (this.baseUrl.endsWith('/')) {
                this.baseUrl = this.baseUrl.substr(0, this.baseUrl.length - 1);
            }
        } else {
            this.baseUrl = E2E.DEFAULT_BASE_URL;
        }

        const context = params[E2E.PARAMETER_CONTEXT];
        if (typeof context === 'string' && context.length > 0) {
            this.context = context;
            if (!this.context.startsWith('/')) {
                this.context = '/' + this.context;
            }
            if (!this.context.endsWith('/')) {
                this.context += '/';
            }
        } else {
            this.context = E2E.DEFAULT_CONTEXT;
        }

        const tenantId = params[E2E.PARAMETER_TENANTID] || params[E2E.PARAMETER_TENANTID.toLowerCase()];
        if (typeof tenantId === 'string' && tenantId.length > 0) {
            this.tenantId = tenantId;
        } else {
            this.tenantId = '';
        }

        const e2eToken = params[E2E.PARAMETER_E2E_TOKEN] || params[E2E.PARAMETER_E2E_TOKEN.toLowerCase()];
        if (typeof e2eToken === 'string' && e2eToken.length > 0) {
            this.e2eToken = e2eToken;
        } else {
            this.e2eToken = '';
        }

        const browser = params[E2E.PARAMETER_BROWSER];
        if (typeof browser === 'string' && browser.length > 0) {
            if (browser.toLowerCase().includes('ie') || browser.toLowerCase().includes('internet') || browser.toLowerCase().includes('explorer')) {
                this.browser = E2E.IE;
            } else if (browser.toLowerCase().includes('edge')) {
                this.browser = E2E.EDGE;
            } else {
                this.browser = browser;
            }
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

        const jUnit = params[E2E.PARAMETER_JUNIT] || params[E2E.PARAMETER_JUNIT.toLowerCase()];
        if (typeof jUnit === 'string' && jUnit.length > 0) {
            this.jUnitReportPath = jUnit;
        } else if (typeof jUnit === 'boolean') {
            this.jUnitReportPath = E2E.DEFAULT_JUNITREPORTPATH;
        }

        const screenshot = params[E2E.PARAMETER_SCREENSHOT];
        if (typeof screenshot === 'string' && screenshot.length > 0) {
            this.screenshotPath = screenshot;
        } else if (typeof screenshot === 'boolean') {
            this.screenshotPath = E2E.DEFAULT_SCREEENSHOTPATH;
        }

        const noInstall = params[E2E.PARAMETER_NO_INSTALL] || params[E2E.PARAMETER_NO_INSTALL.toLowerCase()];
        if (typeof noInstall === 'boolean') {
            this.noInstall = noInstall;
        } else {
            this.noInstall = false;
        }

        if ((((this.browser.toLowerCase() !== 'firefox') && this.browser.toLowerCase() !== 'chrome') && this.headless)) {
            this.headless = false;
            console.error(`! Headless disabled - only available for Chrome and Firefox execution`);
        }

        this.testRunner = new TestRunner(this.pluginsToBeTested, this.workingDir, this.mainRepoDir);
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

        const context: IE2EContext = {
            baseUrl: this.baseUrl,
            context: this.context,
            tenantId: this.tenantId,
            e2eToken: this.e2eToken
        };

        const wdioGenerator = new WdioConfigGenerator(
            this.workingDir, this.mainRepoDir,
            this.pluginsToBeTested, this.specs, this.browser, context,
            this.timeout, this.headless, this.noInstall, this.jUnitReportPath, this.screenshotPath
        );

        console.log('Generating WDIO configuration files...');
        wdioGenerator.generateE2EEnv();
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
