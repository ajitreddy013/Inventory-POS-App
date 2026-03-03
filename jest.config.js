module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/main.js',
    '!src/preload.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transformIgnorePatterns: [
    'node_modules/(?!(fast-check)/)'
  ],
  moduleNameMapper: {
    '^fast-check$': '<rootDir>/node_modules/fast-check/lib/fast-check.js'
  },
  testTimeout: 30000
};
