export class ConfigTemplate {
    private readonly template: string;

    constructor(e2eFolder: string, browser: string, baseUrl: string, timeout: number, headless: boolean) {
        let capabilities = '';
        if (headless) {
            capabilities = `
            capabilities: [{
                maxInstances: 1,
                browserName: '${browser}',
                'goog:chromeOptions': {
                    args: [
                        '--headless',
                        '--disable-gpu'
                    ]
                }
            }],`;
        } else {
            capabilities = `
            capabilities: [{
                maxInstances: 1,
                browserName: '${browser}'
            }],`;
        }

        this.template = `exports.config = {
            before: function () {
                var config = require('${e2eFolder}/tsconfig.json');
                require('tsconfig-paths').register({
                   baseUrl: '${e2eFolder}',
                   paths: config.compilerOptions.paths || []
               });
                require('ts-node').register({
                    files: true,
                    project: '${e2eFolder}/tsconfig.json'
                });
            },
            runner: 'local',
            specs: [
                '${e2eFolder}/specs/**/*.spec.ts'
            ],
            exclude: [],
            maxInstances: 1,
            ${capabilities}
            logLevel: 'info',
            bail: 0,
            baseUrl: '${baseUrl}',
            waitforTimeout: 100000,
            connectionRetryTimeout: 90000,
            connectionRetryCount: 3,
            services: ['selenium-standalone', 'intercept'],
            framework: 'jasmine',
            jasmineNodeOpts: {
                defaultTimeoutInterval: ${timeout}
            },
            plugins: {
                webdriverajax: {}
            },
            reporters: ['spec']
        };`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
