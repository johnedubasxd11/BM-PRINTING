module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  testMatch: ['**/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  // mongodb-memory-server nests its own mongodb driver, which sends a client
  // metadata document that MongoDB >= 8.x rejects under Jest (handshake fails
  // with ClientMetadataMissingField). Force every sandboxed require of
  // "mongodb" to the project's pinned driver so replica-set test setup works.
  moduleNameMapper: {
    '^mongodb$': '<rootDir>/node_modules/mongodb'
  },
  collectCoverageFrom: ['server/**/*.js', '!server/data/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 30000,
  transformIgnorePatterns: [
    '/node_modules/'
  ]
};
