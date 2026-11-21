# Hell Agency mobile

This folder packages the original Hell Agency 3D arena game for Android and iOS with Capacitor. The characters and game assets are original.

## Local development

1. Install Node.js 20 or newer and install Android Studio (Android) or Xcode on macOS (iOS).
2. Run `npm install`.
3. Generate the native project with `npx cap add android` or `npx cap add ios`.
4. Run `npx cap sync`.

The Android debug APK can be built with `cd android && gradlew.bat assembleDebug` on Windows or `./gradlew assembleDebug` on macOS/Linux. iOS builds require macOS and Xcode.

## GitHub Actions builds

The repository workflow `/.github/workflows/build-helluva-game.yml` builds a debug APK. To produce an installable iOS IPA, configure these repository secrets:

- `APPLE_CERTIFICATE_BASE64`: base64-encoded Apple Distribution `.p12`.
- `APPLE_CERTIFICATE_PASSWORD`: password for that `.p12`.
- `APPLE_PROVISIONING_PROFILE_BASE64`: base64-encoded Ad Hoc provisioning profile containing the target iPhone/iPad UDIDs.
- `APPLE_TEAM_ID`: Apple Developer Team ID.
- `APPLE_PROFILE_NAME`: provisioning profile name.
- `IOS_BUNDLE_ID`: bundle identifier registered to that Apple Developer account and profile.

When the iOS signing secrets are absent, the workflow reports that the signed IPA was skipped. Actions publish successful builds as downloadable artifacts; GitHub does not copy them onto the Desktop automatically.

The game opens from the bundled web assets. Online rooms use the `/party` WebSocket endpoint; publish the updated repository `server` before expecting public multiplayer to work.
