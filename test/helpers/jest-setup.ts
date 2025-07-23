/**
 * Jest setup file for legacy tests
 * This file is run once before all tests in the legacy test suite
 */

// Increase timeout for all tests globally
jest.setTimeout(1000000); // 1000 seconds

// Mock console methods if needed for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// You can uncomment these to suppress console output during tests
// console.log = jest.fn();
// console.error = jest.fn();

// Global test cleanup
afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

export {};