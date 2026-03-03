# Firebase Project Setup Guide

## Step 1: Create Firebase Account

1. Go to https://console.firebase.google.com
2. Sign in with your Google account
3. Click "Add project" or "Create a project"

## Step 2: Create Firebase Project

1. **Project Name**: Enter "WaiterFlow" (or your preferred name)
2. **Google Analytics**: 
   - Toggle OFF (not needed for this project)
   - Or keep ON if you want analytics
3. Click "Create project"
4. Wait for project creation (takes ~30 seconds)
5. Click "Continue" when ready

## Step 3: Enable Firestore Database

1. In the left sidebar, click "Build" → "Firestore Database"
2. Click "Create database"
3. **Security rules**: Select "Start in production mode"
   - We'll add custom rules later
4. **Location**: Choose closest to India:
   - Recommended: `asia-south1` (Mumbai)
   - Alternative: `asia-southeast1` (Singapore)
5. Click "Enable"
6. Wait for Firestore to be created

## Step 4: Enable Firebase Authentication

1. In the left sidebar, click "Build" → "Authentication"
2. Click "Get started"
3. Click on "Sign-in method" tab
4. Enable "Anonymous" authentication:
   - Click "Anonymous"
   - Toggle "Enable"
   - Click "Save"
5. We'll use custom tokens for waiter authentication

## Step 5: Get Firebase Configuration for Web

1. In the left sidebar, click the gear icon ⚙️ → "Project settings"
2. Scroll down to "Your apps" section
3. Click the Web icon `</>` (Add app)
4. **App nickname**: Enter "WaiterFlow Desktop"
5. **Firebase Hosting**: Leave unchecked
6. Click "Register app"
7. **Copy the Firebase configuration** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

8. **SAVE THIS CONFIGURATION** - you'll need it in Step 7
9. Click "Continue to console"

## Step 6: Add Another App for Mobile

1. Go back to "Project settings" → "Your apps"
2. Click "Add app" → Select Web icon `</>` again
3. **App nickname**: Enter "WaiterFlow Mobile"
4. Click "Register app"
5. You can use the same configuration for mobile
6. Click "Continue to console"

## Step 7: Create Environment Files

### For Desktop App:

Create `.env` file in project root:

```env
# Firebase Configuration (Desktop)
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

Replace the values with your actual Firebase config from Step 5.

### For Mobile App (when we create it):

Create `.env` file in mobile app folder:

```env
# Firebase Configuration (Mobile)
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 8: Get Service Account Key (for Admin SDK)

1. In Firebase Console, go to "Project settings" → "Service accounts"
2. Click "Generate new private key"
3. Click "Generate key" in the popup
4. A JSON file will download - **KEEP THIS SECURE!**
5. Rename it to `firebase-admin-key.json`
6. Place it in project root (we'll add to .gitignore)

## Step 9: Update .gitignore

Add these lines to `.gitignore`:

```
# Firebase
.env
firebase-admin-key.json
.firebase/
```

## Step 10: Verify Setup

1. Go to Firestore Database in Firebase Console
2. You should see an empty database
3. Go to Authentication
4. You should see "Anonymous" enabled
5. Go to Project settings
6. You should see 2 apps registered (Desktop and Mobile)

## Next Steps

After completing this setup:
1. Create the `.env` file with your credentials
2. Install Firebase packages: `npm install firebase firebase-admin`
3. Run the initialization script to create Firestore collections
4. Test the connection

## Security Notes

- ⚠️ Never commit `.env` or `firebase-admin-key.json` to git
- ⚠️ Keep your service account key secure
- ⚠️ We'll add proper security rules after testing
- ⚠️ The API key in `.env` is safe to use in client apps (it's not a secret)

## Troubleshooting

**Issue**: "Firebase: Error (auth/operation-not-allowed)"
- Solution: Make sure Anonymous auth is enabled in Authentication settings

**Issue**: "Permission denied" when writing to Firestore
- Solution: Temporarily set Firestore rules to test mode (we'll fix this later):
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
  ```

**Issue**: Can't find Firebase project
- Solution: Make sure you're signed in with the correct Google account

## Cost Monitoring

1. Go to "Usage and billing" in Firebase Console
2. Monitor your usage to stay within free tier:
   - Firestore: 50K reads/day, 20K writes/day
   - Storage: 1GB
3. Set up budget alerts if needed

---

**Setup Complete!** ✅

Once you have your Firebase credentials, proceed to Task 1.2 to set up the database schema.
