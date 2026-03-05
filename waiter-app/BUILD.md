# Building WaiterFlow Mobile App

This guide covers building the WaiterFlow mobile app for Android devices.

## Prerequisites

- Node.js 18+ installed
- Expo CLI installed: `npm install -g expo-cli`
- EAS CLI installed: `npm install -g eas-cli`
- Expo account (free): https://expo.dev/signup

## Android Build Configuration

### Minimum Requirements

- **Minimum SDK Version:** API 21 (Android 5.0 Lollipop)
- **Target SDK Version:** API 34 (Android 14)
- **Compile SDK Version:** API 34

### Permissions

The app requires the following Android permissions:

- `INTERNET` - For Firebase and network communication
- `ACCESS_NETWORK_STATE` - To detect network connectivity
- `ACCESS_WIFI_STATE` - To monitor WiFi status
- `WRITE_EXTERNAL_STORAGE` - For SQLite database storage
- `READ_EXTERNAL_STORAGE` - For reading cached data

These permissions are automatically configured in `app.json`.

## Development Build

### Option 1: Expo Go (Quick Testing)

For quick testing without building:

```bash
npm start
```

Then scan the QR code with Expo Go app on your Android device.

**Limitations:**
- Cannot test native modules fully
- Limited offline functionality testing
- Not suitable for production

### Option 2: Development Build (Recommended)

Build a development APK with full native module support:

```bash
# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build development APK
eas build --profile development --platform android
```

Install the APK on your device and use it with Expo Dev Client.

## Production Build

### Step 1: Update Version

Update version in `app.json`:

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

**Version Code Rules:**
- Increment `versionCode` for each new build
- Update `version` for user-facing releases (e.g., "1.0.1")

### Step 2: Build APK

Build a production APK:

```bash
eas build --profile production --platform android
```

This will:
1. Upload your code to Expo servers
2. Build the APK in the cloud
3. Provide a download link when complete

### Step 3: Download and Test

1. Download the APK from the provided link
2. Transfer to Android device
3. Install and test thoroughly
4. Verify all features work (especially offline mode)

## Local Build (Advanced)

To build locally without EAS:

### Prerequisites

- Android Studio installed
- Android SDK configured
- Java JDK 17+ installed

### Steps

1. Generate native Android project:
   ```bash
   npx expo prebuild --platform android
   ```

2. Build with Gradle:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

3. Find APK at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

## App Signing

### Development Signing

Expo handles signing automatically for development builds.

### Production Signing

For production, you need a keystore:

1. Generate keystore:
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore waiterflow.keystore \
     -alias waiterflow -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure in `eas.json`:
   ```json
   {
     "build": {
       "production": {
         "android": {
           "buildType": "apk",
           "credentialsSource": "local"
         }
       }
     }
   }
   ```

3. Upload keystore to EAS:
   ```bash
   eas credentials
   ```

**Important:** Keep your keystore secure! Losing it means you can't update your app.

## Distribution

### Internal Testing

1. Build preview APK:
   ```bash
   eas build --profile preview --platform android
   ```

2. Share download link with testers
3. Testers install APK directly

### Google Play Store (Future)

1. Create Google Play Developer account ($25 one-time fee)
2. Build production APK with signing
3. Upload to Play Console
4. Complete store listing
5. Submit for review

## Build Profiles

### Development Profile

```json
{
  "development": {
    "developmentClient": true,
    "distribution": "internal"
  }
}
```

- Includes dev tools
- Faster builds
- Larger APK size

### Preview Profile

```json
{
  "preview": {
    "distribution": "internal",
    "android": {
      "buildType": "apk"
    }
  }
}
```

- Production-like build
- Internal distribution
- Smaller APK size

### Production Profile

```json
{
  "production": {
    "android": {
      "buildType": "apk"
    }
  }
}
```

- Optimized for production
- Smallest APK size
- No dev tools

## Troubleshooting

### Build Failed: "Gradle build failed"

**Solution:**
1. Check `app.json` for syntax errors
2. Verify all dependencies are compatible
3. Clear Expo cache: `expo start -c`
4. Try building again

### Build Failed: "Out of memory"

**Solution:**
1. Use EAS cloud builds (recommended)
2. Or increase local Gradle memory:
   ```
   # android/gradle.properties
   org.gradle.jvmargs=-Xmx4096m
   ```

### APK won't install on device

**Possible causes:**
1. Device doesn't meet minimum SDK (API 21+)
2. Conflicting app already installed
3. Unknown sources not enabled

**Solution:**
1. Check device Android version (must be 5.0+)
2. Uninstall old version first
3. Enable "Install from unknown sources" in device settings

### App crashes on startup

**Check:**
1. Firebase configuration in `.env`
2. All required permissions granted
3. Device has internet connection
4. Check device logs: `adb logcat`

## Build Optimization

### Reduce APK Size

1. Enable ProGuard (minification):
   ```json
   {
     "android": {
       "enableProguardInReleaseBuilds": true
     }
   }
   ```

2. Remove unused assets
3. Optimize images
4. Use vector icons instead of PNGs

### Improve Build Speed

1. Use EAS cloud builds (parallel builds)
2. Cache dependencies
3. Use incremental builds during development

## Testing Builds

### Before Distribution

Test checklist:
- ✅ App launches successfully
- ✅ Waiter can login with PIN
- ✅ Tables load and display correctly
- ✅ Menu items are visible
- ✅ Orders can be created
- ✅ Offline mode works (turn off WiFi)
- ✅ Sync works when back online
- ✅ App doesn't crash during normal use

### Device Testing

Test on multiple devices:
- Different Android versions (5.0, 8.0, 11, 14)
- Different screen sizes (small, medium, large)
- Different manufacturers (Samsung, Xiaomi, OnePlus)

## Continuous Integration

### GitHub Actions (Future)

Automate builds with GitHub Actions:

```yaml
name: Build Android APK
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: eas build --platform android --non-interactive
```

## Support

For build issues:
- Check [Expo Documentation](https://docs.expo.dev)
- Review [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- Contact development team

---

**Build Configuration Complete!** 🎉

Your app is ready to be built for Android devices with API 21+ support.
