/**
 * useAuth Hook
 * 
 * React hook for authentication in desktop app
 * Provides waiter and manager authentication with PIN
 */

import { useState, useEffect, useCallback } from 'react';
import { app } from '../firebase/config';
import AuthService from '../firebase/authService';

// Create singleton auth service instance
let authServiceInstance = null;

const getAuthService = () => {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService(app);
  }
  return authServiceInstance;
};

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const authService = getAuthService();

  // Initialize auth state
  useEffect(() => {
    const { user, type } = authService.getCurrentUser();
    setCurrentUser(user);
    setUserType(type);
  }, []);

  /**
   * Authenticate waiter with PIN
   */
  const loginWaiter = useCallback(async (pin) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.authenticateWaiter(pin);
      
      if (result.success) {
        setCurrentUser(result.waiter);
        setUserType('waiter');
        return { success: true, user: result.waiter };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [authService]);

  /**
   * Authenticate manager with PIN
   */
  const loginManager = useCallback(async (pin) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.authenticateManager(pin);
      
      if (result.success) {
        setCurrentUser(result.manager);
        setUserType('manager');
        return { success: true, user: result.manager };
      } else {
        setError(result.error);
        return { 
          success: false, 
          error: result.error,
          attemptsRemaining: result.attemptsRemaining
        };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [authService]);

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.logout();
      
      if (result.success) {
        setCurrentUser(null);
        setUserType(null);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [authService]);

  /**
   * Prompt for manager PIN authentication
   * Used for protected operations like inventory movements
   */
  const promptManagerAuth = useCallback(async (onSuccess, onCancel) => {
    // This will be implemented in the UI component
    // Returns a promise that resolves when manager authenticates
    return new Promise((resolve, reject) => {
      // UI component will handle the PIN prompt dialog
      // and call resolve with manager data or reject on cancel
      if (onSuccess) onSuccess(resolve);
      if (onCancel) onCancel(reject);
    });
  }, []);

  return {
    // State
    currentUser,
    userType,
    loading,
    error,
    
    // Computed
    isAuthenticated: currentUser !== null,
    isWaiter: userType === 'waiter',
    isManager: userType === 'manager',
    
    // Methods
    loginWaiter,
    loginManager,
    logout,
    promptManagerAuth,
    
    // Auth service instance (for advanced usage)
    authService
  };
};

export default useAuth;
