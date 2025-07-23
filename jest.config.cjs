const { createGlobPatternsForDependencies } = require('@nx/jest');

module.exports = {
  projects: [
    // Individual package tests only - legacy src/test folders excluded from execution
    '<rootDir>/packages/*/jest.config.cjs',
  ],
  // Exclude legacy folders from all test runs
  testPathIgnorePatterns: [
    '<rootDir>/src/',
    '<rootDir>/test/',
    '<rootDir>/node_modules/',
  ],
  // Coverage collection only from packages
  collectCoverageFrom: [
    'packages/**/*.(t|j)s',
    '!packages/**/*.d.ts',
    '!packages/**/*.test.ts',
    '!packages/**/*.spec.ts',
    '!src/**/*',      // Exclude legacy src
    '!test/**/*',     // Exclude legacy test
  ],
};
