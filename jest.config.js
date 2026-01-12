// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test', '<rootDir>/e2e-tests'],
    moduleDirectories: ['node_modules', 'src', 'test', 'e2e-tests'],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
        '^.+\\.(js)$': 'babel-jest',
    },
    testMatch: ['**/?(*.)+(spec|test|e2e).ts'],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    // setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'], // Optional: Add setup file if needed
    testTimeout: 1000000, // Timeout in milliseconds (1000 seconds)
    verbose: true,
};
