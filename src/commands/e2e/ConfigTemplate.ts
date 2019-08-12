import {E2E} from './E2E';
import * as path from 'path';
import {WdioConfigGenerator} from './WdioConfigGenerator';

export class ConfigTemplate {
    private readonly template: string;
    private readonly listPluginsURL: string = 'application/administrationDashboard/listPlugins';

    // tslint:disable-next-line:max-func-body-length
    constructor(mainRepoDir: string, e2eFolder: string,
                specs: string, browser: string, baseUrl: string, context: string,
                timeout: number, headless: boolean, noInstall: boolean, jUnitReportPath: string, screenShotPath: string, e2eToken: string) {
        let capabilities = '';
        if (headless && browser.toLowerCase() === 'chrome') {
            capabilities = `[{
                maxInstances: 1,
                browserName: '${browser}',
                'goog:chromeOptions': {
                    args: [
                        '--headless',
                        '--disable-gpu'
                    ]
                }
            }]`;
        } else if (headless && browser.toLowerCase() === 'firefox') {
            capabilities = `[{
                maxInstances: 1,
                browserName: '${browser}',
                'moz:firefoxOptions': {
                    'args': ['-headless']
                }
            }]`;
        } else {
            capabilities = `[{
                maxInstances: 1,
                browserName: '${browser}'
            }]`;
        }

        let ieDriver: string = '';
        if (browser === E2E.IE) {
            ieDriver = `
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
        let junitConfig = '';
        if (jUnitReportPath) {
            junitConfig = `, ['junit', {
                outputDir: '${WdioConfigGenerator.safePath(path.resolve(jUnitReportPath))}',
                outputFileFormat:
                    function(opts) {
                        return \`e2e.xunit.\${opts.capabilities.browserName}.\${new Date().toISOString().replace(/[:]/g, '-')}.xml\`;
                    }
                }]`;
        }

        let screenshotConfig = '';
        if (screenShotPath) {
            screenshotConfig = `if (!test.passed) {
            let screenshotDir = '${WdioConfigGenerator.safePath(path.join(screenShotPath))}';
            screenshotDir = path.join(screenshotDir, test.parent.replace(/[^a-z0-9]/gi, '_').toLowerCase())

            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }

            const filePath = path.join(
                screenshotDir,
                new Date().toISOString().replace(/[:]/g, '-') + '_' + test.fullTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            );

            browser.saveScreenshot(filePath + '.png');
        }`;
        }

        this.template =
            `const fs = require('fs');
const path = require('path');
const request = require('${mainRepoDir}/node_modules/request');

exports.config = {
    before: function () {
        const config = require('${e2eFolder}/tsconfig.json');
        require('${mainRepoDir}/node_modules/tsconfig-paths').register({
           baseUrl: '${e2eFolder}',
           paths: config.compilerOptions.paths || []
       });
        require('${mainRepoDir}/node_modules/ts-node').register({
            files: true,
            project: '${e2eFolder}/tsconfig.json'
        });
        return new Promise(function(resolve) {
            return request('${baseUrl}${context}${this.listPluginsURL}?testSetupHandlerE2EToken=${e2eToken}', function(error, response, body) {
                if (error) {
                    console.error('Cplace instance is not reachable:', error);
                    process.send({
                        event: 'runner:end',
                        failures: 1
                    });
                    process.exit(1);
                } else {
                    var listOfPlugins = [];
                    JSON.parse(body).forEach(function(plugin) {
                        listOfPlugins.push({
                            pluginName: plugin.pluginName,
                            isActive: plugin.isActive
                        });
                    });
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
    logLevel: 'info',
    bail: 0,
    baseUrl: '${baseUrl}',
    waitforTimeout: 100000,
    connectionRetryTimeout: 90000,
    connectionRetryCount: 3,
    services: ['selenium-standalone', 'intercept'],
    skipSeleniumInstall: ${noInstall ? 'true' : 'false'},
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: ${timeout}
     },
    plugins: {
        webdriverajax: {}
    },
    afterTest: function(test) {
    ${screenshotConfig}
    },
    ${ieDriver}
    reporters: ['spec'
    ${junitConfig}
    ]
};`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
