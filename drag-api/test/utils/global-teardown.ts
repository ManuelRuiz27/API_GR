import { PrismaClient } from '@prisma/client';

export default async function globalTeardown(): Promise<void> {
  const schema = process.env.TEST_DATABASE_SCHEMA;
  const databaseUrl = process.env.DATABASE_URL;

  if (!schema || !databaseUrl) {
    return;
  }

  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.$disconnect();
  }
}
