import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';

const tsConfig = require('./tsconfig.json') as {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
};

const compilerOptions = tsConfig.compilerOptions ?? {};
const tsPaths = compilerOptions.paths ?? {};

const sharedModuleNameMapper = pathsToModuleNameMapper(tsPaths, {
  prefix: '<rootDir>/',
});

const unitProject = {
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
};

const integrationProject = {
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
};

const config = {
  projects: [unitProject, integrationProject],
} as Config;

export default config;
