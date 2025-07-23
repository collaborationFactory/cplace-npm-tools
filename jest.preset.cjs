const { createGlobPatternsForDependencies } = require('@nx/jest');

module.exports = {
  displayName: 'cplace-cli',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022',
        moduleResolution: 'Node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@cplace-cli/core$': '<rootDir>/packages/core/src/index.ts',
    '^@cplace-cli/git-utils$': '<rootDir>/packages/git-utils/src/index.ts',
    '^@cplace-cli/command-repos$': '<rootDir>/packages/command-repos/src/index.ts',
    '^@cplace-cli/helpers$': '<rootDir>/packages/helpers/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  collectCoverageFrom: [
    'packages/**/*.(t|j)s',
    '!packages/**/*.d.ts',
    '!packages/**/*.test.ts',
    '!packages/**/*.spec.ts',
  ],
  testTimeout: 1000000, // 1000 seconds for long-running operations
};