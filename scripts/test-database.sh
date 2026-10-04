#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="land-banker-rls-test-$$"
docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 30); do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database-bootstrap.sql
for migration in supabase/migrations/*.sql; do docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$migration"; done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/rls.sql
