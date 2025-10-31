module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/**/*.test.js',
  ],
  testMatch: [
    '**/test/**/*.test.js',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
