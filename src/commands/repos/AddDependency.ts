import {AbstractReposCommand} from './AbstractReposCommand';
import * as path from 'path';
import * as fs from 'fs';
import * as Promise from 'bluebird';
import {IModulesXmlModule, IModulesXmlRoot} from './models';
import * as xml2js from 'xml2js';
import {Global} from '../../Global';
import {ICommandParameters} from '../models';
import {Repos} from './Repos';
import {IGitStatus, Repository} from '../../git';
import {ImlParser} from './ImlParser';

/**
 * Add Dependency command
 */
export class AddDependency extends AbstractReposCommand {
    private static readonly PARAMETER_ALL_FROM_REPO: string = 'all';

    private pluginOrRepoToAdd: string;
    private addAllFromRepo: boolean = false;

    public execute(): Promise<void> {
        if (fs.existsSync(path.resolve('..', this.pluginOrRepoToAdd))) {
            return this.addNewParentRepo(this.pluginOrRepoToAdd, this.addAllFromRepo);
        } else {
            return this.findPluginInRepos(this.pluginOrRepoToAdd)
                .then(({repoName, moduleEntry}) => this.adjustPathsAndGroup(repoName, moduleEntry))
                .then((moduleEntry) => this.addAllFromRepo? this.findDependencies(moduleEntry) : Promise.resolve([moduleEntry]))
                .then((moduleEntries) => this.appendToModulesXml(moduleEntries));
        }
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Repos.PARAMETER_ADD_DEPENDENCY]) {
            this.pluginOrRepoToAdd = params[Repos.PARAMETER_ADD_DEPENDENCY] as string;
        } else {
            this.pluginOrRepoToAdd = params[Repos.PARAMETER_ADD_DEPENDENCY_SHORT] as string;
        }
        this.addAllFromRepo = !!params[AddDependency.PARAMETER_ALL_FROM_REPO];
        return !!this.pluginOrRepoToAdd;
    }

    private addNewParentRepo(repoName: string, addAllFromRepo: boolean): Promise<void> {
        if (Object.keys(this.parentRepos).indexOf(repoName) >= 0) {
            return Promise.reject(`Repository ${repoName} is already a dependency.`);
        }

        const repoPath = path.resolve('..', repoName);
        return fs.statAsync(repoPath)
            .then((stats) => !stats.isDirectory()
                ? Promise.reject(`expected a repository directory named: ${repoName}`)
                : Promise.resolve()
            )
            .then(() => new Repository(repoPath))
            .then((repo) => repo.status()
                .then((status: IGitStatus) => ({repo, status}))
            )
            .then(({repo, status}) => repo.getOriginUrl()
                .then((url) => ({status, url}))
            )
            .then(({status, url}) => ({
                ...this.parentRepos,
                [repoName]: {
                    branch: status.current,
                    url
                }
            }))
            .then((newParentRepos) => this.writeNewParentRepos(newParentRepos))
            .then(() => !addAllFromRepo ? Promise.resolve() : this.addAllPlugins(repoName));
    }

    private addAllPlugins(repoName: string): Promise<void> {
        Global.isVerbose() && console.log(`Adding all plugins for ${repoName}`);
        return this.readModulesXml(path.resolve('..', repoName))
            .then((moduleRoot) => moduleRoot.project.component[0].modules[0].module.map((m) => m.$))
            .then((modules: IModulesXmlModule[]) => modules.filter((m) => !m.filepath.endsWith('release-notes.iml')))
            .then((modules) => modules.map((m) => {
                const mod = this.adjustPathsAndGroup(repoName, m);
                Global.isVerbose() && console.log(`adding module for filepath ${mod.filepath}`);
                return mod;
            }))
            .then((modules) => this.appendToModulesXml(modules));
    }

    private findPluginInRepos(plugin: string): Promise<{ repoName: string; moduleEntry: IModulesXmlModule }> {
        const readModules = Object.keys(this.parentRepos).map((repoName) =>
            this.readModulesXml(path.resolve('..', repoName))
                .then((moduleRoot: IModulesXmlRoot) => ({repoName, moduleRoot}))
        );

        return Promise.all(readModules)
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
            .then((repoAndModules) => repoAndModules.length === 1
                ? Promise.resolve({repoName: repoAndModules[0].repoName, moduleEntry: repoAndModules[0].modules[0]})
                : Promise.reject('Did not find plugin - is the repo itself already added?')
            );
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

    private adjustPathsAndGroup(repoName: string, moduleEntry: IModulesXmlModule): IModulesXmlModule {
        const mod = {...moduleEntry};
        if (!mod.fileurl.startsWith('file://$PROJECT_DIR$/../')) {
            mod.fileurl = mod.fileurl.replace('file://$PROJECT_DIR$/', `file://$PROJECT_DIR$/../${repoName}/`);
            mod.group = repoName;
        } else {
            const fileUrl = mod.fileurl.substr('file://$PROJECT_DIR$/../'.length);
            const nextSlash = fileUrl.indexOf('/');
            if (nextSlash > 0) {
                mod.group = fileUrl.substring(0, nextSlash);
            }
        }
        if (!mod.filepath.startsWith('$PROJECT_DIR$/../')) {
            mod.filepath = mod.filepath.replace('$PROJECT_DIR$/', `$PROJECT_DIR$/../${repoName}/`);
        }
        return mod;
    }

    private static absolutePath(path: string): string {
        return path.replace('$PROJECT_DIR$/', '');
    }

    private findDependencies(moduleEntry: IModulesXmlModule): Promise<IModulesXmlModule[]> {
        try {
            const imlParser = new ImlParser(AddDependency.absolutePath(moduleEntry.filepath));
            return Promise.map(
                Promise.all(imlParser.getReferencedModules().map((moduleName) => this.findPluginInRepos(moduleName))),
                (entry) => this.adjustPathsAndGroup(entry.repoName, entry.moduleEntry)
            );
        } catch (e) {
            console.log(e);
            return Promise.reject(e);
        }
    }

    private appendToModulesXml(moduleEntries: IModulesXmlModule[]): Promise<void> {
        return this.readModulesXml('.')
            .then((modulesXml: IModulesXmlRoot) => {
                const existingModules = modulesXml.project.component[0].modules[0].module;

                moduleEntries.forEach((moduleEntry) => {
                    const moduleNode = {$: moduleEntry};
                    const existingNodes = existingModules.filter((e) =>
                        e.$.filepath === moduleEntry.filepath && e.$.fileurl === moduleEntry.fileurl
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
                return fs.writeFileAsync(path.resolve('.idea', 'modules.xml'), xml, 'utf8');
            });
    }
}
