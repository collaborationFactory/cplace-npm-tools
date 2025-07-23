module.exports = {
  ...require('../../jest.preset.cjs'),
  displayName: 'command-repos',
  testMatch: ['<rootDir>/src/**/*.(test|spec).ts'],
  coverageDirectory: '../../coverage/packages/command-repos',
  moduleNameMapper: {
    '^@cplace-cli/core$': '<rootDir>/../core/src/index.ts',
    '^@cplace-cli/git-utils$': '<rootDir>/../git-utils/src/index.ts',
    '^@cplace-cli/helpers$': '<rootDir>/../helpers/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};