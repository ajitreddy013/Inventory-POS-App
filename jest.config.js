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
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testTimeout: 30000
};
