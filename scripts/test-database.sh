#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="land-banker-rls-test-$$"
docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
ready=false
# The image briefly starts a socket-only bootstrap server. Wait for final TCP readiness.
for attempt in $(seq 1 30); do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
if [[ $ready != true ]]; then docker logs "$container"; exit 1; fi
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/database-bootstrap.sql
for migration in supabase/migrations/*.sql; do docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < "$migration"; done
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/rls.sql
python3 tests/sync-concurrency.py "$container"
