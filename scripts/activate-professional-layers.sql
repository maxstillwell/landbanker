-- Run only after the matching production code is READY and release checks pass.
-- Idempotent catalogue-only activation; no workspace preferences or records change.
UPDATE public.layer_catalog SET enabled=true, updated_at=now() WHERE id IN ('vic-ddo','vic-dpo','vic-pao','vic-fo','vic-lsio','vic-sbo','vic-bushfire','vic-eso','vic-vpo','vic-heritage','vic-ugb','vic-bpa','vic-vpa-precincts','abs-population-growth','vic-median-prices','vic-recorded-offences','abs-seifa','abs-building-approvals','nsw-flood-planning','nsw-bushfire-prone','vic-schools');
