import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // src/components/ui se testea con vitest (ver vite.config.ts); sus tests
  // usan `vi` y rompen bajo jest.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/src/components/ui/'],
}

export default createJestConfig(config)
