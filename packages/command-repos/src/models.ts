/**
 * Data model for repo commands
 */

export interface IReposDescriptor {
    [repoName: string]: IRepoStatus;
}

export interface IRepoStatus {
    url: string;
    branch: string;
    useSnapshot?: boolean;
    artifactGroup?: string;
    artifactVersion?: string;
    tag?: string;
    tagMarker?: string;
    latestTagForRelease?: string;
    commit?: string;
    description?: string;
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
    // module is a keyword, but we need it here
    module: Array<IXmlAttributes<IModulesXmlModule>>;
}

export interface IXmlAttributes<T> {
    $: T;
}

export interface IModulesXmlModule {
    fileurl: string;
    filepath: string;
    group?: string;
}

export interface INameAttribute {
    name: string;
}

export interface ITypeAttribute {
    // type is a keyword, but we need it here
    type: string;
}