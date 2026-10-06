# Data model

| Table                   | Scope / purpose                                                                   |
| ----------------------- | --------------------------------------------------------------------------------- |
| profiles                | `id = auth.users.id`; own display profile                                         |
| workspaces              | personal owner unique; independent workspace identity                             |
| workspace_memberships   | workspace + user primary key; owner/admin/editor/viewer; active/invited/suspended |
| land_parcels            | workspace, point/boundary, hectares, status, notes, preserved metadata            |
| field_observations      | workspace, location, text, observed time, optional parcel                         |
| field_observation_media | workspace, observation, private storage path, captured time, upload state         |
| spatial_layers          | workspace, normalized GeoJSON + preserved legacy layer payload                    |
| spatial_features        | workspace, parent layer, individual GeoJSON feature                               |
| saved_views             | workspace, map centre/zoom; explicit resources required before sharing subsets    |
| share_links             | workspace, creator, SHA-256 token hash, resource scope, read only, expiry/revoke  |
| migration_mappings      | workspace + source system/table/legacy ID unique; target ID/source hash           |

Composite `(workspace_id,id)` foreign keys enforce same-workspace parcel–observation, observation–media, layer–feature links. Workspace IDs immutable on business record updates. Workspace indices and membership lookup index support RLS reads.

Trigger-only private signup bootstrap creates the three personal workspace records atomically. Display-name metadata is cosmetic; owner role is a fixed constant. All exposed tables have RLS and explicit grants. No public guest database access. Business records: members read; owner/admin/editor insert/update; owner/admin delete. Client membership writes are denied. Sharing managed by owner/admin; token scope cannot be changed through client UPDATE.

Private storage `field-media`: 25 MB JPEG/PNG/HEIC. Object path `workspace/observation/media.ext` must match an existing permitted media row. Signed uploads require user RLS. Imported media has null destination path + `legacy_pending`; no legacy file is deleted or automatically treated as a destination upload.

## LandOS additions (2026-10-06)

Parcel provenance adds official state/source/source_parcel_id/address/source_updated_at/saved_at without changing legacy records. Idempotent Save re-verifies official geometry on server and never overwrites an existing saved parcel. observed_at_source distinguishes device/user/photo/legacy; photo metadata never silently changes observation position.

layer_catalog is shared public reference configuration, authenticated read-only, not tenant business data. active_map_layers is user + Workspace-scoped and membership-protected. workspace_entitlements is member-readable, server-write-only free/pro/team configuration. All three tables have RLS and explicit grants; no anon grant. save_layer_features is SECURITY INVOKER and atomic. spatial_features retains stable feature UUID and full GeoJSON; parent collection remains a compatible map projection.

Hosted foundation migration timestamps differ from local historical filename; the existing hosted foundation was inspected, not replayed. Subsequent provenance/features/catalog changes are additive and applied only to gksyipjxhrolsgztfyer. No MaxQI changes.

Share Link manifest is additive JSONB; original table/IDs/history stay stable. Saved View has typed explicit parcel_ids/layer_ids/official_layers in view JSON. Link freezes resource/Feature scope; only revoked_at can be updated by clients. public.resolve_landos_share accepts a raw secure token and hashes internally, projects minimal allowed fields and checks workspace on every selected resource. General business tables stay inaccessible to anon.
