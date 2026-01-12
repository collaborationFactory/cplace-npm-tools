import * as fs from 'fs';
import * as child_process from 'child_process';

/**
 * Assert file exists at path
 */
export function assertFileExists(filePath: string): void {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Expected file to exist at ${filePath}`);
    }
}

/**
 * Assert file contains expected content
 */
export function assertFileContains(filePath: string, expectedContent: string): void {
    assertFileExists(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(expectedContent)) {
        throw new Error(
            `Expected file ${filePath} to contain "${expectedContent}" but got:\n${content}`
        );
    }
}

/**
 * Assert JSON file equals expected object
 */
export function assertJsonFileEquals(filePath: string, expected: any): void {
    assertFileExists(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const actual = JSON.parse(content);
    expect(actual).toEqual(expected);
}

/**
 * Assert git repository is on expected branch
 */
export function assertGitBranch(repoDir: string, expectedBranch: string): void {
    const result = child_process.execSync('git branch --show-current', {
        cwd: repoDir,
        encoding: 'utf8'
    });
    const actualBranch = result.trim();
    if (actualBranch !== expectedBranch) {
        throw new Error(
            `Expected repo at ${repoDir} to be on branch "${expectedBranch}" ` +
            `but was on "${actualBranch}"`
        );
    }
}

/**
 * Assert git repository has expected tag
 */
export function assertGitTag(repoDir: string, expectedTag: string): void {
    try {
        const result = child_process.execSync(`git tag -l "${expectedTag}"`, {
            cwd: repoDir,
            encoding: 'utf8'
        });
        if (!result.trim()) {
            throw new Error(`Tag "${expectedTag}" not found in repo at ${repoDir}`);
        }
    } catch (error) {
        throw new Error(`Failed to check tag in ${repoDir}: ${error.message}`);
    }
}

/**
 * Assert git repository is checked out to tag
 */
export function assertGitCheckedOutToTag(repoDir: string, expectedTag: string): void {
    try {
        const result = child_process.execSync('git describe --exact-match --tags', {
            cwd: repoDir,
            encoding: 'utf8'
        });
        const actualTag = result.trim();
        if (actualTag !== expectedTag) {
            throw new Error(
                `Expected repo at ${repoDir} to be checked out to tag "${expectedTag}" ` +
                `but was at "${actualTag}"`
            );
        }
    } catch (error) {
        throw new Error(
            `Expected repo at ${repoDir} to be checked out to tag "${expectedTag}" ` +
            `but git describe failed: ${error.message}`
        );
    }
}

/**
 * Assert directory exists
 */
export function assertDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Expected directory to exist at ${dirPath}`);
    }
    if (!fs.statSync(dirPath).isDirectory()) {
        throw new Error(`Expected ${dirPath} to be a directory but it's a file`);
    }
}
