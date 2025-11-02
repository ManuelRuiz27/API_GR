# Drag API

This service is a NestJS application backed by Prisma and PostgreSQL. It powers
authentication, layout management, table availability, reservations and payment
flows for the GR events platform.

## Local development

> ℹ️ Todos los comandos se ejecutan dentro del directorio `drag-api/`.

1. Install dependencies: `npm install`
2. Generate the Prisma client: `npx prisma generate`
3. Start the PostgreSQL service (see [Docker](#docker) below) or point
   `DATABASE_URL` to an existing instance.
4. Apply the migrations: `npx prisma migrate dev`
5. Start the API: `npm run start:dev`

The server listens on `http://localhost:3000` by default.

## Testing

The project ships with Jest projects for unit and integration tests.

1. Ensure PostgreSQL is running and accessible through `DATABASE_URL`. The
   easiest option is `docker compose up -d db` from the repository root.
2. Generate the Prisma client: `npx prisma generate`
3. Run the full suite: `npm test`
4. Execute only the integration tests (opcional): `npm run test:e2e`
5. Run the linter with strict settings: `npm run lint`

The integration suite automatically provisions an isolated schema, runs
`prisma migrate deploy` and tears the schema down once the tests finish.

## Docker

El contenedor de la API puede utilizarse en desarrollo y CI. Desde el directorio
raíz del repositorio:

```bash
docker compose up -d db      # inicia PostgreSQL para pruebas locales/CI
docker compose up api        # construye y ejecuta la API
```

The API is exposed on `http://localhost:3000` and PostgreSQL on `localhost:5432`.
The compose stack reads configuration from `.env`; a sample file is provided at
[`../.env.example`](../.env.example).

## Environment variables

| Variable       | Description                                      |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | Connection string to the PostgreSQL instance.    |
| `JWT_SECRET`   | Symmetric secret used for JWT token generation.  |
| `PORT`         | Port where the HTTP server will listen.          |

When running locally you can create an `.env` file with these values.

## Endpoints principales

Los endpoints expuestos actualmente por la aplicación (prefijo global `/api`):

| Método | Ruta                               | Descripción breve                                   |
| ------ | ---------------------------------- | --------------------------------------------------- |
| GET    | `/api/health`                      | Verificación de estado del servicio.                |
| POST   | `/api/auth/login`                  | Autenticación de usuarios y emisión de JWT.         |
| POST   | `/api/auth/refresh`                | Renovación de tokens de sesión.                     |
| GET    | `/api/layouts`                     | Listado de layouts de venue (requiere rol Staff).   |
| POST   | `/api/layouts`                     | Creación de layouts.                                |
| GET    | `/api/layouts/:id`                 | Obtención de un layout específico.                  |
| PUT    | `/api/layouts/:id`                 | Actualización de layouts existentes.                |
| POST   | `/api/layouts/:id/publish`         | Publicación de layouts y auditoría de eventos.      |
| DELETE | `/api/layouts/:id`                 | Eliminación de layouts.                             |
| GET    | `/api/table-map`                   | Mapa de disponibilidad de mesas por evento.         |
| POST   | `/api/reservations/hold`           | Apartado temporal de asientos.                      |
| POST   | `/api/reservations`                | Confirmación de una reserva.                        |
| DELETE | `/api/reservations/:id`            | Cancelación de una reserva.                         |
| POST   | `/api/spei/references`             | Creación de referencias SPEI para pagos bancarios.  |
| POST   | `/api/spei/confirmations`          | Confirmación de pagos SPEI.                         |
| GET    | `/api/spei/receipts/:reference`    | Consulta de recibos SPEI.                           |

Estos recursos sirven como punto de partida para futuras extensiones o
actualizaciones de la plataforma.
