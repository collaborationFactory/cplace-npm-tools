import {E2E} from './E2E';
import {withTempDirectory} from '../../test/helpers/directories';
import * as util from '../../util';
import {mocked} from 'ts-jest/utils';
import * as path from 'path';
import {fs} from '../../p/fs';

jest.mock('../../util');

test('E2E detects Allure Reporter in Dev Dependencies', async () => {
    await withTempDirectory('e2e-allure', async (dir) => {
        mocked(util).getPathToMainRepo.mockReturnValue(dir);

        const packageJson = {
            name: 'cplace',
            private: true,
            devDependencies: {
                '@wdio/allure-reporter': '^5.22.4'
            }
        };

        const packageJsonPath = path.join(dir, 'package.json');
        await fs.writeFileAsync(packageJsonPath, JSON.stringify(packageJson), 'utf8');

        const e2eCommand = new E2E();
        e2eCommand.prepareAndMayExecute({});
        expect(e2eCommand.isServiceInstalled(E2E.ALLURE_PACKAGE_NAME)).toBe(true);
    });
});

test('E2E detects Allure Reporter in Dependencies', async () => {
    await withTempDirectory('e2e-allure', async (dir) => {
        mocked(util).getPathToMainRepo.mockReturnValue(dir);

        const packageJson = {
            name: 'cplace',
            private: true,
            dependencies: {
                '@wdio/allure-reporter': '^5.22.4'
            },
            devDependencies: {
                'allure-commandline': '1.0.0'
            }
        };

        const packageJsonPath = path.join(dir, 'package.json');
        await fs.writeFileAsync(packageJsonPath, JSON.stringify(packageJson), 'utf8');

        const e2eCommand = new E2E();
        e2eCommand.prepareAndMayExecute({});
        expect(e2eCommand.isServiceInstalled(E2E.ALLURE_PACKAGE_NAME)).toBe(true);
    });
});

test('E2E detects missing Allure Reporter', async () => {
    await withTempDirectory('e2e-allure', async (dir) => {
        mocked(util).getPathToMainRepo.mockReturnValue(dir);

        const packageJson = {
            name: 'cplace',
            private: true,
            dependencies: {
                '@wdio/nothing-allure': '0.0.0'
            }
        };

        const packageJsonPath = path.join(dir, 'package.json');
        await fs.writeFileAsync(packageJsonPath, JSON.stringify(packageJson), 'utf8');

        const e2eCommand = new E2E();
        e2eCommand.prepareAndMayExecute({});
        expect(e2eCommand.isServiceInstalled(E2E.ALLURE_PACKAGE_NAME)).toBe(false);
    });
});

test('E2E detects WDIO Image-Comparison-Service in Dev Dependencies', async () => {
    await withTempDirectory('e2e-allure', async (dir) => {
        mocked(util).getPathToMainRepo.mockReturnValue(dir);

        const packageJson = {
            name: 'cplace',
            private: true,
            devDependencies: {
                'wdio-image-comparison-service': '^1.14.0'
            }
        };

        const packageJsonPath = path.join(dir, 'package.json');
        await fs.writeFileAsync(packageJsonPath, JSON.stringify(packageJson), 'utf8');

        const e2eCommand = new E2E();
        e2eCommand.prepareAndMayExecute({});
        expect(e2eCommand.isServiceInstalled(E2E.IMAGE_COMPARISON_PACKAGE_NAME)).toBe(true);
    });
});

test('E2E detects WDIO Image-Comparison-Service in Dependencies', async () => {
    await withTempDirectory('e2e-allure', async (dir) => {
        mocked(util).getPathToMainRepo.mockReturnValue(dir);

        const packageJson = {
            name: 'cplace',
            private: true,
            dependencies: {
                'wdio-image-comparison-service': '^1.14.0'
            },
            devDependencies: {
                'allure-commandline': '1.0.0'
            }
        };

        const packageJsonPath = path.join(dir, 'package.json');
        await fs.writeFileAsync(packageJsonPath, JSON.stringify(packageJson), 'utf8');

        const e2eCommand = new E2E();
        e2eCommand.prepareAndMayExecute({});
        expect(e2eCommand.isServiceInstalled(E2E.IMAGE_COMPARISON_PACKAGE_NAME)).toBe(true);
    });
});

test('E2E detects missing WDIO Image-Comparison-Service', async () => {
    await withTempDirectory('e2e-allure', async (dir) => {
        mocked(util).getPathToMainRepo.mockReturnValue(dir);

        const packageJson = {
            name: 'cplace',
            private: true,
            dependencies: {
                'wdio-intercept-service': '0.0.0'
            }
        };

        const packageJsonPath = path.join(dir, 'package.json');
        await fs.writeFileAsync(packageJsonPath, JSON.stringify(packageJson), 'utf8');

        const e2eCommand = new E2E();
        e2eCommand.prepareAndMayExecute({});
        expect(e2eCommand.isServiceInstalled(E2E.IMAGE_COMPARISON_PACKAGE_NAME)).toBe(false);
    });
});