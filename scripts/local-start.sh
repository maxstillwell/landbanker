#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# This isolated stack is for development only. No existing Supabase project is contacted.
if [[ -f .env.local ]]; then
  node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
const url = readFileSync('.env.local','utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1];
if (url !== 'http://127.0.0.1:54321') throw new Error('Local test stack requires its own .env.local; use a separate checkout from cloud configuration');
JS
fi
if [[ ! -f infra/local/.env || ! -f .env.local ]]; then node scripts/local-config.mjs; fi
compose=(docker compose --env-file infra/local/.env -f infra/local/compose.yml)
"${compose[@]}" up -d db
for attempt in {1..30}; do
  if "${compose[@]}" exec -T db pg_isready -h 127.0.0.1 -U postgres -d landbanker >/dev/null 2>&1; then break; fi
  sleep 1
done
if [[ $("${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -Atc "select count(*) from pg_roles where rolname='authenticator'") == 0 ]]; then
  "${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -v ON_ERROR_STOP=1 < infra/local/bootstrap.sql
fi
"${compose[@]}" up -d auth rest storage mail
for attempt in {1..30}; do
  ready=$("${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -Atc "select to_regclass('auth.users') is not null and to_regclass('storage.buckets') is not null")
  if [[ $ready == t ]]; then break; fi
  sleep 1
done
[[ $ready == t ]] || { echo 'Local Auth/Storage migrations did not become ready'; exit 1; }
if [[ $("${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -Atc "select to_regclass('public.land_parcels') is null") == t ]]; then
  "${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -v ON_ERROR_STOP=1 < supabase/migrations/20261004045401_land_banker_foundation.sql
fi
"${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -v ON_ERROR_STOP=1 < infra/local/storage-grants.sql
"${compose[@]}" exec -T db psql -h 127.0.0.1 -U postgres -d landbanker -c "notify pgrst, 'reload schema'"
"${compose[@]}" create gateway
chmod 644 infra/local/kong.yml
"${compose[@]}" cp infra/local/kong.yml gateway:/etc/kong/kong.yml
"${compose[@]}" up -d gateway
echo 'Local backend: http://127.0.0.1:54321; mail: http://127.0.0.1:54324. Run npm run dev.'
