/**
 * Represents a release version number
 */
export class ReleaseNumber {
    private static readonly RELEASE_NUMBER_PATTERN: RegExp = new RegExp(/^\d+(\.\d+){0,2}$/);

    public readonly major: number;
    public readonly minor: number;
    public readonly patch: number;

    constructor(major: number, minor: number, patch: number) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    public static parse(release: string): ReleaseNumber | null {
        if (!ReleaseNumber.RELEASE_NUMBER_PATTERN.test(release)) {
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
        return new ReleaseNumber(major, minor, patch);
    }

    public compareTo(other: ReleaseNumber): number {
        if (this.major !== other.major) {
            return this.major - other.major;
        }
        if (this.minor !== other.minor) {
            return this.minor - other.minor;
        }
        return this.patch - other.patch;
    }
}
