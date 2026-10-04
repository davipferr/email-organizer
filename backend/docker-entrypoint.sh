#!/bin/sh
set -e

# No migrations: make the database match prisma/schema.prisma.
# If a change would lose data (e.g. a renamed/removed field), db push refuses
# and the container stops here with an explanation instead of dropping data.
npx prisma db push

exec node dist/main.js
