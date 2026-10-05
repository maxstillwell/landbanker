# iOS

Swift / SwiftUI / WKWebView / CoreLocation / PhotosUI / Network.framework. iOS 17+, iPhone and iPad. No MaxQI URLs or cookies. Web authentication uses Land Banker Supabase Auth; default WKWebsiteDataStore persists cookies and IndexedDB across relaunch. Future native Supabase Auth is supported at the domain boundary, not implemented yet.

`brew install xcodegen`; `xcodegen generate --spec ios/project.yml --project ios`; `xcodebuild -project ios/LandBanker.xcodeproj -scheme LandBanker -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO LAND_BANKER_WEB_URL=https://<preview>/app/map build`.

URL is a build setting in Info.plist. HTTPS and exact origin required; MaxQI domains rejected. Unconfigured builds show a setup message. Native supports When In Use location only, Locate Me, Follow Me, accuracy circle event, permission changes, foreground restart and background stop. Wi-Fi-only iPad positioning may be less precise than cellular iPad/iPhone.

Camera uses UIImagePickerController; library uses the native PhotosUI PHPicker without broad library permission. Selected images resized to 2400 pixels/JPEG with capture/GPS metadata preserved when available; web still accepts original JPEG/PNG/HEIC uploads. Simulator camera unavailable is handled explicitly. Network monitor is advisory. No Always/background location entitlement. Share sheet configured for iPad popover. External maps opened only from validated coordinates.

Cloud CI `.github/workflows/ci.yml` generates Xcode project on macos-15 and builds both iPhone and iPad Simulator targets without signing. **This Linux environment cannot run Xcode directly; GitHub macOS CI has now built both iPhone and iPad Simulator apps successfully.** Real-device permission/cookie/relaunch/photo tests are still required. Apple signing/TestFlight is a later external credential step; unsigned Simulator builds passed.

Recovery links opened in Safari do not share WKWebView PKCE cookies. Complete the web recovery flow in the initiating browser for now; native universal-link recovery routing is a follow-up before an iOS release. Browser password recovery is verified locally. App relaunch/expired-session/native-permission behavior is designed but still needs Simulator/device validation.

2026-10-05 cloud result: unsigned iPhone and iPad Simulator builds PASSED in https://github.com/maxstillwell/landbanker/actions/runs/37247783731, with downloadable .app artifacts. No device-signing/TestFlight release. Later runs use the configurable Vercel build-setting default; app signup remains unavailable until the independent hosted backend is authorized/configured.
