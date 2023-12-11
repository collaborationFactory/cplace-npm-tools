import * as fs from 'fs';
import * as path from 'path';

export class CplaceVersion {
    private static readonly VERSION_GRADLE: string = 'version.gradle';
    private static readonly BUILD_GRADLE: string = 'build.gradle';

    private static _version: CplaceVersion | undefined = undefined;

    private constructor(
        public readonly major: number,
        public readonly minor: number,
        public readonly patch: number,
        public readonly snapshot: boolean
    ) {}

    public static initialize(): CplaceVersion {
        if (CplaceVersion._version !== undefined) {
            throw new Error(
                `(CplaceVersion) version has already been initialized`
            );
        }

        const versionFilePath = path.resolve(
            CplaceVersion.VERSION_GRADLE
        );
        const buildFilePath = path.resolve(
            CplaceVersion.BUILD_GRADLE
        );

        if (!fs.existsSync(buildFilePath)) {
            console.warn(`Could not find build.gradle. Assuming version 1.0.0`);
            CplaceVersion._version = new CplaceVersion(1, 0, 0, false);
        } else {
            const version = this.determineVersion(buildFilePath, versionFilePath);
            if (!version) {
                console.error(`Version string not found in version.gradle file nor in build.gradle file`);
                throw new Error(`Version string not found in version.gradle file nor in build.gradle file`);
            }

            const versionSnapshotParts = version.split('-');
            const versionParts = versionSnapshotParts[0].split('.');
            versionParts.push(
                versionSnapshotParts.length > 1 &&
                versionSnapshotParts[1].toLowerCase().includes('snapshot')
                    ? 'true'
                    : 'false'
            );
            if (versionParts.length < 3) {
                console.error(`Expected version to consist of 3 parts`);
                throw new Error(`Expected version to consist of 3 parts`);
            }
            CplaceVersion._version = new CplaceVersion(
                parseInt(versionParts[0], 10),
                parseInt(versionParts[1], 10),
                parseInt(versionParts[2], 10),
                versionParts[3] === 'true'
            );
        }

        return CplaceVersion._version;
    }

    /**
     * Retrieves the version string from build.gradle or version.gradle files.
     * It first looks for 'version' in build.gradle. If not found, it searches for
     * 'currentVersion' or 'cplaceVersion' in version.gradle.
     *
     * @param {string} buildFilePath - Path to build.gradle file.
     * @param {string} versionFilePath - Path to version.gradle file.
     * @returns {string | undefined} Extracted version string, or undefined if not found.
     */
    public static determineVersion(buildFilePath: string, versionFilePath: string): string {
        // search for version string in build.gradle
        const buildFileContent = fs.readFileSync(buildFilePath, 'utf8');
        let versionString = this.getVersionString(buildFileContent, ['version']);

        if (!versionString) {
            // search version string in version.gradle
            const versionFileContent = fs.readFileSync(versionFilePath, 'utf8');
            versionString = this.getVersionString(versionFileContent, ['currentVersion', 'cplaceVersion']);
        }
        return versionString;

    }

    public static toString(): string {
        let version = `${this._version?.major}.${this._version?.minor}`;
        if (Number.isFinite(this._version?.patch)) {
            version += `.${this._version?.patch}`;
            if (this._version?.snapshot) {
                version += '-SNAPSHOT';
            }
        }
        return version;
    }

    public static get(): CplaceVersion {
        if (CplaceVersion._version === undefined) {
            throw new Error(
                `version has not yet been initialized`
            );
        }
        return CplaceVersion._version;
    }

    public static compareTo(otherVersion: { major: number, minor: number, patch: number }): number {
        if (this._version.major !== otherVersion.major) {
            return this._version.major - otherVersion.major;
        } else if (this._version.minor !== otherVersion.minor) {
            return this._version.minor - otherVersion.minor;
        } else if (this._version.patch !== otherVersion.patch) {
            return this._version.patch - otherVersion.patch;
        }

        return 0;
    }

    /**
     * Extracts a version string from the file content based on a list of patterns.
     * It searches each line of the file content for the first occurrence that starts with any of the given patterns.
     * Once a matching line is found, it extracts the version.
     *
     * @param {string} versionFileContent - The content of the file to be searched.
     * @param {string[]} patterns - An array of string patterns to look for at the start of each line.
     * @returns {string | undefined} The extracted version string if a match is found, otherwise undefined.
     */
    private static getVersionString(versionFileContent: string, patterns: string[]): string | undefined {
        for (const pattern of patterns) {
            const versionString = versionFileContent
                .split('\n')
                .find((line) => line.trim().startsWith(pattern));

            if (versionString) {
                const version = versionString.split('=');
                if (version.length >= 2) {
                    return version[1]
                        .replace(/'/g, '')
                        .replace(/"/g, '')
                        .trim();
                }
            }
        }
        return undefined;
    }
}
