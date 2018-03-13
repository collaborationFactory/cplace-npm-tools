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
            .then((result) => console.log(result));
        /* TODO
         *  - add them to .idea/modules.xml
         *  - goal is that the dependencies are part of the Project in IntelliJ
         */
    }

    private findSubmodules(plugin: string): Promise<ISubModule[]> {
        const modulesXml = path.resolve('..', plugin, '.idea', 'modules.xml');
        if (!fs.existsSync(modulesXml)) {
            return Promise.reject(`${modulesXml} not found.`);
        }
        return fs.readFileAsync(modulesXml, 'utf8')
            .then(this.parseXml)
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
}
