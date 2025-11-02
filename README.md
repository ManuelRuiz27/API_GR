# API_GR

API para plataforma de eventos GR _ Producciones

## Drag API service

The repository now includes a NestJS service located in [`drag-api/`](drag-api/) built with
Prisma and PostgreSQL support.

### Running with Docker

1. Copy the provided [.env.example](.env.example) file to `.env` and update the values as
   needed.
2. Build the containers:
   ```bash
   docker compose build
   ```
3. Start the stack:
   ```bash
   docker compose up
   ```

The API will be available at `http://localhost:3000`. The PostgreSQL service is exposed on
port `5432`. Logs from both services are streamed to the console while `docker compose up`
is running.

To stop the services press `Ctrl+C` or run `docker compose down` in a separate terminal. The
PostgreSQL data is persisted using the `db-data` volume defined in the compose file.

### Testing & linting

All quality gates run inside the `drag-api/` folder:

```bash
cd drag-api
npm install
npx prisma generate
npm test           # unit + integration (PostgreSQL required)
npm run lint       # eslint sin autofixes
```

You can rely on `docker compose up -d db` to provision the PostgreSQL instance before
running the commands above.
