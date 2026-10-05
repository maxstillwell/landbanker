# Shared Leaflet basemap

Web, iPhone and iPad use the same Leaflet map in the Land Banker Web App. iOS embeds it through WKWebView; CoreLocation supplies GPS, not an Apple Maps replacement.

## 403 fix — 2026-10-06

The app's global `Referrer-Policy: no-referrer` suppressed identification required by the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Map pages now override it with `strict-origin-when-cross-origin`, and Leaflet tile images explicitly use that policy. Cross-origin tile requests send only the app origin, never Workspace paths, query strings or tokens. Login/recovery/share pages retain no-referrer. Native WKWebView appends the stable `LandBanker/0.1` application name to its platform browser identification.

The current public OSM tile endpoint remains unchanged. Attribution and normal browser caching remain in place. No tile proxy, identity spoofing, cache-busting or bulk/offline downloads are introduced. Public OSM hosting has no product SLA; choose a provider with suitable terms/capacity before broader SaaS traffic or offline maps, and use the same source in Web/iOS.

## Verification

Lint, typecheck, seven unit tests and production build passed. Local real Auth/Storage browser Field MVP passed, including a new assertion that tile requests send only the app origin. Downloaded tile returned HTTP 200 and visually showed the map. Browser desktop screenshot confirmed the Leaflet basemap renders. Local HTTP checks verified map origin policy and share no-referrer. Current iOS source uses applicationNameForUserAgent; refreshed macOS Simulator CI/device validation is separate.
