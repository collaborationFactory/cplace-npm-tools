import {ConfigTemplate} from './ConfigTemplate';
import * as path from 'path';
import * as fs from 'fs';
import {E2EEnvTemplate} from './E2EEnvTemplate';

export class WdioConfigGenerator {
    public static readonly WDIO_CONF_NAME: string = 'wdio.conf.js';
    public static readonly E2E_ENV_NAME: string = 'e2e.ts';
    private readonly baseUrl: string;
    private readonly context: string;
    private readonly tenantId: string = '';
    private readonly plugins: string[];
    private readonly browser: string;
    private readonly timeout: number;
    private readonly workingDir: string;
    private readonly headless: boolean;

    constructor(plugins: string[], baseUrl: string, browser: string, context: string, tenantId: string, timeout: number, workingDir: string, headless: boolean) {
        this.browser = browser;
        this.plugins = plugins;
        this.baseUrl = baseUrl;
        this.context = context;
        this.tenantId = tenantId;
        this.timeout = timeout;
        this.workingDir = workingDir;
        this.headless = headless;
    }

    public generateE2EEnv(): void {
        const e2eFolder = this.pathToE2EFolder('cf.cplace.platform');
        const e2eEnv = new E2EEnvTemplate(this.baseUrl, this.context, this.tenantId);
        fs.writeFileSync(path.join(e2eFolder, 'lib', 'config', WdioConfigGenerator.E2E_ENV_NAME), e2eEnv.getTemplate(), {encoding: 'utf8'});
    }

    public generateWdioConfig(): void {
        this.plugins.forEach((plugin) => {
            const e2eFolder = this.pathToE2EFolder(plugin);
            const config = new ConfigTemplate(e2eFolder, this.browser, this.baseUrl, this.timeout, this.headless);
            fs.writeFileSync(path.join(e2eFolder, WdioConfigGenerator.WDIO_CONF_NAME), config.getTemplate(), {encoding: 'utf8'});
        });
    }

    private pathToE2EFolder(pluginName: string): string {
        const e2ePath = path.join(this.workingDir, pluginName, 'assets', 'e2e');
        return e2ePath.replace(/\\/g, '/');  // For Windows
    }

}
