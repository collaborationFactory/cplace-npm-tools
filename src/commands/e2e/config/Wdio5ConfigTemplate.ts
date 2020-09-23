import { IE2EContext } from '../E2EEnvTemplate';
import { ConfigTemplate } from './ConfigTemplate';

export class Wdio5ConfigTemplate extends ConfigTemplate {

    constructor(
        mainRepoDir: string, e2eFolder: string,
        specs: string, browser: string, baseUrl: string, context: IE2EContext,
        timeout: number, headless: boolean, noInstall: boolean,
        jUnitReportPath: string,
        allureOutputPath: string,
        screenShotPath: string,
        e2eToken: string
    ) {
        super(
            mainRepoDir, e2eFolder,
            specs, browser, baseUrl, context,
            timeout, headless, noInstall,
            jUnitReportPath, allureOutputPath, screenShotPath,
            e2eToken
        );
    }

    protected getBeforeHook(): string {
        return `const config = require('${this.e2eFolder}/tsconfig.json');
        require('${this.mainRepoDir}/node_modules/tsconfig-paths').register({
           baseUrl: '${this.e2eFolder}',
           paths: config.compilerOptions.paths || []
       });
        require('${this.mainRepoDir}/node_modules/ts-node').register({
            files: true,
            project: '${this.e2eFolder}/tsconfig.json'
        });`;
    }

}