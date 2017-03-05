/**
 * Data types for Git interaction
 */

export interface IGitLogSummary {
    all: IGitLogEntry[];
    latest: IGitLogEntry;
    total: number;
}

export interface IGitLogEntry {
    hash: string;
    date: string;
    message: string;
    author_name: string;
    author_email: string;
}

export interface IRepoProperties {
    branch: string;
    commit: string;
}
