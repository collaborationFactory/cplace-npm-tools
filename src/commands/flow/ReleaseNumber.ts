/**
 * Represents a release version number
 */
export class ReleaseNumber {
    public static readonly MASTER: string = 'master';
    public static readonly MAIN: string = 'main';
    private static readonly RELEASE_NUMBER_PATTERN: RegExp = new RegExp(/^\d+(\.\d+){0,2}$/);

    public readonly defaultBranch: boolean;
    public readonly major: number;
    public readonly minor: number;
    public readonly patch: number;

    private constructor(defaultBranch: boolean, major: number, minor: number, patch: number) {
        this.defaultBranch = defaultBranch;
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    public static parse(release: string): ReleaseNumber | null {
        if (ReleaseNumber.isDefaultBranch(release)) {
            return new ReleaseNumber(true, null, null, null);
        } else if (!ReleaseNumber.RELEASE_NUMBER_PATTERN.test(release)) {
            return null;
        }

        const parts = release.split('.');
        if (!parts.length) {
            return null;
        }
        const major = Number(parts[0]);
        let minor = 0;
        let patch = 0;
        if (parts.length > 1) {
            minor = Number(parts[1]);
            if (parts.length > 2) {
                patch = Number(parts[2]);
            }
        }
        return new ReleaseNumber(false, major, minor, patch);
    }

    public compareTo(other: ReleaseNumber): number {
        if (this.defaultBranch && other.defaultBranch) {
            return 0;
        } else if (this.defaultBranch) {
            return 1;
        } else if (other.defaultBranch) {
            return -1;
        } else if (this.major !== other.major) {
            return this.major - other.major;
        } else if (this.minor !== other.minor) {
            return this.minor - other.minor;
        } else {
            return this.patch - other.patch;
        }
    }

    public toString(): string {
        return this.defaultBranch ? 'default' : `${this.major}.${this.minor}.${this.patch}`;
    }

    public static isDefaultBranch(branchName: string, remote: string = ''): boolean {
        let isDefault: boolean = false;
        if (remote && remote !== '' && (branchName === `${remote}/${ReleaseNumber.MASTER}` || branchName === `${remote}/${ReleaseNumber.MAIN}`)) isDefault = true;
        if (branchName === ReleaseNumber.MASTER || branchName === ReleaseNumber.MAIN) isDefault = true;
        return isDefault;
    }
}
