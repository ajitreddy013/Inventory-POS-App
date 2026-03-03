import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { Lock, X, AlertTriangle } from 'lucide-react';
import './ManagerPinPrompt.css';

const ManagerPinPrompt = ({ isOpen, onClose, onSuccess, title = 'Manager Authentication Required' }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  const LOCKOUT_KEY = 'manager_lockout_until';

  // Check lockout status on mount
  useEffect(() => {
    const storedLockout = localStorage.getItem(LOCKOUT_KEY);
    if (storedLockout) {
      const lockoutTime = parseInt(storedLockout, 10);
      const now = Date.now();
      if (lockoutTime > now) {
        setLockoutUntil(lockoutTime);
        setRemainingTime(Math.ceil((lockoutTime - now) / 1000));
      } else {
        // Lockout expired, clear it
        localStorage.removeItem(LOCKOUT_KEY);
      }
    }
  }, []);

  // Update remaining time countdown
  useEffect(() => {
    if (lockoutUntil && remainingTime > 0) {
      const timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((lockoutUntil - now) / 1000);
        if (remaining <= 0) {
          // Lockout expired
          setLockoutUntil(null);
          setRemainingTime(0);
          setFailedAttempts(0);
          localStorage.removeItem(LOCKOUT_KEY);
        } else {
          setRemainingTime(remaining);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [lockoutUntil, remainingTime]);

  // Handle modal visibility animation
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setIsAuthenticating(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      setPin('');
      setError('');
      onClose();
    }, 200);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAuthenticate = async () => {
    // Check if locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Account locked. Try again in ${formatTime(remainingTime)}`);
      return;
    }

    // Validate PIN format
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits');
      return;
    }

    setIsAuthenticating(true);
    setError('');

    try {
      // Call the IPC handler to authenticate
      const result = await window.electronAPI.invoke('firebase:authenticate-manager', pin);

      if (result.success) {
        // Success - reset attempts and call onSuccess
        setFailedAttempts(0);
        localStorage.removeItem(LOCKOUT_KEY);
        setPin('');
        onSuccess(result.manager);
        handleClose();
      } else {
        // Failed authentication
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          // Lock out for 5 minutes
          const lockoutTime = Date.now() + LOCKOUT_DURATION;
          setLockoutUntil(lockoutTime);
          setRemainingTime(LOCKOUT_DURATION / 1000);
          localStorage.setItem(LOCKOUT_KEY, lockoutTime.toString());
          setError('Too many failed attempts. Account locked for 5 minutes.');
          setPin('');
        } else {
          const attemptsRemaining = MAX_ATTEMPTS - newAttempts;
          setError(`Invalid PIN. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`);
          setPin('');
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 6) {
      setPin(value);
      setError('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && pin.length >= 4 && !isAuthenticating && !lockoutUntil) {
      handleAuthenticate();
    }
  };

  if (!isOpen) return null;

  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;
  const attemptsRemaining = MAX_ATTEMPTS - failedAttempts;

  const modalContent = (
    <div 
      className={`manager-pin-overlay ${isVisible ? 'visible' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`manager-pin-modal ${isVisible ? 'visible' : ''}`}>
        <div className="manager-pin-header">
          <div className="header-icon">
            <Lock size={24} />
          </div>
          <h3>{title}</h3>
          <button 
            onClick={handleClose} 
            className="close-btn"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="manager-pin-content">
          {isLockedOut ? (
            <div className="lockout-message">
              <AlertTriangle size={48} className="lockout-icon" />
              <h4>Account Locked</h4>
              <p>Too many failed attempts. Please try again in:</p>
              <div className="lockout-timer">{formatTime(remainingTime)}</div>
            </div>
          ) : (
            <>
              <div className="pin-input-group">
                <label htmlFor="managerPin">Enter Manager PIN</label>
                <input
                  id="managerPin"
                  type="password"
                  value={pin}
                  onChange={handlePinChange}
                  onKeyPress={handleKeyPress}
                  placeholder="4-6 digits"
                  maxLength={6}
                  className={`pin-input ${error ? 'error' : ''}`}
                  autoFocus
                  disabled={isAuthenticating}
                />
                <div className="pin-dots">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="error-message">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {!error && failedAttempts > 0 && attemptsRemaining > 0 && (
                <div className="attempts-remaining">
                  {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                </div>
              )}
            </>
          )}
        </div>

        <div className="manager-pin-actions">
          {!isLockedOut && (
            <button 
              onClick={handleAuthenticate} 
              className="btn btn-primary"
              disabled={pin.length < 4 || isAuthenticating}
            >
              {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
            </button>
          )}
          <button 
            onClick={handleClose} 
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

ManagerPinPrompt.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  title: PropTypes.string
};

export default ManagerPinPrompt;
