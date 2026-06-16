# Android (Capacitor) wrapper — build guide

The game is a self-contained static web app (`index.html` at root, all assets local,
**zero external network requests** except the optional Yandex SDK which only loads
inside Yandex). It wraps cleanly into an Android APK with **Capacitor** — no code
changes, no ads/IAP (monetization deferred). The web build, the Yandex build, and the
Android build are the **same files**; platform features are abstracted and guarded.

## What's already wired for Android
- **Portrait + safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)` throughout;
  the page is fully overflow-locked (no scroll/pull-to-refresh).
- **Hardware BACK button:** `js/main.js` listens for Capacitor's `App.backButton` and
  calls `GAME_UI.back()` — closes a tooltip/modal, else returns to the Lab tab, else
  exits the app. No-op on plain web/Yandex.
- **Status bar:** dark style set via the StatusBar plugin when present.
- **Local save:** `localStorage` in the WebView (works offline; offline-earnings on load).
- **Haptics:** uses the Web Vibration API (works in the Android WebView); Settings toggle.
- `capacitor.config.json` is included (appId `com.singularityinc.game`, `webDir: "."`).

## Prerequisites (install on the build machine)
- Node.js 18+, JDK 17, Android Studio + Android SDK (API 34), Gradle (bundled with Studio).
- If the Android SDK is **not** installed, do the npm/`cap add` steps now; you only need
  Android Studio at the `cap open android` / build step.

## Build steps
```bash
cd singularity-inc

# 1. one-time project scaffolding
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/status-bar @capacitor/splash-screen
npx cap init "Singularity Inc." com.singularityinc.game --web-dir=.

# (capacitor.config.json in this folder already has the right settings — keep it)

# 2. add the Android platform (copies the web files in)
npx cap add android
npx cap sync android

# 3a. open in Android Studio to run on a device / build a signed bundle
npx cap open android
#    Build > Generate Signed Bundle/APK  (create a keystore for Play upload)

# 3b. OR command-line debug APK:
cd android && ./gradlew assembleDebug
#    -> android/app/build/outputs/apk/debug/app-debug.apk

# After any web change: re-copy and re-sync
npx cap copy android   # (or: npx cap sync android)
```

## Play Store notes
- Lock orientation to **portrait** in `android/app/src/main/AndroidManifest.xml`
  (`android:screenReadable`/`android:screenOrientation="portrait"` on the main activity).
- Target the latest required `targetSdkVersion`; provide the 512×512 icon (already in
  `icon-512.png`) and a feature graphic (the cover in `cover-800x470.png` can be adapted).
- No special permissions are required (no network, no location). `VIBRATE` is requested
  automatically by the haptics usage; that's the only one.

## Keeping web + Yandex builds intact
Nothing here is Android-only at load time — `window.Capacitor` is feature-detected and
all Capacitor calls are guarded in `try/catch`. The exact same `dist/singularity-inc.zip`
still works as a plain-web and Yandex Games build.
