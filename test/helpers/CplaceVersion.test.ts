import * as fs from 'fs';
import {CplaceVersion} from '../../src/helpers/CplaceVersion';

jest.mock('fs');

test('should find the version in build file', () => {
        const fakeBuildFileContent = '...\n  version = "23.1.0"\n...';
        (fs.readFileSync as jest.Mock).mockReturnValue(fakeBuildFileContent);

        const version = CplaceVersion.determineVersion('./build.gradle', './version.gradle');
        expect(version).toBe('23.1.0');
    });

test('should find the version in version file when not in build file', () => {
    const fakeBuildFileContent = '...\nno version here\n...';
    const fakeVersionFileContent = '...\n currentVersion=24.1.1\n...';
    (fs.readFileSync as jest.Mock)
        .mockImplementation((path: string) => path.includes('build') ? fakeBuildFileContent : fakeVersionFileContent);

    const version = CplaceVersion.determineVersion('./build.gradle', ',/version.gradle');
    expect(version).toBe('24.1.1');
});

test('should return undefined if version not found', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('...');

    const version = CplaceVersion.determineVersion('./build.gradle', './version.gradle');
    expect(version).toBeUndefined();
});

describe('determineVersion with different version patterns', () => {
    const testCases = [
        ['  currentVersion=\'23.1.4-RC.1\'', '23.1.4-RC.1'],
        ['  currentVersion =  "23.1.4-RC.1"', '23.1.4-RC.1'],
        ['  currentVersion=23.1.5\ncplaceVersion=23.4', '23.1.5'],
        ['  cplaceVersion=23.4.6-RC.5', '23.4.6-RC.5']
    ];

    test.each(testCases)('given %p as file content, returns %p', (fakeVersionFileContent, expected) => {
        const fakeBuildFileContent = '...\nno version here\n...';
        (fs.readFileSync as jest.Mock)
            .mockImplementation((path: string) => path.includes('build') ? fakeBuildFileContent : fakeVersionFileContent);

        const result = CplaceVersion.determineVersion('./build.gradle', './version.gradle');
        expect(result).toBe(expected);
    });
});
