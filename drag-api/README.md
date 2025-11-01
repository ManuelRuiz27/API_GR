# Drag API

This service is a NestJS application backed by Prisma and PostgreSQL. It exposes a
simple health endpoint and a placeholder users module wired to the Prisma client.

## Local development

1. Install dependencies: `npm install`
2. Generate the Prisma client: `npx prisma generate`
3. Run database migrations: `npx prisma migrate dev`
4. Start the application: `npm run start:dev`

The server listens on `http://localhost:3000` by default.

## Testing

The project ships with Jest configuration. After installing dependencies you can run
unit tests via `npm test` and e2e tests with `npm run test:e2e`.

## Environment variables

| Variable       | Description                                      |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | Connection string to the PostgreSQL instance.    |
| `JWT_SECRET`   | Symmetric secret used for JWT token generation.  |
| `PORT`         | Port where the HTTP server will listen.          |

When running locally you can create an `.env` file with these values.
