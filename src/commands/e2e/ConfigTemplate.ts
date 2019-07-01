import {E2E} from './E2E';

export class ConfigTemplate {
    private readonly template: string;

    constructor(mainRepoDir: string, e2eFolder: string,
                specs: string, browser: string, baseUrl: string,
                timeout: number, headless: boolean, noInstall: boolean) {
        let capabilities = '';
        if (headless) {
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

        this.template = `exports.config = {
            before: function () {
                var config = require('${e2eFolder}/tsconfig.json');
                require('${mainRepoDir}/node_modules/tsconfig-paths').register({
                   baseUrl: '${e2eFolder}',
                   paths: config.compilerOptions.paths || []
               });
                require('${mainRepoDir}/node_modules/ts-node').register({
                    files: true,
                    project: '${e2eFolder}/tsconfig.json'
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
            framework: 'jasmine',
            jasmineNodeOpts: {
                defaultTimeoutInterval: ${timeout}
            },
            plugins: {
                webdriverajax: {}
            },
            ${ieDriver}
            reporters: ['spec']
        };`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
