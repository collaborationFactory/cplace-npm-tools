module.exports = {
  ...require('../../jest.preset.cjs'),
  displayName: 'helpers',
  testMatch: ['<rootDir>/src/**/*.(test|spec).ts'],
  coverageDirectory: '../../coverage/packages/helpers',
};