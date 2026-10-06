# Layer Library

LandOS separates My Layers (workspace-owned spatial_features) from official reference layers (layer_catalog). Viewing official mapping does not import government features into a Workspace. Active official layers are saved per user and Workspace in active_map_layers, with visibility, opacity and position. No catalog configuration is editable through a client credential.

Initial live-verified sources:

| State | Working layers | Provider |
| --- | --- | --- |
| Victoria | Zoning, flood planning overlays, BMO, heritage, cadastral parcels | Victorian Government Planning/Vicmap services |
| NSW | EPI zoning, EPI heritage, cadastral parcels | NSW Government / Spatial Services |

Layer metadata includes source/service URLs, category, description, attribution, usage notes, tier, enabled status and nullable update frequency. No invented refresh frequency. Flood overlays are planning controls, not complete flood modelling; BMO is not the entire bushfire-prone-area dataset. Absence of an overlay does not establish absence of risk. Library clearly describes scope.

Live source metadata and representative VIC flood / NSW zoning PNG exports verified 2026-10-06. ArcGIS export requests use viewport tiles, minZoom, updateWhenIdle and a small tile buffer. No feature download on every move, no offline basemap caching. Layer error is visible; external availability remains outside our control. NSW flood/growth/PSP coverage and licensed satellite basemap are next catalog work, not claimed as complete.

Owner has full development feature access. workspace_entitlements supports free/pro/team; capabilities are read from trusted Workspace membership/server-owned entitlements, never editable Auth metadata. No billing, no development-owner lockout. Commercial launch must settle provider terms and enforce any premium entitlements consistently in all relevant API/database paths; current public official reference metadata is not proprietary premium content.

Drawing supports Point, LineString, Polygon and Rectangle. Metric spherical area/distance estimates are not surveys. Touch-draggable handles, Undo, named shape, note and target layer. Save uses SECURITY INVOKER save_layer_features: one transaction for parent GeoJSON and normalized feature records, workspace membership/RLS throughout. Features have stable UUIDs. Feature deletion allowed to editors in their own Workspace. Imported multipart/hole geometries remain viewable; editor refuses to simplify them silently. Shape movement currently achieved by dragging vertices; dedicated whole-object translation and vertex insertion remain next improvements.

Finished unsaved shapes use the existing account/Workspace-scoped IndexedDB abstraction and are labeled Local Draft / Only on this device. Save to Workspace clears the draft only after success. In-progress vertex clicks are not yet persisted before Finish.

Catalog expansion 2026-10-06: Victoria All Overlays (official Feature Layer 0) and NSW EPI Lot Size (Feature Layer 4). Metadata and representative PNG exports passed live verification. Enabled catalog total: ten. Minimum lot size is a planning control, not measured parcel area or an assurance of subdivision approval. Broad risk coverage, statewide analytical completeness and licensed Satellite remain separate work. Local scale regression checks ten active catalog preferences rendered in the inspector alongside 500 parcels/observations; it does not assert every statewide layer has features at one location.
