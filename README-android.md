Vision — Build a local Android APK (Beginner-friendly)

This guide takes you from a fresh machine to a local APK you can sideload onto your Android phone.

1) Install prerequisites (one-time)
 - Install Node.js (recommend LTS) and npm: https://nodejs.org
 - Install Android Studio: https://developer.android.com/studio
   - When you first open Android Studio it will prompt to install the Android SDK and command-line tools; accept those defaults.
 - Make sure Android Studio's SDK Manager has the Android SDK Platform for a recent Android (e.g., API 33+) and "Android SDK Build-Tools" installed.

2) Prepare the web app
 - Open a terminal in the project folder:
 ```bash
 cd '/home/josia/Desktop/Planning app'
 npm install
 ```
 - Generate app icons (this will create `public/icons/icon-*.png` used by the manifest):
 ```bash
 npm run icons:generate
 ```
 - Build the production web bundle:
 ```bash
 npm run build
 ```

3) Initialize Capacitor and add Android (only once)
 - Initialize Capacitor (creates native project files):
 ```bash
 npm run cap:init
 ```
 - Add Android platform:
 ```bash
 npm run cap:add-android
 ```

4) Copy web assets into native project (do this after every `npm run build`)
 ```bash
 npm run cap:copy
 ```

5) Open the Android project in Android Studio
 - Run:
 ```bash
 npm run cap:open-android
 ```
 - Android Studio will open. Let it sync Gradle (it may download dependencies).

6) Build an APK (in Android Studio)
 - In Android Studio top menu: Build → Build Bundle(s) / APK(s) → Build APK(s).
 - Wait for the build to complete. Android Studio will show a link to the generated APK (usually under `android/app/build/outputs/apk/debug/app-debug.apk`).

7) Install the APK on your phone
 - Enable developer options and USB debugging on your Android device.
 - Connect the device via USB and allow the debug permission.
 - From the terminal you can install the APK using adb (comes with Android SDK):
 ```bash
 adb install -r android/app/build/outputs/apk/debug/app-debug.apk
 ```
 - Or copy the APK to the phone and open it with a file manager to install (you might need to enable "Install unknown apps").

Troubleshooting & tips
 - If you see Gradle sync or build errors, open the "Build" window in Android Studio — it shows exact failure messages.
 - For release-signed APKs (to distribute), follow the Android Studio docs on app signing and configure `signingConfigs` in `android/app/build.gradle`.
 - The Capacitor webview will run your built app; IndexedDB (Dexie) and service worker (PWA caching) should work on modern Android WebView versions.

If you'd like, I can also:
 - Generate properly sized splash images for Android and wire them into the native project resources.
 - Add a simple script to automate `build && cap:copy && cap:open-android`.

Extra: Adding splash screens and copy resources into Android project
 - Generate splash images (portrait):
 ```bash
 npm run generate-splash
 ```
 - Copy icons and splash images into the Android project (run after you added the Android platform):
 ```bash
 npm run cap:copy
 node ./scripts/copy-resources.mjs
 ```

Signing release APKs (short guide)
 - To distribute outside debug mode you should sign the APK. Android Studio can generate signed APKs, but here are the manual steps:
   1. Create a signing key with keytool (JDK):
      ```bash
      keytool -genkey -v -keystore ~/.android/vision-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias vision_key
      ```
   2. Configure Gradle signing in `android/app/build.gradle` (example):
      ```groovy
      android {
        signingConfigs {
          release {
            storeFile file(System.getenv('VISION_KEYSTORE') ?: '/home/username/.android/vision-release-key.jks')
            storePassword System.getenv('VISION_KEYSTORE_PASSWORD') ?: 'your-store-password'
            keyAlias System.getenv('VISION_KEY_ALIAS') ?: 'vision_key'
            keyPassword System.getenv('VISION_KEY_PASSWORD') ?: 'your-key-password'
          }
        }
        buildTypes {
          release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
          }
        }
      }
      ```
   3. Build a release APK in Android Studio (Build -> Generate Signed Bundle / APK) or via Gradle:
      ```bash
      cd android
      ./gradlew assembleRelease
      ```
   4. The signed release APK will be under `android/app/build/outputs/apk/release`.

Be careful to keep your keystore safe—if lost you cannot update apps signed with that key.
