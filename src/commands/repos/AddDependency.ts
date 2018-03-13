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

        return this.findDependencies(this.pluginToAdd)
            .map((plugin) => this.findSubmodules(plugin))
            .reduce((previous, current) => previous.concat(current.filter((item) => previous.indexOf(item) < 0)), [])
            .then((result) => console.log(result));
        /* TODO
         *  - add them to .idea/modules.xml
         *  - goal is that the dependencies are part of the Project in IntelliJ
         */
    }

    private findDependencies(plugin: string): Promise<string[]> {
        return this.readParentReposJson(plugin)
            .then((json) => {
                if (json) {
                    return Promise
                        .all(Object.keys(json).map((key) => this.findDependencies(key)))
                        .reduce((p, dep) => p.concat(dep.filter((item) => p.indexOf(item) < 0)), [plugin]);
                }
                return Promise.resolve([plugin]);
            });
    }

    private readParentReposJson(plugin: string): Promise<string> {
        const pathToRepo = path.resolve('..', plugin);
        if (!fs.existsSync(pathToRepo)) {
            return Promise.reject(`Plugin ${plugin} not found in file system.`);
        }

        const parentReposJson = path.resolve(pathToRepo, AbstractReposCommand.PARENT_REPOS_FILE_NAME);
        if (!fs.existsSync(parentReposJson)) {
            return Promise.resolve(null);
        }

        return fs.readFileAsync(parentReposJson, 'utf8')
            .then((fileContent) => JSON.parse(fileContent))
            .catch((e) => console.error(`Failed to parse repo description ${parentReposJson}`, e));
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
