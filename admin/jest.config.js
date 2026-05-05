/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^next/headers$': '<rootDir>/__mocks__/next-headers.ts',
    '^next/server$':  '<rootDir>/__mocks__/next-server.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/app/api/**/*.ts',
    '!src/**/*.d.ts',
  ],
}

module.exports = config
