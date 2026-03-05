# Firebase Setup for WaiterFlow Mobile App

## Prerequisites

Before setting up Firebase for the mobile app, ensure you have:
1. Completed Firebase project setup (see main project's `FIREBASE_SETUP.md`)
2. Firebase project created and configured
3. Firestore database enabled
4. Firebase Authentication enabled

## Step 1: Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your WaiterFlow project
3. Click the gear icon ⚙️ → **Project settings**
4. Scroll down to **Your apps** section
5. If you haven't added a web app for mobile yet:
   - Click **Add app** → Select Web icon `</>`
   - App nickname: "WaiterFlow Mobile"
   - Click **Register app**
6. Copy the Firebase configuration object

## Step 2: Create Environment File

1. Navigate to the `waiter-app` directory:
   ```bash
   cd waiter-app
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and fill in your Firebase credentials:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
   ```

   **Important:** Use the same Firebase project as the desktop app!

## Step 3: Verify Configuration

1. Start the Expo development server:
   ```bash
   npm start
   ```

2. The app will automatically test the Firebase connection on startup
3. Check the console for connection status:
   ```
   ✅ Firebase app initialized
   ✅ Firestore initialized with offline persistence
   ✅ Firebase Auth initialized
   ```

## Step 4: Test Firebase Connection

You can manually test the connection by importing the test utility:

```typescript
import { testFirebaseConnection } from './src/utils/testFirebaseConnection';

// Test connection
const result = await testFirebaseConnection();
console.log(result);
```

Expected output:
```json
{
  "success": true,
  "message": "Firebase connection successful",
  "details": {
    "firestoreConnected": true,
    "collectionsAccessible": true,
    "offlinePersistenceEnabled": true
  }
}
```

## Offline Persistence

The mobile app is configured with **offline persistence enabled** by default. This means:

- ✅ Data is cached locally on the device
- ✅ Queries work offline using cached data
- ✅ Writes are queued when offline and synced when online
- ✅ Real-time listeners continue to work with cached data

### How Offline Persistence Works

1. **First Load (Online):**
   - App fetches data from Firestore
   - Data is cached locally
   - Real-time listeners established

2. **Offline Mode:**
   - App uses cached data
   - Writes are queued locally
   - UI shows offline indicator

3. **Back Online:**
   - Queued writes are automatically synced
   - Real-time listeners resume
   - UI shows connected status

## Firestore Security Rules

Ensure your Firestore security rules allow mobile app access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Note:** These are development rules. Update for production!

## Troubleshooting

### Error: "Missing Firebase configuration keys"

**Solution:** Check your `.env` file and ensure all variables are set:
```bash
cat .env
```

All `EXPO_PUBLIC_FIREBASE_*` variables must have values.

### Error: "Permission denied"

**Possible causes:**
1. Firestore security rules are too restrictive
2. User is not authenticated
3. Network connectivity issues

**Solution:**
1. Check Firestore security rules in Firebase Console
2. Verify authentication is working
3. Check network connection

### Error: "Firestore has already been initialized"

**Solution:** This is normal if you're hot-reloading during development. Restart the Expo server:
```bash
expo start -c
```

### Offline persistence not working

**Check:**
1. Verify offline persistence is enabled in `src/services/firebase.ts`
2. Check device storage (offline cache requires storage space)
3. Test by turning off network and checking if cached data loads

## Environment Variables

The mobile app uses Expo's environment variable system:

- **Prefix:** All Firebase variables must start with `EXPO_PUBLIC_`
- **Access:** Variables are available via `process.env.EXPO_PUBLIC_*`
- **Security:** These variables are embedded in the app bundle (not secret!)

**Important:** Never put sensitive keys (like service account keys) in `.env`!

## Next Steps

After Firebase is configured:
1. ✅ Test waiter authentication (Task 3.4)
2. ✅ Implement table selection (Task 3.5)
3. ✅ Build menu browser (Task 3.6)
4. ✅ Create order entry screen (Task 3.7)

## Support

For Firebase-related issues:
- Check [Firebase Documentation](https://firebase.google.com/docs)
- Review [Expo Firebase Guide](https://docs.expo.dev/guides/using-firebase/)
- Contact the development team

## Security Notes

⚠️ **Important Security Reminders:**

1. Never commit `.env` to version control
2. API keys in `.env` are safe for client apps (they're not secret)
3. Use Firestore security rules to protect data
4. Enable App Check for production (prevents unauthorized access)
5. Monitor Firebase usage in console to detect abuse

---

**Setup Complete!** 🎉

Your mobile app is now connected to Firebase with offline persistence enabled.
