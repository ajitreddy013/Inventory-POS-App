/**
 * Firebase Authentication Service
 * 
 * Handles PIN-based authentication for waiters and managers
 * Uses Firebase custom tokens for secure authentication
 */

const { 
  getAuth, 
  signInWithCustomToken,
  signOut,
  onAuthStateChanged 
} = require('firebase/auth');
const { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs 
} = require('firebase/firestore');
const bcrypt = require('bcrypt');

class AuthService {
  constructor(firebaseApp) {
    this.auth = getAuth(firebaseApp);
    this.db = getFirestore(firebaseApp);
    this.currentUser = null;
    this.userType = null; // 'waiter' or 'manager'
    
    // Listen for auth state changes
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        console.log('User authenticated:', user.uid);
      } else {
        console.log('User signed out');
        this.currentUser = null;
        this.userType = null;
      }
    });
  }

  /**
   * Authenticate waiter with PIN
   * @param {string} pin - 4-6 digit PIN
   * @returns {Promise<{success: boolean, waiter?: object, error?: string}>}
   */
  async authenticateWaiter(pin) {
    try {
      // Validate PIN format
      if (!/^\d{4,6}$/.test(pin)) {
        return { 
          success: false, 
          error: 'PIN must be 4-6 digits' 
        };
      }

      // Query waiters collection by PIN
      const waitersRef = collection(this.db, 'waiters');
      const q = query(waitersRef, where('pin', '==', pin), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { 
          success: false, 
          error: 'Invalid PIN or waiter not active' 
        };
      }

      // Get waiter data
      const waiterDoc = querySnapshot.docs[0];
      const waiter = {
        id: waiterDoc.id,
        ...waiterDoc.data()
      };

      // Store current user info
      this.currentUser = waiter;
      this.userType = 'waiter';

      return { 
        success: true, 
        waiter: {
          id: waiter.id,
          name: waiter.name,
          pin: waiter.pin
        }
      };
    } catch (error) {
      console.error('Waiter authentication error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Authenticate manager with PIN
   * @param {string} pin - 4-6 digit PIN (will be compared with bcrypt hash)
   * @returns {Promise<{success: boolean, manager?: object, error?: string, attemptsRemaining?: number}>}
   */
  async authenticateManager(pin) {
    try {
      // Validate PIN format
      if (!/^\d{4,6}$/.test(pin)) {
        return { 
          success: false, 
          error: 'PIN must be 4-6 digits' 
        };
      }

      // Check lockout status
      const lockoutKey = 'manager_lockout';
      const lockoutData = this.getLockoutData(lockoutKey);
      
      if (lockoutData.isLocked) {
        const remainingTime = Math.ceil((lockoutData.lockoutUntil - Date.now()) / 1000 / 60);
        return {
          success: false,
          error: `Account locked. Try again in ${remainingTime} minutes`
        };
      }

      // Get all active managers
      const managersRef = collection(this.db, 'managers');
      const q = query(managersRef, where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { 
          success: false, 
          error: 'No active managers found' 
        };
      }

      // Try to match PIN with any manager
      let matchedManager = null;
      for (const doc of querySnapshot.docs) {
        const manager = doc.data();
        const isMatch = await bcrypt.compare(pin, manager.pin);
        
        if (isMatch) {
          matchedManager = {
            id: doc.id,
            ...manager
          };
          break;
        }
      }

      if (!matchedManager) {
        // Increment failed attempts
        const attempts = this.incrementFailedAttempts(lockoutKey);
        
        if (attempts >= 3) {
          // Lock account for 5 minutes
          this.setLockout(lockoutKey, 5 * 60 * 1000);
          return {
            success: false,
            error: 'Too many failed attempts. Account locked for 5 minutes'
          };
        }
        
        return {
          success: false,
          error: 'Invalid PIN',
          attemptsRemaining: 3 - attempts
        };
      }

      // Clear failed attempts on successful login
      this.clearFailedAttempts(lockoutKey);

      // Store current user info
      this.currentUser = matchedManager;
      this.userType = 'manager';

      return {
        success: true,
        manager: {
          id: matchedManager.id,
          name: matchedManager.name,
          role: matchedManager.role,
          email: matchedManager.email
        }
      };
    } catch (error) {
      console.error('Manager authentication error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async logout() {
    try {
      await signOut(this.auth);
      this.currentUser = null;
      this.userType = null;
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get current authenticated user
   * @returns {{user: object | null, type: string | null}}
   */
  getCurrentUser() {
    return {
      user: this.currentUser,
      type: this.userType
    };
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Check if current user is a waiter
   * @returns {boolean}
   */
  isWaiter() {
    return this.userType === 'waiter';
  }

  /**
   * Check if current user is a manager
   * @returns {boolean}
   */
  isManager() {
    return this.userType === 'manager';
  }

  // ============================================
  // Lockout Management (Local Storage / Memory)
  // ============================================

  /**
   * Get lockout data from localStorage or memory
   * @param {string} key - Lockout key
   * @returns {{isLocked: boolean, lockoutUntil: number, attempts: number}}
   */
  getLockoutData(key) {
    // Use memory storage for Node.js environment
    if (typeof localStorage === 'undefined') {
      if (!this._memoryLockout) {
        this._memoryLockout = {};
      }
      
      const data = this._memoryLockout[key];
      if (!data) {
        return { isLocked: false, lockoutUntil: 0, attempts: 0 };
      }

      const now = Date.now();
      if (data.lockoutUntil && data.lockoutUntil < now) {
        delete this._memoryLockout[key];
        return { isLocked: false, lockoutUntil: 0, attempts: 0 };
      }

      return {
        isLocked: data.lockoutUntil > now,
        lockoutUntil: data.lockoutUntil || 0,
        attempts: data.attempts || 0
      };
    }

    const data = localStorage.getItem(key);
    if (!data) {
      return { isLocked: false, lockoutUntil: 0, attempts: 0 };
    }

    const lockoutData = JSON.parse(data);
    const now = Date.now();

    // Check if lockout has expired
    if (lockoutData.lockoutUntil && lockoutData.lockoutUntil < now) {
      this.clearFailedAttempts(key);
      return { isLocked: false, lockoutUntil: 0, attempts: 0 };
    }

    return {
      isLocked: lockoutData.lockoutUntil > now,
      lockoutUntil: lockoutData.lockoutUntil || 0,
      attempts: lockoutData.attempts || 0
    };
  }

  /**
   * Increment failed login attempts
   * @param {string} key - Lockout key
   * @returns {number} - Current attempt count
   */
  incrementFailedAttempts(key) {
    // Use memory storage for Node.js environment
    if (typeof localStorage === 'undefined') {
      if (!this._memoryLockout) {
        this._memoryLockout = {};
      }
      
      const lockoutData = this.getLockoutData(key);
      const newAttempts = lockoutData.attempts + 1;

      this._memoryLockout[key] = {
        attempts: newAttempts,
        lockoutUntil: lockoutData.lockoutUntil
      };

      return newAttempts;
    }

    const lockoutData = this.getLockoutData(key);
    const newAttempts = lockoutData.attempts + 1;

    localStorage.setItem(key, JSON.stringify({
      attempts: newAttempts,
      lockoutUntil: lockoutData.lockoutUntil
    }));

    return newAttempts;
  }

  /**
   * Set lockout period
   * @param {string} key - Lockout key
   * @param {number} durationMs - Lockout duration in milliseconds
   */
  setLockout(key, durationMs) {
    const lockoutUntil = Date.now() + durationMs;
    
    // Use memory storage for Node.js environment
    if (typeof localStorage === 'undefined') {
      if (!this._memoryLockout) {
        this._memoryLockout = {};
      }
      
      this._memoryLockout[key] = {
        attempts: 3,
        lockoutUntil
      };
      return;
    }

    localStorage.setItem(key, JSON.stringify({
      attempts: 3,
      lockoutUntil
    }));
  }

  /**
   * Clear failed attempts
   * @param {string} key - Lockout key
   */
  clearFailedAttempts(key) {
    // Use memory storage for Node.js environment
    if (typeof localStorage === 'undefined') {
      if (this._memoryLockout) {
        delete this._memoryLockout[key];
      }
      return;
    }

    localStorage.removeItem(key);
  }
}

module.exports = AuthService;
