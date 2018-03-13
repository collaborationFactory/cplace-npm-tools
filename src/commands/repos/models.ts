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

export interface ISubModule {
    fileurl: string;
    filepath: string;
    group?: string;
}