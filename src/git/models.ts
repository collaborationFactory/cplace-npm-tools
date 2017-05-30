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

export interface IGitStatus {
    not_added: string[];
    conflicted: string[];
    created: string[];
    deleted: string[];
    modified: string[];
    renamed: string[];
    files: IGitFileStatus[];
    ahead: number;
    behind: number;
    current: string;
    tracking: string;
}

export interface IGitFileStatus {
    path: string;
    index: string;
    working_dir: string;
}

export interface IGitRemoteBranchesAndCommits {
    branch: string;
    commit: string;
}