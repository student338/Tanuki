/** Jest configuration for Selenium end-to-end tests.
 *
 * Run with:  npx jest --config jest.selenium.config.js
 *
 * Prerequisites:
 *  - Build the app:   npx next build
 *  - The tests start/stop the Next.js server automatically via
 *    globalSetup / globalTeardown.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/selenium/**/*.test.ts'],
  globalSetup: '<rootDir>/tests/selenium/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/selenium/globalTeardown.ts',
  testTimeout: 60000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
};
