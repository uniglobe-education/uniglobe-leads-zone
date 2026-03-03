#!/bin/sh
set -e

echo "🔄 Running Prisma DB sync (prisma db push)..."
npx prisma db push --skip-generate

echo "✅ Database in sync. Starting Next.js..."
exec node server.js
