import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@hospiwaste/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
}

export default createJestConfig(config)
