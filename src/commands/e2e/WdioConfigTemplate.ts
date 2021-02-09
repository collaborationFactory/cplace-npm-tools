import * as path from 'path';
import {E2E} from './E2E';
import {IE2EContext} from './E2EEnvTemplate';
import {WdioConfigGenerator} from './WdioConfigGenerator';

export class WdioConfigTemplate {
    private readonly template: string;
    private listPluginsURL: string = 'application/administrationDashboard/listPlugins';

    // tslint:disable-next-line:max-func-body-length
    constructor(
        protected readonly mainRepoDir: string,
        protected readonly workingDir: string,
        protected readonly e2eFolder: string,
        protected readonly specs: string,
        protected readonly browser: string,
        protected readonly baseUrl: string,
        protected readonly context: IE2EContext,
        protected readonly timeout: number,
        protected readonly headless: boolean,
        protected readonly noInstall: boolean,
        protected readonly jUnitReportPath: string,
        protected readonly allureOutputPath: string,
        protected readonly screenShotPath: string,
        protected readonly e2eToken: string,
        protected readonly logLevel: string,
        protected readonly devTools: boolean,
        protected readonly imageComparison: boolean,
        protected readonly specFileRetries: number
    ) {
        const tenant: string = context.tenantId.length > 0 ? context.tenantId + '/' : '';
        if (context.context.length === 0 && context.tenantId.length === 0) {
            this.listPluginsURL = '/' + this.listPluginsURL;
        }

        const capabilities = this.getCapabilities();

        let ieDriver: string = '';
        if (browser === E2E.IE) {
            ieDriver = this.getIEDriver();
        }

        let junitConfig = '';
        if (jUnitReportPath) {
            junitConfig = ', ' + this.getJunitConfig();
        }

        let allureConfig = '';
        if (allureOutputPath) {
            allureConfig = ', ' + this.getAllureConfig();
        }

        let screenshotConfig = '';
        if (screenShotPath) {
            screenshotConfig = this.getScreenshotConfig();
        }

        let wdioImageCoimparisonConfig = '';
        if (imageComparison) {
            wdioImageCoimparisonConfig = ', ' + this.getImageComparisonConfig();
        }

        const preConfigExport = this.getPreConfigExport();
        const mochaRequires = this.getMochaRequires();

        this.template =
            `const fs = require('fs');
const path = require('path');
const request = require('${WdioConfigGenerator.safePath(mainRepoDir)}/node_modules/request');

${preConfigExport}

exports.config = {
    before: function () {
        return new Promise(function(resolve, reject) {
            return request('${baseUrl}${context.context}${tenant}${this.listPluginsURL}?testSetupHandlerE2EToken=${e2eToken}', function(error, response, body) {
                if (error) {
                    console.error('No plugins could be detected in the cplace application under test: ', error);
                    process.send({
                        event: 'runner:end',
                        failures: 1
                    });
                    process.exit(1);
                }   else if (!response.headers['content-type'] || response.headers['content-type'].indexOf("application/json") === -1) {
                    console.error('No plugins could be detected in the cplace application under test because the response is no json.\\n' +
                    'Most likely this is because cplace is not initialized completely but already responding.\\n' +
                    'Content-type of response: ', response.headers['content-type']);
                    process.send({
                        event: 'runner:end',
                        failures: 1
                    });
                    process.exit(1);
                }   else if (response.headers['content-type'] && response.headers['content-type'].indexOf("application/json") !== -1) {
                    var listOfPlugins = [];
                    try {
                        JSON.parse(body).forEach(function(plugin) {
                            listOfPlugins.push({
                                pluginName: plugin.pluginName,
                                isActive: plugin.isActive
                            });
                        });
                    } catch (e) {
                        console.error('Failed to parse plugins from body:');
                        console.error(body);
                        reject(e);
                    }
                    console.log('Cplace has the following plugins ' + JSON.stringify(listOfPlugins));
                    browser.plugins = listOfPlugins;
                    resolve();
                }
            });
        });
    },
    runner: 'local',
    specs: [
        '${e2eFolder}/specs/${specs || '**/*.spec.ts'}'
    ],
    exclude: [],
    maxInstances: 1,
    capabilities: ${capabilities},
    logLevel: '${logLevel}',
    bail: 0,
    baseUrl: '${baseUrl}',
    waitforTimeout: 25000,
    connectionRetryTimeout: 90000,
    connectionRetryCount: 3,
    services: [['selenium-standalone', { logPath: './seleniumLogs' }], 'intercept' ${devTools ? ', \'devtools\'' : ''} ${wdioImageCoimparisonConfig}],
    skipSeleniumInstall: ${noInstall ? 'true' : 'false'},
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: ${timeout},
        require: ${JSON.stringify(mochaRequires)}
     },
    specFileRetries: ${specFileRetries},
    specFileRetriesDelay: 0,
    specFileRetriesDeferred: false,
    plugins: {
        webdriverajax: {}
    },
    afterTest: function(test) {
    ${screenshotConfig}
    },
    ${ieDriver}
    reporters: ['spec' ${junitConfig} ${allureConfig} ]
};`;
    }

    public getTemplate(): string {
        return this.template;
    }

    protected getCapabilities(): string {
        if (this.browser.toLowerCase() === 'chrome') {
            if (this.headless) {
                return `[{
                maxInstances: 1,
                browserName: '${this.browser}',
                'goog:chromeOptions': {
                    w3c: false,
                    args: [
                        '--headless',
                        '--disable-gpu',
                        '--disable-dev-shm-usage',
                        '--no-sandbox',
                    ]
                }
            }]`;
            } else {
                return `[{
                maxInstances: 1,
                browserName: '${this.browser}',
                'goog:chromeOptions': {
                    w3c: false
                }
            }]`;
            }
        } else if (this.headless && this.browser.toLowerCase() === 'firefox') {
            return `[{
                maxInstances: 1,
                browserName: '${this.browser}',
                'moz:firefoxOptions': {
                    'args': ['-headless']
                }
            }]`;
        } else {
            return `[{
                maxInstances: 1,
                browserName: '${this.browser}'
            }]`;
        }
    }

    protected getIEDriver(): string {
        return `
            seleniumArgs: {
                baseURL: 'https://selenium-release.storage.googleapis.com',
                drivers: {
                    ie: {
                        version: '3.4.0',
                        arch: 'ia32',
                        baseURL: 'https://selenium-release.storage.googleapis.com'
                    }
                }
            },
            seleniumInstallArgs: {
                baseURL: 'https://selenium-release.storage.googleapis.com',
                drivers: {
                    ie: {
                        version: '3.4.0',
                        arch: 'ia32',
                        baseURL: 'https://selenium-release.storage.googleapis.com'
                    }
                }
            },`;
    }

    protected getJunitConfig(): string {
        return `['junit', {
                outputDir: '${WdioConfigGenerator.safePath(path.resolve(this.jUnitReportPath))}',
                outputFileFormat:
                    function(opts) {
                        return \`e2e.xunit.\${opts.capabilities.browserName}.\${new Date().toISOString().replace(/[:]/g, '-')}.xml\`;
                    }
                }]`;
    }

    protected getAllureConfig(): string {
        return `['allure', { outputDir: '${WdioConfigGenerator.safePath(path.resolve(this.allureOutputPath))}' }]`;

    }

    protected getScreenshotConfig(): string {
        return `if (!test.passed) {
            let screenshotDir = '${WdioConfigGenerator.safePath(path.join(this.workingDir, this.screenShotPath))}';
            screenshotDir = path.join(screenshotDir, test.parent.replace(/[^a-z0-9]/gi, '_').toLowerCase())

            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }

            const filePath = path.join(
                screenshotDir,
                new Date().toISOString().replace(/[:]/g, '-') + '_' + test.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            );

            browser.saveScreenshot(filePath + '.png');
        }`;
    }

    protected getPreConfigExport(): string {
        const tsconfigPath = WdioConfigGenerator.safePath(path.join(this.e2eFolder, 'tsconfig.json'));
        return `process.env.TS_NODE_PROJECT = "${tsconfigPath}";`;
    }

    protected getMochaRequires(): string[] {
        return ['ts-node/register', 'tsconfig-paths/register'];
    }

    protected getImageComparisonConfig(): string {
        return ` ['image-comparison',{
            baselineFolder: path.join(process.cwd(), './e2eImageComparisonBaseline/'),
            formatImageName: '{tag}-{logName}-{width}x{height}',
            screenshotPath: path.join(process.cwd(), './e2eImageComparisonTemp/'),
            savePerInstance: true,
            autoSaveBaseline: true,
            blockOutStatusBar: true,
            blockOutToolBar: true,
        }],`;

    }
}
