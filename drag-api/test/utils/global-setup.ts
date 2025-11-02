import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import path from 'path';

function resolveDatabaseUrl(): string {
  const base =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/drag-api';

  const url = new URL(base);
  const schema = `test_${randomUUID().replace(/-/g, '')}`;
  url.searchParams.set('schema', schema);

  process.env.DATABASE_URL = url.toString();
  process.env.TEST_DATABASE_SCHEMA = schema;

  return url.toString();
}

export default async function globalSetup(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();

  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

  const projectRoot = path.resolve(__dirname, '..', '..');

  execSync('npx prisma migrate deploy', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
