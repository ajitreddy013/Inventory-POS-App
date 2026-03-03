# Firebase Authentication System

This document describes the PIN-based authentication system for WaiterFlow.

## Overview

The authentication system supports two types of users:
- **Waiters**: Use 4-6 digit PINs for mobile app login
- **Managers**: Use 4-6 digit PINs (bcrypt hashed) for desktop app operations

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Authentication Flow                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  User enters PIN                                         │
│       ↓                                                  │
│  AuthService validates format (4-6 digits)               │
│       ↓                                                  │
│  Query Firestore for matching user                       │
│       ↓                                                  │
│  Waiter: Plain text comparison                           │
│  Manager: Bcrypt hash comparison                         │
│       ↓                                                  │
│  Success: Store user session                             │
│  Failure: Increment failed attempts (managers only)      │
│       ↓                                                  │
│  3 failed attempts → 5 minute lockout (managers only)    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. AuthService (`src/firebase/authService.js`)

Core authentication service with methods:

**Waiter Authentication:**
```javascript
const result = await authService.authenticateWaiter('1234');
// Returns: { success: true, waiter: { id, name, pin } }
// Or: { success: false, error: 'Invalid PIN or waiter not active' }
```

**Manager Authentication:**
```javascript
const result = await authService.authenticateManager('123456');
// Returns: { success: true, manager: { id, name, role, email } }
// Or: { success: false, error: 'Invalid PIN', attemptsRemaining: 2 }
```

**Session Management:**
```javascript
// Get current user
const { user, type } = authService.getCurrentUser();

// Check authentication status
const isAuth = authService.isAuthenticated();
const isWaiter = authService.isWaiter();
const isManager = authService.isManager();

// Logout
await authService.logout();
```

### 2. useAuth Hook (`src/hooks/useAuth.js`)

React hook for desktop app:

```javascript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const {
    currentUser,
    userType,
    loading,
    error,
    isAuthenticated,
    isWaiter,
    isManager,
    loginWaiter,
    loginManager,
    logout
  } = useAuth();

  const handleWaiterLogin = async () => {
    const result = await loginWaiter('1234');
    if (result.success) {
      console.log('Logged in:', result.user.name);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {currentUser.name}!</p>
      ) : (
        <button onClick={handleWaiterLogin}>Login</button>
      )}
    </div>
  );
}
```

## Security Features

### Waiter Authentication

**Storage:**
- PINs stored as plain text in Firestore
- Acceptable for this use case (low security risk)
- Quick lookup and validation
- **Design Decision**: Waiter PINs are intentionally plain text for simplicity and performance. Waiters have limited privileges (order taking only) and PINs can be easily changed by managers if compromised.

**Validation:**
- PIN format: 4-6 digits
- Must be active waiter
- No lockout mechanism (low risk)

**Use Cases:**
- Mobile app login
- Order taking
- Table management

### Manager Authentication

**Storage:**
- PINs hashed with bcrypt (cost factor 10)
- Never stored or transmitted in plain text
- Secure against database breaches

**Validation:**
- PIN format: 4-6 digits
- Bcrypt comparison (secure)
- 3 failed attempts = 5 minute lockout
- Lockout stored in localStorage (browser) or memory (Node.js)

**Use Cases:**
- Inventory movements (godown to counter)
- Protected operations
- Sensitive data access

### Lockout Mechanism

**How it works:**
1. Failed login increments attempt counter
2. After 3 failed attempts, account locked for 5 minutes
3. Lockout timer stored locally (per device)
4. Successful login clears failed attempts
5. Lockout expires automatically after 5 minutes

**Implementation:**
```javascript
// Check lockout status
const lockoutData = authService.getLockoutData('manager_lockout');
if (lockoutData.isLocked) {
  console.log('Locked until:', new Date(lockoutData.lockoutUntil));
}

// Clear lockout (for testing)
authService.clearFailedAttempts('manager_lockout');
```

## Usage Examples

### Desktop App - Waiter Login

```javascript
import { useAuth } from '../hooks/useAuth';

function WaiterLogin() {
  const { loginWaiter, loading, error } = useAuth();
  const [pin, setPin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await loginWaiter(pin);
    
    if (result.success) {
      // Navigate to dashboard
      navigate('/dashboard');
    } else {
      alert(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Enter PIN"
        maxLength={6}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

### Desktop App - Manager PIN Prompt

```javascript
import { useAuth } from '../hooks/useAuth';

function InventoryMovement() {
  const { loginManager } = useAuth();
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const handleMoveStock = async () => {
    // Show PIN prompt
    setShowPinPrompt(true);
  };

  const handlePinSubmit = async (pin) => {
    const result = await loginManager(pin);
    
    if (result.success) {
      // Proceed with inventory movement
      await moveStockToCounter(itemId, quantity, result.user.id);
      setShowPinPrompt(false);
    } else {
      alert(result.error);
      if (result.attemptsRemaining !== undefined) {
        alert(`Attempts remaining: ${result.attemptsRemaining}`);
      }
    }
  };

  return (
    <div>
      <button onClick={handleMoveStock}>Move Stock to Counter</button>
      
      {showPinPrompt && (
        <PinPromptDialog
          onSubmit={handlePinSubmit}
          onCancel={() => setShowPinPrompt(false)}
        />
      )}
    </div>
  );
}
```

### Mobile App - Waiter Login (React Native)

```javascript
import AuthService from '../firebase/authService';
import { app } from '../firebase/config';

const authService = new AuthService(app);

function LoginScreen() {
  const [pin, setPin] = useState('');

  const handleLogin = async () => {
    const result = await authService.authenticateWaiter(pin);
    
    if (result.success) {
      // Store session
      await AsyncStorage.setItem('waiterId', result.waiter.id);
      await AsyncStorage.setItem('waiterName', result.waiter.name);
      
      // Navigate to table selection
      navigation.navigate('TableSelection');
    } else {
      Alert.alert('Login Failed', result.error);
    }
  };

  return (
    <View>
      <TextInput
        value={pin}
        onChangeText={setPin}
        keyboardType="numeric"
        maxLength={6}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
```

## Testing

### Run Authentication Tests

```bash
node src/firebase/testAuth.js
```

**Tests include:**
- ✅ Valid waiter PIN authentication
- ✅ Invalid waiter PIN rejection
- ✅ Invalid PIN format rejection
- ✅ Valid manager PIN authentication
- ✅ Invalid manager PIN rejection
- ✅ Lockout mechanism (3 failed attempts)
- ✅ Session management (login/logout)

### Manual Testing

**Test Waiter Login:**
```javascript
const authService = new AuthService(app);
const result = await authService.authenticateWaiter('1234');
console.log(result);
```

**Test Manager Login:**
```javascript
const authService = new AuthService(app);
const result = await authService.authenticateManager('123456');
console.log(result);
```

**Test Lockout:**
```javascript
// Try 3 wrong PINs
await authService.authenticateManager('000000');
await authService.authenticateManager('000000');
await authService.authenticateManager('000000');

// 4th attempt should be locked
const result = await authService.authenticateManager('123456');
console.log(result.error); // "Account locked. Try again in 5 minutes"
```

## Sample Data

### Waiters (from setupSchema.js)

| Name | PIN | Status |
|------|-----|--------|
| Amit Patel | 1234 | Active |
| Neha Singh | 5678 | Active |
| Vikram Reddy | 9012 | Active |
| Anita Desai | 3456 | Active |

### Managers (from setupSchema.js)

| Name | PIN | Role | Email |
|------|-----|------|-------|
| Rajesh Kumar | 123456 | Owner | rajesh@counterflow.com |
| Priya Sharma | 234567 | Manager | priya@counterflow.com |

**Note:** Manager PINs are bcrypt hashed in the database.

## Troubleshooting

### "Invalid PIN or waiter not active"
- Check if waiter exists in Firestore
- Verify waiter is active (`isActive: true`)
- Confirm PIN matches exactly

### "Account locked. Try again in X minutes"
- Wait for lockout period to expire
- Or clear lockout: `authService.clearFailedAttempts('manager_lockout')`

### "PIN must be 4-6 digits"
- Ensure PIN contains only digits
- Length must be between 4 and 6 characters

### Authentication works in tests but not in app
- Check Firebase config in `.env`
- Verify Firestore security rules are deployed
- Ensure collections exist in Firestore

## Best Practices

**For Developers:**
- Always use `useAuth` hook in React components
- Handle loading and error states
- Clear sensitive data on logout
- Test authentication flows thoroughly

**For Managers:**
- Use 6-digit PINs for better security
- Change PINs every 3 months
- Don't share PINs with staff
- Monitor failed login attempts

**For Waiters:**
- Memorize your PIN
- Don't write it down
- Logout when leaving device unattended
- Report lost/stolen device immediately

## Next Steps

After authentication is set up:
1. ✅ Test authentication with sample users
2. ✅ Verify lockout mechanism works
3. ⏳ Integrate with desktop app UI
4. ⏳ Implement mobile app login screen
5. ⏳ Add manager PIN prompt dialog
6. ⏳ Create waiter management UI (desktop)
7. ⏳ Add session persistence
