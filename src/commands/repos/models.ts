/**
 * Data model for repo commands
 */

export interface IReposTransitiveDependencies {
    repoName: string;
    repoPath: string[];
    reposDescriptor?: IReposDescriptor;
    transitiveDependencies?: Map<string, IReposTransitiveDependencies>;
}

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
    /* tslint:disable */
    // module is a keyword, but we need it here
    module: Array<IXmlAttributes<IModulesXmlModule>>;
    /* tslint:enable */
}

export interface IXmlAttributes<T> {
    $: T;
}

export interface IModulesXmlModule {
    fileurl: string;
    filepath: string;
    group?: string;
}

export interface IIml {
    component: IImlComponent[];
}

export interface IImlComponent {
    /* tslint:disable */
    orderEntry: Array<IXmlAttributes<ITypeAttribute>>;
    /* tslint:enable */
    $: INameAttribute;
}

export interface INameAttribute {
    name: string;
}

export interface ITypeAttribute {
    /* tslint:disable */
    // type is a keyword, but we need it here
    type: string;
    /* tslint:enable */
}
