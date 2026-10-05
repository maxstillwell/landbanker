#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${LAND_BANKER_PROJECT_REF:?Independent project ref required}"
case "$LAND_BANKER_PROJECT_REF" in kcdzzbmkqtuwfzbeqcks|xlrtlqhhzhmdhrmuoyot) echo 'Existing production projects are forbidden'; exit 1;; esac
: "${LAND_BANKER_DATABASE_URL:?New backend database URL required}"
case "$LAND_BANKER_DATABASE_URL" in *kcdzzbmkqtuwfzbeqcks*|*xlrtlqhhzhmdhrmuoyot*) echo 'Existing project forbidden'; exit 1;; esac
node --input-type=module <<'JS'
const ref = process.env.LAND_BANKER_PROJECT_REF;
const url = new URL(process.env.LAND_BANKER_DATABASE_URL);
const direct = url.hostname === `db.${ref}.supabase.co`;
const pooler = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${ref}`;
if (!direct && !pooler) throw new Error('Database connection must identify the explicit independent project');
JS
# Never echo the URL or credentials.
./node_modules/.bin/supabase db push --db-url "$LAND_BANKER_DATABASE_URL"
