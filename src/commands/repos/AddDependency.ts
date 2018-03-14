import {AbstractReposCommand} from './AbstractReposCommand';
import * as path from 'path';
import * as fs from 'fs';
import * as Promise from 'bluebird';
import {ISubModule} from './models';
import * as xml2js from 'xml2js';
import {Global} from '../../Global';

/**
 * Add Dependency command
 */
export class AddDependency extends AbstractReposCommand {
    private readonly pluginToAdd: string;

    constructor(plugin: string) {
        super();
        this.pluginToAdd = plugin;
    }

    public execute(): Promise<void> {
        if (Object.keys(this.parentRepos).indexOf(this.pluginToAdd) >= 0) {
            return Promise.reject(`Plugin ${this.pluginToAdd} is already a dependency.`);
        }

        return this.findSubmodules(this.pluginToAdd)
            .then((submodules) => this.appendToModulesXml(submodules));
    }

    private readModulesXml(pluginPath: string): Promise<object> {
        const modulesXml = path.resolve(pluginPath, '.idea', 'modules.xml');
        if (!fs.existsSync(modulesXml)) {
            return Promise.reject(`${modulesXml} not found.`);
        }
        return fs.readFileAsync(modulesXml, 'utf8')
            .then(this.parseXml);
    }

    private findSubmodules(plugin: string): Promise<ISubModule[]> {
        return this.readModulesXml(path.resolve('..', plugin))
            .then((xml) => {
                Global.isVerbose() && console.log(xml.project.component[0].modules[0]);
                const modules = xml.project.component[0].modules[0].module.map((m) => m.$ as ISubModule);
                Global.isVerbose() && console.log(modules);
                return modules;
            });
    }

    private parseXml(xml: string): Promise<object> {
        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private appendToModulesXml(modules: ISubModule[]): Promise<void> {
        return this.readModulesXml('.')
            .then((modulesXml) => {
                // TODO remove duplicated modules
                const modulesAsAttributes = modules.map((m) => ({ $: m }));
                modulesXml.project.component[0].modules[0].module.push(...modulesAsAttributes);
                const xml = new xml2js.Builder().buildObject(modulesXml);
                Global.isVerbose() && console.log(`Updated xml: ${xml}`);
                return xml;
            })
            .then((xml) => fs.writeFileAsync(path.resolve('.idea', 'modules.xml'), xml, 'utf8'));
    }
}
