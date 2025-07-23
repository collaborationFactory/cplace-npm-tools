const { createGlobPatternsForDependencies } = require('@nx/jest');

module.exports = {
  projects: [
    // Root level tests (legacy)
    {
      ...require('./jest.preset.cjs'),
      displayName: 'cplace-cli-root',
      testMatch: ['<rootDir>/test/**/*.(test|spec).ts'],
      moduleNameMapper: {
        '^@cplace-cli/core$': '<rootDir>/packages/core/src/index.ts',
        '^@cplace-cli/git-utils$': '<rootDir>/packages/git-utils/src/index.ts',
        '^@cplace-cli/helpers$': '<rootDir>/packages/helpers/src/index.ts',
        '^@cplace-cli/command-repos$': '<rootDir>/packages/command-repos/src/index.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      setupFilesAfterEnv: ['<rootDir>/test/helpers/jest-setup.ts'],
    },
    // Individual package tests
    '<rootDir>/packages/*/jest.config.cjs',
  ],
};
