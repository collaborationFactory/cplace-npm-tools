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
            // search for version string in build.gradle
            const buildFileContent = fs.readFileSync(buildFilePath, 'utf8');
            let versionString = buildFileContent
                .split('\n')
                .find((line) => line.trim().startsWith('version'));

            if (!versionString) {
                // search version string in version.gradle
                const versionFileContent = fs.readFileSync(versionFilePath, 'utf8');
                versionString = versionFileContent
                    .split('\n')
                    .find((line) => line.includes('currentVersion'));
            }
            if (!versionString) {
                console.error(`Version string not found in version.gradle file nor in build.gradle file`);
                throw new Error(`Version string not found in version.gradle file nor in build.gradle file`);
            }

            const version = versionString
                .split('=')[1]
                .replace(/'/g, '')
                .trim();
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

    public static toString(): string {
        let version = `${this._version?.major}.${this._version?.minor}.${this._version?.patch}`;
        if (this._version?.snapshot) {
            version += '-SNAPSHOT';
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

    public static compareTo(otherVersion: {major: number, minor: number, patch: number}): number {
        if (this._version.major !== otherVersion.major) {
            return this._version.major - otherVersion.major;
        } else if (this._version.minor !== otherVersion.minor) {
            return this._version.minor - otherVersion.minor;
        } else if (this._version.patch !== otherVersion.patch) {
            return this._version.patch - otherVersion.patch;
        }

        return 0;
    }
}
