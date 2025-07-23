module.exports = {
  ...require('../../jest.preset.cjs'),
  displayName: 'git-utils',
  testMatch: ['<rootDir>/src/**/*.(test|spec).ts'],
  coverageDirectory: '../../coverage/packages/git-utils',
};