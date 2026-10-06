# Native bridge v1

Envelope: `{version:1,type,requestId,payload}`. Single `landBanker` WebKit message handler. Main frame and exact configured HTTPS origin only. External navigation is denied inside WKWebView. Web accepts a validated event enum; location fields are range checked. Native sends structured arguments using callAsyncJavaScript, never interpolated JavaScript.

Commands: requestCurrentLocation, startLocationFollow, stopLocationFollow, openCamera, openPhotoLibrary, openShareSheet, hapticFeedback, openExternalNavigation.

Events: nativeReady, locationUpdated, locationPermissionChanged, photoSelectionStarted, photoSelected, photoSelectionFinished, appBecameActive, appBecameInactive, networkStatusChanged, nativeError.

Photos cross as bounded JPEG base64, immediately saved as Blob in IndexedDB with original capture/GPS metadata when present. No secrets or upload tokens enter native configuration. Future large uploads should use a native persisted file transfer rather than base64. Network state is advisory, never an authorization decision.

Photo commands include `observationId` (UUID). Native emits selection start with observationId/count, each photo carries the same observationId, and finish reports count/failed. Library reads images serially. Web serializes EXIF/Blob ingestion, disables Save until imported blobs are durable, and persists expected/received/finished/failed progress with the draft. Interrupted or failed selections require explicit reselection or “Continue with imported photos”; unfinished progress never silently uploads a partial selection. Older native photoSelected events without observationId remain readable, but lack batch guarantees. Stable v1 handler names are intentionally retained.
