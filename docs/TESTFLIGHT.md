# LandOS TestFlight readiness

Display name: LandOS. Stable Xcode project/scheme: LandBanker. iOS 17+, iPhone/iPad. The existing provisional bundle ID com.landbanker.app is configurable via LANDOS_BUNDLE_IDENTIFIER; register the chosen unique ID before the first signed distribution, then keep it stable. No production MaxQI dependency.

## Prepared without signing

Debug and Release configurations; Release optimization/dSYM; scheme Archive uses Release. Bundle/team/app URL are build settings, no credentials committed. When In Use GPS, Camera and Photo Library descriptions are generated from ios/project.yml. No Always Location permission. Persistent WKWebView and account-scoped IndexedDB drafts. Native photos remain bounded JPEG, with available capture/GPS metadata preserved separately.

Cloud macOS CI generates the Xcode project and builds Debug/Release for iPhone and iPad Simulators with CODE_SIGNING_ALLOWED=NO. These artifacts cannot be installed as signed physical-device/TestFlight apps.

## Signing/distribution requirements

Apple Developer membership and current App Store Connect agreements; registered Bundle identifier; team/signing certificate and provisioning profile or approved automatic-signing access. Store credentials in an authorized secret store/GitHub Actions secrets, never chat/source/.env.example. Account access and signing credentials are external dependencies, not grounds to pause Web development.

Generate with xcodegen using ios/project.yml. For a signed Release archive, explicitly override CODE_SIGNING_ALLOWED=YES, LANDOS_DEVELOPMENT_TEAM, LANDOS_BUNDLE_IDENTIFIER and LAND_BANKER_WEB_URL; use generic/platform=iOS destination, an archivePath, and an approved App Store export configuration. CI defaults are unsigned. Increment CURRENT_PROJECT_VERSION for every uploaded build. Do not use a Simulator artifact for TestFlight.

Before upload: confirm app icon/screenshots, privacy policy/support URL, App Privacy answers (location/photos/account/workspace data), encryption/export compliance answers, sign-in/test-account instructions, correct environment and no production MaxQI URLs/keys. Do not claim privacy answers/review approval completed without checking the actual App Store Connect form.

## Acceptance

Complete ACCEPTANCE.md device matrix on signed iPhone and iPad. Particularly: app kill while drawing/photo import/upload; logout/account switch; expired session; photo HEIC/large originals; rotation while editing/uploading; weak network and desktop sync. Record device/iOS/build/configuration/time, result and remaining failures. No signed-device pass claimed yet.
