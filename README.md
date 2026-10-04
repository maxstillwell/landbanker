# Land Banker

Independent multi-tenant land intelligence web and iOS product. **NEVER BREAK MAXQI.**

`npm ci` · `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

Start with [docs/STATUS.md](docs/STATUS.md), then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Copy `.env.example` to `.env.local` with credentials for a **new** Supabase project. Existing MaxQI/PROS projects are explicitly rejected. Until configured, auth is disabled and protected pages explain setup; no demo user or production fallback exists.

Independent repository directory; no runtime dependency on MaxQI source. iOS code is in `ios/`. Private exports must stay outside Git.

For isolated cloud-workspace testing: `npm run local:start`, `npm run build`, `npm run start`, then `npm run test:e2e`. Real local Auth/Storage are used; no MaxQI production connection. Database security checks: `npm run db:test`. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for results and limits.
