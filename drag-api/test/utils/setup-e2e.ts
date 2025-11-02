import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function resetDatabase(): Promise<void> {
  const schema = process.env.TEST_DATABASE_SCHEMA ?? 'public';
  const tables = (await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = ${schema}
  `)
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations');

  if (!tables.length) {
    return;
  }

  const formatted = tables
    .map((table) => `"${schema}"."${table}"`)
    .join(', ');

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${formatted} RESTART IDENTITY CASCADE`);
}

afterAll(async () => {
  await prisma.$disconnect();
});
