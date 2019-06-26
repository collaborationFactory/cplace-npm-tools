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
    if (path.basename(workingDir) === 'main') {
        return workingDir;
    }

    const expectedMain = path.resolve(workingDir, '..', 'main');
    if (!fs.existsSync(expectedMain)) {
        return null;
    } else {
        return expectedMain;
    }
}
