import {ConfigTemplate} from './ConfigTemplate';
import * as path from 'path';
import * as fs from 'fs';

export class WdioConfigGenerator {
    public static readonly WDIO_CONF_NAME: string = 'wdio.conf.js';
    private readonly baseUrl: string;
    private readonly plugins: string[];
    private readonly browser: string;
    private readonly timeout: number;
    private readonly workingDir: string;
    private readonly headless: boolean;

    constructor(plugins: string[], baseUrl: string, browser: string, timeout: number, workingDir: string, headless: boolean) {
        this.browser = browser;
        this.plugins = plugins;
        this.baseUrl = baseUrl;
        this.timeout = timeout;
        this.workingDir = workingDir;
        this.headless = headless;
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
