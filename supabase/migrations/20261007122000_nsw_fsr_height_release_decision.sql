-- Final Alpha 3 review decision: official license/dictionaries/legend verified,
-- but both layers stay disabled until safe value formatting and representative
-- EPI coverage acceptance exist. Technical availability alone is not release.
update public.layer_catalog
set release_status='disabled',enabled=false,release_checklist=(release_checklist-'release_blocker'-'legend')||
'{
  "reviewed_on":"2026-10-08",
  "license":"Creative Commons Attribution (official NSW Planning Portal dataset)",
  "attribution":"© State Government of NSW and NSW Department of Planning, Housing and Infrastructure 2018",
  "update_frequency":"Weekly (dataset metadata; service currency may differ)",
  "dictionary_status":"Official PDF downloaded HTTP200 and field definitions reviewed",
  "legend_status":"Official service legend HTTP200; 37 FSR classes reviewed",
  "coverage":"Only mapped applicable NSW EPIs; absence is not unrestricted development entitlement",
  "known_limitation":"FSR, LAY_CLASS, Existing and legislative-reference/null cases require explicit display rules",
  "property_intersection_support":"Disabled until value/null/legislative-reference formatting and representative EPI coverage tests pass",
  "release_decision":"Disabled after completed Alpha 3 review; do not enable from endpoint availability alone"
}'::jsonb
where id='nsw-fsr';

update public.layer_catalog
set release_status='disabled',enabled=false,release_checklist=(release_checklist-'release_blocker'-'legend')||
'{
  "reviewed_on":"2026-10-08",
  "license":"Creative Commons Attribution (official NSW Planning Portal dataset)",
  "attribution":"© State Government of NSW and NSW Department of Planning, Housing and Infrastructure 2018",
  "update_frequency":"Weekly (dataset metadata; service currency may differ)",
  "dictionary_status":"Official PDF downloaded HTTP200 and field definitions reviewed",
  "legend_status":"Official service legend HTTP200; 43 height classes reviewed",
  "coverage":"Only mapped applicable NSW EPIs; absence is not unrestricted building height",
  "known_limitation":"MAX_B_H, metres, RL/AHD units, Existing, NA and legislative-reference/null cases require explicit display rules",
  "property_intersection_support":"Disabled until unit/value/null/legislative-reference formatting and representative EPI coverage tests pass",
  "release_decision":"Disabled after completed Alpha 3 review; do not enable from endpoint availability alone"
}'::jsonb
where id='nsw-height';
