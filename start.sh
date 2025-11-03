#!/bin/sh
set -euo pipefail

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node dist/index.js
