# Native bridge v1

Envelope: `{version:1,type,requestId,payload}`. Single `landBanker` WebKit message handler. Main frame and exact configured HTTPS origin only. External navigation is denied inside WKWebView. Web accepts a validated event enum; location fields are range checked. Native sends structured arguments using callAsyncJavaScript, never interpolated JavaScript.

Commands: requestCurrentLocation, startLocationFollow, stopLocationFollow, openCamera, openPhotoLibrary, openShareSheet, hapticFeedback, openExternalNavigation.

Events: nativeReady, locationUpdated, locationPermissionChanged, photoSelected, appBecameActive, appBecameInactive, networkStatusChanged, nativeError.

Photos cross as bounded JPEG base64, immediately saved as Blob in IndexedDB with original capture/GPS metadata when present. No secrets or upload tokens enter native configuration. Future large uploads should use a native persisted file transfer rather than base64. Network state is advisory, never an authorization decision.
