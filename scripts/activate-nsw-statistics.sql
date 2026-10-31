-- Run only after the matching runtime is Production READY and complete CI passes.
-- This changes platform availability, never user preferences or workspace records.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.layer_catalog
      WHERE state='NSW' AND renderer='geojson'
        AND dataset_metadata->>'verified_on'='2026-10-31'
        AND (
          (id IN ('nsw-median-sales','nsw-median-rent')
            AND dataset_metadata->>'licence_url'='https://creativecommons.org/licenses/by/4.0/')
          OR (id='nsw-recorded-incidents'
            AND dataset_metadata->>'licence_url'='https://opendefinition.org/licenses/cc-by/')
        )) <> 3 THEN
    RAISE EXCEPTION 'All three reviewed NSW aggregate entries must be staged first';
  END IF;
END $$;
UPDATE public.layer_catalog SET enabled=true, updated_at=now()
WHERE id IN ('nsw-median-sales','nsw-median-rent','nsw-recorded-incidents')
RETURNING id, enabled, release_status;
COMMIT;

-- Availability rollback: set enabled=false for these same three IDs.
-- No saved workspace preferences or records are deleted by that rollback.
