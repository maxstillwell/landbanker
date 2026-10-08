# LandOS TestFlight readiness

Display name: LandOS. Stable Xcode project/scheme: LandBanker. iOS 17+, iPhone/iPad. The existing provisional bundle ID com.landbanker.app is configurable via LANDOS_BUNDLE_IDENTIFIER; register the chosen unique ID before the first signed distribution, then keep it stable. No production MaxQI dependency.

## Prepared without signing

Debug and Release configurations; Release optimization/dSYM; scheme Archive uses Release. Bundle/team/app URL are build settings, no credentials committed. The checked-in entitlement file is deliberately empty: Camera, PhotosPicker, When In Use Location and network access do not require a special Apple capability. Do not add Always/background location, broad Photo Library, Associated Domains, push, iCloud or Keychain groups without a reviewed product requirement. When In Use GPS, Camera and Photo Library descriptions are generated from ios/project.yml. Persistent WKWebView and account-scoped IndexedDB drafts. Native photos remain bounded JPEG, with available capture/GPS metadata preserved separately.

Cloud macOS CI generates the Xcode project and builds Debug/Release for iPhone and iPad Simulators with CODE_SIGNING_ALLOWED=NO. These artifacts cannot be installed as signed physical-device/TestFlight apps.

## Signing/distribution requirements

Apple Developer membership and current App Store Connect agreements; registered Bundle identifier; team/signing certificate and provisioning profile or approved automatic-signing access. Store credentials in an authorized secret store/GitHub Actions secrets, never chat/source/.env.example. Account access and signing credentials are external dependencies, not grounds to pause Web development.

Generate with xcodegen using ios/project.yml. For a signed Release archive, explicitly override CODE_SIGNING_ALLOWED=YES, LANDOS_DEVELOPMENT_TEAM, LANDOS_BUNDLE_IDENTIFIER and LAND_BANKER_WEB_URL; use generic/platform=iOS destination, an archivePath, and an approved App Store export configuration. CI defaults are unsigned. Increment CURRENT_PROJECT_VERSION for every uploaded build. Do not use a Simulator artifact for TestFlight.

Exact manual sequence when the Apple account is available:

1. In Certificates, Identifiers & Profiles, register one explicit App ID using the final `LANDOS_BUNDLE_IDENTIFIER`. Enable no optional capabilities for the current build.
2. In App Store Connect, accept outstanding agreements and create the LandOS iOS app record against that Bundle ID. Record the numeric Apple team ID and app Apple ID outside Git.
3. Give the release operator App Manager or an appropriately narrower role plus access to the app. Use Xcode automatic signing on the operator machine, or store an App Store Connect API key/certificate/profile only in approved encrypted CI secrets.
4. Run `xcodegen generate --spec ios/project.yml --project ios`, archive Release for `generic/platform=iOS` with the final team, bundle ID, build number and `https://landbanker.vercel.app/app/map`, then validate the archive before upload.
5. Upload to App Store Connect, wait for processing, answer export-compliance/App Privacy questions from the actual build behavior, add the build to an Internal Testing group and complete the signed-device matrix before inviting broader testers.

The first App Store Connect record still needs human account access. The owner-selected Visual Identity v2 Spatial Data Overlay direction supplies the production-intent 1024 px icon and complete AppIcon set. Its actual masked rendering still needs review on signed iPhone/iPad hardware before submission. Editable iPhone/iPad App Store templates are supplied; final screenshots must be captured from a signed reviewed build with publishable data. Simulator artifacts and template placeholders must not be submitted as final screenshots.

## App Store Connect metadata checklist

- LandOS display name, subtitle/description, primary category and age rating.
- Final Bundle ID, SKU, version/build number and copyright.
- Privacy policy URL, support URL and reviewer contact.
- App Privacy disclosures for account identity, precise location, user notes, parcel/workspace content and photos; explain that private media is authenticated and shared Views exclude private observations/media.
- Camera, photo selection and When In Use location purpose text exactly matching the build.
- Encryption/export-compliance response based on standard HTTPS/WebKit use and any later native cryptography; do not copy an answer from a different app.
- Review notes and a dedicated test account against LandOS, never MaxQI credentials.
- Internal tester group, tester access, feedback contact, “What to Test”, expiry awareness and build-processing status.
- Confirm production URL, logout/password reset, public-share gateway and account deletion/support process before external testing.

Before upload: confirm app icon/screenshots, privacy policy/support URL, App Privacy answers (location/photos/account/workspace data), encryption/export compliance answers, sign-in/test-account instructions, correct environment and no production MaxQI URLs/keys. Do not claim privacy answers/review approval completed without checking the actual App Store Connect form.

## Acceptance

Complete ACCEPTANCE.md device matrix on signed iPhone and iPad. Particularly: app kill while drawing/photo import/upload; logout/account switch; expired session; photo HEIC/large originals; rotation while editing/uploading; weak network and desktop sync. Record device/iOS/build/configuration/time, result and remaining failures. No signed-device pass claimed yet.
