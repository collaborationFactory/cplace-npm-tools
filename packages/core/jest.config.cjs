module.exports = {
  ...require('../../jest.preset.cjs'),
  displayName: 'core',
  testMatch: ['<rootDir>/src/**/*.(test|spec).ts'],
  coverageDirectory: '../../coverage/packages/core',
};