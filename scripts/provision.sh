#!/usr/bin/env bash
set -euo pipefail
# Current user only. Does not mutate any MaxQI resource.
cd "$(dirname "$0")/.."
test "$(git remote get-url origin)" = "https://github.com/maxstillwell/landbanker.git" || { echo 'Independent origin required'; exit 1; }
# User explicitly authorized public source/docs publication to this independent repo.
# Credentials, photos, private snapshots and generated artifacts must stay excluded.
npm ci
npm run lint
npm run typecheck
npm test
npm run build
git push -u origin main
# Connect ONLY the separate land-banker repository to a new Vercel project.
# Supabase project creation requires free capacity or explicit paid-project approval.
# Configure its public credentials, run infra:check, then apply migrations with the guarded script.
