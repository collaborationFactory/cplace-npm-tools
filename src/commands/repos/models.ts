/**
 * Data model for repo commands
 */

export interface IReposDescriptor {
    [repoName: string]: IRepoStatus;
}

export interface IRepoStatus {
    url: string;
    branch: string;
    commit?: string;
}

export interface IModulesXmlRoot {
    project: IModulesXmlProject;
}

export interface IModulesXmlProject {
    component: IModulesXmlComponent[];
}

export interface IModulesXmlComponent {
    modules: IModulesXmlModules[];
}

export interface IModulesXmlModules {
    /* tslint:disable */
    // module is a keyword, but we need it here
    module: Array<IXmlAttribues<IModulesXmlModule>>;
    /* tslint:enable */
}

export interface IXmlAttribues<T> {
    $: T;
}

export interface IModulesXmlModule {
    fileurl: string;
    filepath: string;
    group?: string;
}