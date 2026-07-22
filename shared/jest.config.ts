import type { Config } from 'jest'

// Config standalone (sin next/jest): shared no es una app Next.
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@hospiwaste/shared/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: { jsx: 'react-jsx', esModuleInterop: true, resolveJsonModule: true, allowJs: true } },
    ],
  },
  // src/components/ui se testea con vitest (ver vite.config.ts); sus tests usan `vi`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/components/ui/'],
}

export default config
