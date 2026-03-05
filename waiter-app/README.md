# WaiterFlow Mobile App

React Native mobile application for restaurant waiters to take orders on Android devices.

## Features

- **Waiter Authentication**: PIN-based login for waiters
- **Table Selection**: View and select tables with real-time status
- **Menu Browsing**: Browse menu items with search and category filters
- **Order Entry**: Create orders with modifiers (spice levels, paid add-ons)
- **Offline Support**: Take orders when WiFi is down, auto-sync when reconnected
- **Real-time Sync**: Orders sync in real-time with desktop POS and kitchen printers

## Tech Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Firebase Firestore** for real-time cloud synchronization
- **SQLite** for local offline storage
- **React Navigation** for screen management
- **NetInfo** for network monitoring

## Project Structure

```
waiter-app/
├── src/
│   ├── components/     # Reusable UI components
│   ├── screens/        # Screen components
│   ├── services/       # Business logic and API services
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript type definitions
├── assets/             # Images, fonts, and other assets
├── App.tsx             # Root component
└── app.json            # Expo configuration
```

## Setup

### Prerequisites

- Node.js 18+ installed
- Expo CLI installed globally: `npm install -g expo-cli`
- Android device or emulator for testing

### Installation

1. Navigate to the mobile app directory:
   ```bash
   cd waiter-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file with Firebase configuration:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

### Running the App

**Development Mode:**
```bash
npm start
```

**Android:**
```bash
npm run android
```

**iOS (Mac only):**
```bash
npm run ios
```

**Web:**
```bash
npm run web
```

## Building for Production

### Android APK

1. Configure app signing in `app.json`
2. Build the APK:
   ```bash
   eas build --platform android --profile production
   ```

### Minimum Requirements

- Android API Level 21+ (Android 5.0 Lollipop)
- 2GB RAM minimum
- Network connectivity (WiFi or mobile data)

## Development Guidelines

### Code Style

- Use TypeScript for all new files
- Follow React Native best practices
- Use functional components with hooks
- Keep components small and focused

### Testing

Run tests:
```bash
npm test
```

### Linting

Check code quality:
```bash
npm run lint
```

## Offline Functionality

The app supports full offline operation:

1. **Offline Order Creation**: Create orders when network is unavailable
2. **Local Storage**: Orders stored in SQLite database
3. **Auto-Sync**: Automatic synchronization when network is restored
4. **Sync Status**: Visual indicator showing connection status

## Troubleshooting

### App won't start
- Clear Expo cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Firebase connection issues
- Verify `.env` file has correct Firebase credentials
- Check Firebase project settings in console

### Sync not working
- Check network connectivity
- Verify Firestore security rules allow read/write
- Check Firebase Console for errors

## Support

For issues or questions, contact the development team.

## License

Proprietary - All rights reserved
