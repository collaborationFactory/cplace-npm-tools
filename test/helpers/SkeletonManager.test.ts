import { SkeletonManager } from '../../src/helpers/SkeletonManager';
import { CplaceVersion } from '../../src/helpers/CplaceVersion';
import { Global } from '../../src/Global';

jest.mock('../../src/Global');

describe('SkeletonManager.getSkeletonBranchForVersion', () => {
    const mockGlobal = Global as jest.Mocked<typeof Global>;

    let initializeSpy: jest.SpyInstance;
    let getSpy: jest.SpyInstance;
    let toStringSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockGlobal.isVerbose.mockReturnValue(false);

        // Setup spies for CplaceVersion methods we want to control
        initializeSpy = jest.spyOn(CplaceVersion, 'initialize');
        getSpy = jest.spyOn(CplaceVersion, 'get');
        toStringSpy = jest.spyOn(CplaceVersion, 'toString');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('override branch functionality', () => {
        it('should return override branch when provided', () => {
            const overrideBranch = 'custom/branch';
            const result = SkeletonManager.getSkeletonBranchForVersion(overrideBranch);

            expect(result).toBe(overrideBranch);
        });


    });

    describe('version mapping functionality', () => {
        beforeEach(() => {
            const mockVersion = {
                major: 23,
                minor: 1,
                patch: 0,
                snapshot: false
            };
            initializeSpy.mockReturnValue(mockVersion as any);
            toStringSpy.mockReturnValue('23.1.0');
            getSpy.mockReturnValue(mockVersion);

            // Set the static _version property for the real compareTo method
            (CplaceVersion as any)._version = mockVersion;
        });

        it.each([
            [24, 1, "version/24.1"],
            [24, 2, "version/24.1"],
            [24, 3, "version/24.1"],
            [24, 4, "version/24.1"],
            [25, 1, "version/24.1"],
            [25, 2, "version/25.2"],
            [25, 3, "version/25.3"],
            [25, 4, "version/25.4"],
            [26, 1, "version/25.4"] // fallback case
        ])('should map cplace version %i.%i to %s', (major, minor, expected) => {
            const mockVersion = {
                major: major,
                minor: minor,
                snapshot: false
            };
            getSpy.mockReturnValue(mockVersion);
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;

            const result = SkeletonManager.getSkeletonBranchForVersion();
            expect(result).toBe(expected);
        });

        it('should return correct skeleton version for exact version match', () => {
            // The real compareTo method will be used automatically
            // Current version is 23.1.0 from beforeEach, which should match version/8.0
            const result = SkeletonManager.getSkeletonBranchForVersion();

            expect(result).toBe('version/8.0');
        });

        it('should return compatible version for newer patch version', () => {
            const mockVersion = {
                major: 23,
                minor: 1,
                patch: 5,
                snapshot: false
            };
            getSpy.mockReturnValue(mockVersion);
            toStringSpy.mockReturnValue('23.1.5');
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;

            const result = SkeletonManager.getSkeletonBranchForVersion();

            expect(result).toBe('version/8.0');
        });

        it('should return highest compatible version for cplace 25.4.0', () => {
            const mockVersion = {
                major: 25,
                minor: 4,
                patch: 0,
                snapshot: false
            };
            getSpy.mockReturnValue(mockVersion);
            toStringSpy.mockReturnValue('25.4.0');
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;

            const result = SkeletonManager.getSkeletonBranchForVersion();

            expect(result).toBe('version/25.4');
        });

        it('should return version/7.0 for cplace 22.3.0', () => {
            const mockVersion = {
                major: 22,
                minor: 3,
                patch: 0,
                snapshot: false
            };
            getSpy.mockReturnValue(mockVersion);
            toStringSpy.mockReturnValue('22.3.0');
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;

            const result = SkeletonManager.getSkeletonBranchForVersion();

            expect(result).toBe('version/7.0');
        });
    });

    describe('fallback behavior', () => {
        beforeEach(() => {
            const mockVersion = {
                major: 5,
                minor: 0,
                patch: 0,
                snapshot: false
            };
            initializeSpy.mockReturnValue(mockVersion as any);
            getSpy.mockReturnValue(mockVersion);
            toStringSpy.mockReturnValue('5.0.0');
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;
        });

        it('should return highest available version when no compatible version found', () => {
            const result = SkeletonManager.getSkeletonBranchForVersion();

            expect(result).toBe('version/25.4');
        });

        it('should log warning when using fallback version', () => {
            const consoleSpy = jest.spyOn(console, 'warn');

            SkeletonManager.getSkeletonBranchForVersion();

            expect(consoleSpy).toHaveBeenCalledWith(
                'No skeleton version mapping found for current cplace version. Using fallback: version/25.4'
            );
        });

        it('should log verbose message when fallback is used and verbose mode is enabled', () => {
            mockGlobal.isVerbose.mockReturnValue(true);
            const consoleSpy = jest.spyOn(console, 'log');

            SkeletonManager.getSkeletonBranchForVersion();

            expect(consoleSpy).toHaveBeenCalledWith(
                'Selected skeleton branch: version/25.4 for cplace version 5.0.0'
            );
        });
    });

    describe('CplaceVersion initialization handling', () => {
        it('should handle CplaceVersion initialization gracefully when already initialized', () => {
            const mockVersion = {
                major: 23,
                minor: 1,
                patch: 0,
                snapshot: false
            };
            initializeSpy.mockImplementation(() => {
                throw new Error('Already initialized');
            });
            getSpy.mockReturnValue(mockVersion);
            toStringSpy.mockReturnValue('23.1.0');
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;

            const result = SkeletonManager.getSkeletonBranchForVersion();

            expect(result).toBe('version/8.0');
        });

        it('should log verbose message when CplaceVersion is already initialized', () => {
            mockGlobal.isVerbose.mockReturnValue(true);
            const mockVersion = {
                major: 23,
                minor: 1,
                patch: 0,
                snapshot: false
            };
            initializeSpy.mockImplementation(() => {
                throw new Error('Already initialized');
            });
            getSpy.mockReturnValue(mockVersion);
            toStringSpy.mockReturnValue('23.1.0');
            // Set the internal _version so real compareTo method works
            (CplaceVersion as any)._version = mockVersion;
            const consoleSpy = jest.spyOn(console, 'log');

            SkeletonManager.getSkeletonBranchForVersion();

            expect(consoleSpy).toHaveBeenCalledWith('CplaceVersion already initialized');
        });
    });
});
