import {DependencyManagement} from './DependencyManagement';
import {IModulesXmlModule, IModulesXmlRoot, IReposDescriptor} from '../models';
import * as path from 'path';
import {Global} from '../../../Global';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import {ImlParser} from '../ImlParser';
import {promiseAllSettledParallel} from '../../../promiseAllSettled';

export class IdeaDependencyManagement extends DependencyManagement {

    constructor(repositoryDir: string, repositoryDirectory: IReposDescriptor) {
        super(repositoryDir, repositoryDirectory);
    }

    public async addAllPluginsFromRepository(repositoryName: string): Promise<void> {
        const moduleRoot = await this.readModulesXml(path.resolve(this.repositoryDir, '..', repositoryName));
        const xmlModules = moduleRoot.project.component[0].modules[0].module;
        const pluginModules = xmlModules
            .map((m) => m.$)
            .filter((m) => !m.filepath.endsWith('release-notes.iml'))
            .map((m) => {
                const mod = this.adjustPathsAndGroup(repositoryName, m);
                Global.isVerbose() && console.log(`adding module for filepath ${mod.filepath}`);
                return mod;
            });

        await this.appendToModulesXml(pluginModules);
    }

    public async addSinglePlugin(pluginName: string, includeTransitive: boolean): Promise<void> {
        const plugin = await this.findPluginInRepos(pluginName);
        const xmlModule = this.adjustPathsAndGroup(plugin.repoName, plugin.moduleEntry);
        const moduleEntries = await this.addDependenciesIfRequired(xmlModule, includeTransitive);
        await this.appendToModulesXml(moduleEntries);
    }

    private readModulesXml(repoPath: string): Promise<IModulesXmlRoot> {
        const modulesXml = path.resolve(repoPath, '.idea', 'modules.xml');
        if (!fs.existsSync(modulesXml)) {
            return Promise.reject(`${modulesXml} not found`);
        }
        return fs.readFileAsync(modulesXml, 'utf8')
            .then(this.parseXml);
    }

    private parseXml<T>(xml: string): Promise<T> {
        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result as T);
                }
            });
        });
    }

    private adjustPathsAndGroup(repositoryName: string, moduleEntry: IModulesXmlModule): IModulesXmlModule {
        const mod = {...moduleEntry};
        if (!mod.fileurl.startsWith('file://$PROJECT_DIR$/../')) {
            mod.fileurl = mod.fileurl.replace('file://$PROJECT_DIR$/', `file://$PROJECT_DIR$/../${repositoryName}/`);
            mod.group = repositoryName;
        } else {
            const fileUrl = mod.fileurl.substr('file://$PROJECT_DIR$/../'.length);
            const nextSlash = fileUrl.indexOf('/');
            if (nextSlash > 0) {
                mod.group = fileUrl.substring(0, nextSlash);
            }
        }
        if (!mod.filepath.startsWith('$PROJECT_DIR$/../')) {
            mod.filepath = mod.filepath.replace('$PROJECT_DIR$/', `$PROJECT_DIR$/../${repositoryName}/`);
        }
        return mod;
    }

    private async appendToModulesXml(moduleEntries: IModulesXmlModule[]): Promise<void> {
        const modulesXml = await this.readModulesXml(this.repositoryDir);
        const existingModules = modulesXml.project.component[0].modules[0].module;

        moduleEntries.forEach((moduleEntry) => {
            const moduleNode = {$: moduleEntry};
            const existingNodes = existingModules.filter(
                (e) => {
                    return e.$.filepath === moduleEntry.filepath && e.$.fileurl === moduleEntry.fileurl;
                }
            );
            if (existingNodes.length === 0) {
                existingModules.push(moduleNode);
                Global.isVerbose() && console.log(`Added ${moduleEntry.filepath}`);
            } else {
                Global.isVerbose() && console.log(`module ${moduleEntry.filepath} already added`);
            }
        });

        const xml = new xml2js.Builder().buildObject(modulesXml);
        Global.isVerbose() && console.log(`Updated xml: ${xml}`);
        return fs.writeFileAsync(path.resolve(this.repositoryDir, '.idea', 'modules.xml'), xml, 'utf8');
    }

    private findPluginInRepos(plugin: string): Promise<{ repoName: string; moduleEntry: IModulesXmlModule }> {
        const readModules = Object.keys(this.parentRepos)
            .map((repoName) =>
                     this.readModulesXml(path.resolve(this.repositoryDir, '..', repoName))
                         .then((moduleRoot: IModulesXmlRoot) => ({repoName, moduleRoot}))
            );

        return promiseAllSettledParallel(readModules)
            .then((repoAndModuleRoots) => repoAndModuleRoots
                .map(({repoName, moduleRoot}) => {
                    Global.isVerbose() && console.log(moduleRoot.project.component[0].modules[0]);
                    return {
                        repoName,
                        modules: moduleRoot.project.component[0].modules[0].module.map((m) => m.$)
                    };
                })
            )
            .then((repoAndModules) => repoAndModules.map(({repoName, modules}) => ({
                repoName,
                modules: modules.filter((m: IModulesXmlModule) => m.filepath.endsWith(`${plugin}.iml`))
            })))
            .then((repoAndFilteredModules) => repoAndFilteredModules.filter(({modules}) => modules.length === 1))
            .then((repoAndModules) => {
                      if (repoAndModules.length === 1) {
                          return {repoName: repoAndModules[0].repoName, moduleEntry: repoAndModules[0].modules[0]};
                      } else {
                          throw new Error('Did not find plugin - is the repo itself already added?');
                      }
                  }
            );
    }

    private async addDependenciesIfRequired(moduleEntry: IModulesXmlModule, includeTransitive: boolean): Promise<IModulesXmlModule[]> {
        if (includeTransitive) {
            const entries = await this.findDependencies(moduleEntry);
            return entries.concat(moduleEntry);
        } else {
            return [moduleEntry];
        }
    }

    private async findDependencies(moduleEntry: IModulesXmlModule): Promise<IModulesXmlModule[]> {
        try {
            const filepath = moduleEntry.filepath.replace('$PROJECT_DIR$/', '');
            const imlParser = new ImlParser(path.join(this.repositoryDir, filepath));
            const result = await promiseAllSettledParallel(imlParser.getReferencedModules().map((moduleName) => this.findPluginInRepos(moduleName)));
            return result.map(
                (entry) => this.adjustPathsAndGroup(entry.repoName, entry.moduleEntry)
            );
        } catch (e) {
            console.log(e);
            throw e;
        }
    }
}
