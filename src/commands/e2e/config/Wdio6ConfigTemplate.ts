import * as path from 'path';
import { IE2EContext } from '../E2EEnvTemplate';
import { ConfigTemplate } from './ConfigTemplate';

export class Wdio6ConfigTemplate extends ConfigTemplate {

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

    protected getPreConfigExport(): string {
        const tsconfigPath = path.join(this.e2eFolder, 'tsconfig.json');
        return `process.env.TS_NODE_PROJECT = "${tsconfigPath}";`;
    }

    protected getMochaRequires(): string[] {
        return ['ts-node/register', 'tsconfig-paths/register'];
    }

}