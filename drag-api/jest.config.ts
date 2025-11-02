import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const sharedModuleNameMapper = pathsToModuleNameMapper(compilerOptions.paths ?? {}, {
  prefix: '<rootDir>/',
});

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '<rootDir>/src',
      testMatch: ['**/*.spec.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: sharedModuleNameMapper,
      coverageDirectory: '<rootDir>/coverage/unit',
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '<rootDir>',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: sharedModuleNameMapper,
      setupFilesAfterEnv: ['<rootDir>/test/utils/setup-e2e.ts'],
      globalSetup: '<rootDir>/test/utils/global-setup.ts',
      globalTeardown: '<rootDir>/test/utils/global-teardown.ts',
      maxWorkers: 1,
      coverageDirectory: '<rootDir>/coverage/integration',
    },
  ],
};

export default config;
