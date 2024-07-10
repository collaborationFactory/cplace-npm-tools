// jest.config.js
module.exports = {
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
    // setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'], // Optional: Add setup file if needed
    testTimeout: 1000000, // Timeout in milliseconds (1000 seconds)
    verbose: true,
};
