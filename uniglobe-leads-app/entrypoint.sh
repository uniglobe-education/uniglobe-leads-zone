#!/bin/sh
set -e

echo "🔄 Running Prisma DB sync..."
# Use the locally-installed prisma binary to avoid version conflicts with npx
./node_modules/.bin/prisma db push --skip-generate

echo "✅ Database in sync. Starting Next.js..."
exec node server.js
