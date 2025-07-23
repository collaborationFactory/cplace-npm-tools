// jest.config.js
export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    moduleDirectories: ['node_modules', 'src', 'test'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts?$': ['ts-jest', {
            useESM: true,
            tsconfig: {
                module: 'ESNext',
                target: 'ES2022',
                moduleResolution: 'Node',
                allowSyntheticDefaultImports: true,
                esModuleInterop: true,
                strict: false,
                noImplicitAny: false,
                strictNullChecks: false,
                useUnknownInCatchVariables: false
            }
        }]
    },
    testRegex: '(/__tests__/.*|\\.(test|spec))\\.ts?$',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@cplace-cli/core$': '<rootDir>/packages/core/src/index.ts',
        '^@cplace-cli/core/(.*)$': '<rootDir>/packages/core/src/$1',
        '^@cplace-cli/git-utils$': '<rootDir>/packages/git-utils/src/index.ts',
        '^@cplace-cli/command-repos$': '<rootDir>/packages/command-repos/src/index.ts',
        '^@cplace-cli/command-version$': '<rootDir>/packages/command-version/src/index.ts',
        '^@cplace-cli/command-visualize$': '<rootDir>/packages/command-visualize/src/index.ts',
        '^@cplace-cli/helpers$': '<rootDir>/packages/helpers/src/index.ts'
    },
    // setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'], // Optional: Add setup file if needed
    testTimeout: 1000000, // Timeout in milliseconds (1000 seconds)
    verbose: true,
};
