import * as path from 'path';

export const getPathToE2E = (workingDir: string, plugin: string): string => {
    return path.join(workingDir, plugin, 'assets', 'e2e');
};

export const getPathToSpecFiles = (workingDir: string, plugin: string): string => {
    return path.join(getPathToE2E(workingDir, plugin), 'specs');
};
