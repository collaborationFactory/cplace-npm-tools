import {ConfigTemplate} from './ConfigTemplate';
import * as path from 'path';
import * as fs from 'fs';
import {E2EEnvTemplate, IE2EContext} from './E2EEnvTemplate';

export class WdioConfigGenerator {
    public static readonly WDIO_CONF_NAME: string = 'wdio.conf.js';
    public static readonly E2E_ENV_NAME: string = 'e2e.ts';

    private readonly workingDir: string;
    private readonly mainDir: string;
    private readonly context: IE2EContext;
    private readonly plugins: string[];
    private readonly browser: string;
    private readonly timeout: number;
    private readonly headless: boolean;

    constructor(workingDir: string, mainDir: string, plugins: string[], browser: string, context: IE2EContext, timeout: number, headless: boolean) {
        this.workingDir = workingDir;
        this.mainDir = mainDir;
        this.browser = browser;
        this.plugins = plugins;
        this.context = context;
        this.timeout = timeout;
        this.headless = headless;
    }

    private static pathToE2EFolder(pluginName: string, baseDir: string): string {
        const e2ePath = path.join(baseDir, pluginName, 'assets', 'e2e');
        return e2ePath.replace(/\\/g, '/');  // For Windows
    }

    public generateE2EEnv(): void {
        const e2eFolder = WdioConfigGenerator.pathToE2EFolder('cf.cplace.platform', this.mainDir);
        const e2eEnv = new E2EEnvTemplate(this.context);
        fs.writeFileSync(
            path.join(e2eFolder, 'lib', 'config', WdioConfigGenerator.E2E_ENV_NAME),
            e2eEnv.getTemplate(),
            {encoding: 'utf8'}
        );
    }

    public generateWdioConfig(): void {
        this.plugins.forEach((plugin) => {
            const e2eFolder = WdioConfigGenerator.pathToE2EFolder(plugin, this.workingDir);
            const config = new ConfigTemplate(this.mainDir, e2eFolder, this.browser, this.context.baseUrl, this.timeout, this.headless);
            fs.writeFileSync(path.join(e2eFolder, WdioConfigGenerator.WDIO_CONF_NAME), config.getTemplate(), {encoding: 'utf8'});
        });
    }

}
