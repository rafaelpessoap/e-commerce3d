#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Migrations applied. Starting application..."
exec node dist/main.js
