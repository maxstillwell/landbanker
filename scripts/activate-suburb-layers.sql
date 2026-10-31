-- Run only after the matching production runtime is READY and complete CI passes.
-- Catalogue availability only: no workspace preferences or user records change.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.layer_catalog
      WHERE id IN ('vic-suburb-median-prices','vic-suburb-recorded-offences')
        AND renderer='geojson'
        AND state='VIC'
        AND dataset_metadata->>'verified_on'='2026-10-31'
        AND dataset_metadata->>'licence_url'='https://creativecommons.org/licenses/by/4.0/') <> 2 THEN
    RAISE EXCEPTION 'Both reviewed suburb catalogue entries must be staged first';
  END IF;
END $$;
UPDATE public.layer_catalog SET enabled=true, updated_at=now()
WHERE id IN ('vic-suburb-median-prices','vic-suburb-recorded-offences')
RETURNING id, enabled, release_status;
COMMIT;

-- Availability rollback, if required: set enabled=false for these same two IDs.
-- Disabling catalogue availability does not delete saved user preferences.
