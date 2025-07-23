// jest.config.js
export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    moduleDirectories: ['node_modules', 'src', 'test'],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
        '^.+\\.(js)$': 'babel-jest',
    },
    testRegex: '(/__tests__/.*|\\.(test|spec))\\.ts?$',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    moduleNameMapper: {
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
