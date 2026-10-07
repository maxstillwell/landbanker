# LandOS

**The operating system for land.** Map. Analyse. Manage land.

LandOS is an independent spatial workspace for Australian land professionals: investors, owners, developers, acquisition managers, real estate professionals, planners, consultants and field teams.

Core objects: Workspace, Property, Observation, Layer, Feature, View, Share. Four product pillars: Field Workflow, Parcel, Drawing, Layers. It is not primarily a property listing site, valuation portal, CRM or simple map viewer. Field observations are one part of the spatial workspace.

Execution order: P0 field reliability/security; P1 VIC/NSW parcel search and save; P2 drawing/measurement/persistent My Layers; P3 official layer library; P4 phone/iPad refinement; P5 representative copy-only MaxQI test set; P6 saved views/sharing. No full import while schema changes; no MaxQI cutover.

Independent repository/backend/deployment retain their existing landbanker identifiers. Visible brand is LandOS. Stable database names, migration history, native bridge, queue storage names and environment variable names remain compatible. Domain is environment-configured.

Future plans: free/pro/team entitlements, with development owner full access. No billing, AI assistant, automated valuation, CRM, document system, Android or offline basemap downloads in this milestone.

## Alpha 2 Property workspace foundation

Saved Property inspector starts Overview, Planning, Layers, Field and My Analysis. Overview keeps area/ID/address/source; Planning lists active state reference layers and clearly records that property-specific controls are not yet queried. Field shows explicitly linked loaded observations/photos and can create a property-linked observation while retaining GPS/map positioning. My Analysis lists loaded features with explicit parcel_id association; generic drawings/views remain in Layers. Spatial analysis relationships, exhaustive property controls and complete property-linked paging remain future work. No CRM/valuation/documents are introduced.

## Alpha 3 Property intelligence

Planning now queries actual saved boundary intersections against supported enabled VIC/NSW official sources, showing control code/name/value, coverage where polygon area applies and provenance/failure/no-result distinctions. Active map layers no longer stand in for applicable controls. Details/geometry highlight persist across Property navigation. Field defaults to explicit links and distinguishes approximate Nearby; My Analysis separates explicit links, spatial intersections and matching Saved Views. FSR/Height remain disabled until documented value/legend release gates are resolved. No development approval/valuation/CRM implication is made.
