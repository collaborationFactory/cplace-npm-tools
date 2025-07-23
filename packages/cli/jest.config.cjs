module.exports = {
  ...require('../../jest.preset.cjs'),
  displayName: 'cli',
  testMatch: ['<rootDir>/src/**/*.(test|spec).ts'],
  coverageDirectory: '../../coverage/packages/cli',
  moduleNameMapper: {
    '^@cplace-cli/core$': '<rootDir>/../core/src/index.ts',
    '^@cplace-cli/git-utils$': '<rootDir>/../git-utils/src/index.ts',
    '^@cplace-cli/helpers$': '<rootDir>/../helpers/src/index.ts',
    '^@cplace-cli/command-repos$': '<rootDir>/../command-repos/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};