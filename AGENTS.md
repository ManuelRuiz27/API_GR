# Agent Instructions

## Verification checklist

Use the following commands after making changes to confirm the project is healthy:

1. `cd drag-api`
2. `npm install`
3. `npx prisma generate`
4. Start PostgreSQL if it is not already running: `docker compose up -d db`
5. `npm test`
6. `npm run lint`

The Jest suite provisions an isolated schema automatically. Ensure the `DATABASE_URL`
environment variable points to the PostgreSQL service before running the commands.
