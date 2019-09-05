/**
 * Utility functions
 */

import * as path from 'path';
import * as fs from 'fs';

export function enforceNewline(text: string): string {
    return text.replace(/\r\n?/g, '\n');
}

export function makeSingleLine(text: string): string {
    return enforceNewline(text)
        .trim()
        .replace(/\s*\n\s*/g, ' ');
}

export function getPathToMainRepo(workingDir: string = ''): string | null {
    if (!workingDir) {
        workingDir = process.cwd();
    }
    workingDir = path.resolve(workingDir);
    if (path.basename(workingDir) === 'main' || path.basename(workingDir) === 'cplace') {
        console.log(`main/cplace Repository folder was found in ${workingDir}`);
        return workingDir;
    }

    const expectedMain = path.resolve(workingDir, '..', 'main');
    const expectedCplace = path.resolve(workingDir, '..', 'cplace');

    if (fs.existsSync(expectedMain)) {
        console.log(`main/cplace Repository folder was found in ${expectedMain}`);
        return expectedMain;
    } else if (fs.existsSync(expectedCplace)) {
        console.log(`main/cplace Repository folder was found in ${expectedCplace}`);
        return expectedCplace;
    } else {
        return null;
    }
}
