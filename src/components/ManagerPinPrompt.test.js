import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ManagerPinPrompt from './ManagerPinPrompt';

// Mock the electronAPI
const mockInvoke = jest.fn();
global.window.electronAPI = {
  invoke: mockInvoke
};

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('ManagerPinPrompt', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
    title: 'Manager Authentication Required'
  };

  describe('Rendering', () => {
    test('renders modal when isOpen is true', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      expect(screen.getByText('Manager Authentication Required')).toBeInTheDocument();
      expect(screen.getByLabelText('Enter Manager PIN')).toBeInTheDocument();
    });

    test('does not render when isOpen is false', () => {
      render(<ManagerPinPrompt {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Manager Authentication Required')).not.toBeInTheDocument();
    });

    test('renders with custom title', () => {
      render(<ManagerPinPrompt {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    test('renders PIN input field', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveAttribute('maxLength', '6');
    });

    test('renders authenticate and cancel buttons', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      expect(screen.getByText('Authenticate')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('PIN Input', () => {
    test('allows entering 4-6 digit PIN', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      
      fireEvent.change(input, { target: { value: '1234' } });
      expect(input.value).toBe('1234');
      
      fireEvent.change(input, { target: { value: '123456' } });
      expect(input.value).toBe('123456');
    });

    test('prevents entering more than 6 digits', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      
      fireEvent.change(input, { target: { value: '1234567' } });
      expect(input.value).toBe('123456');
    });

    test('only allows numeric input', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      
      fireEvent.change(input, { target: { value: 'abc123' } });
      expect(input.value).toBe('123');
    });

    test('updates PIN dots indicator', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      
      fireEvent.change(input, { target: { value: '123' } });
      
      const dots = document.querySelectorAll('.pin-dot.filled');
      expect(dots).toHaveLength(3);
    });

    test('clears error when typing', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      // Trigger error
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.click(button);
      
      expect(screen.getByText('PIN must be 4-6 digits')).toBeInTheDocument();
      
      // Type to clear error
      fireEvent.change(input, { target: { value: '1234' } });
      expect(screen.queryByText('PIN must be 4-6 digits')).not.toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    test('successful authentication calls onSuccess', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        manager: { id: 'mgr1', name: 'John Doe', role: 'manager' }
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('firebase:authenticate-manager', '1234');
        expect(mockOnSuccess).toHaveBeenCalledWith({
          id: 'mgr1',
          name: 'John Doe',
          role: 'manager'
        });
      });
    });

    test('failed authentication shows error and attempts remaining', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid PIN/)).toBeInTheDocument();
        expect(screen.getByText('2 attempts remaining')).toBeInTheDocument();
      });
    });

    test('validates PIN format before authentication', async () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('PIN must be 4-6 digits')).toBeInTheDocument();
      });
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('disables authenticate button when PIN is too short', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '123' } });
      expect(button).toBeDisabled();
      
      fireEvent.change(input, { target: { value: '1234' } });
      expect(button).not.toBeDisabled();
    });

    test('allows authentication with Enter key', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        manager: { id: 'mgr1', name: 'John Doe', role: 'manager' }
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('firebase:authenticate-manager', '1234');
      });
    });

    test('clears PIN after failed attempt', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('Lockout Mechanism', () => {
    test('locks out after 3 failed attempts', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      // First attempt
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText(/2 attempts remaining/)).toBeInTheDocument();
      });
      
      // Second attempt
      fireEvent.change(input, { target: { value: '5678' } });
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText(/1 attempt remaining/)).toBeInTheDocument();
      });
      
      // Third attempt - should trigger lockout
      fireEvent.change(input, { target: { value: '9012' } });
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText(/Account Locked/i)).toBeInTheDocument();
        expect(screen.getByText(/Too many failed attempts/)).toBeInTheDocument();
      });
    });

    test('stores lockout timestamp in localStorage', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      // Trigger 3 failed attempts
      for (let i = 0; i < 3; i++) {
        fireEvent.change(input, { target: { value: '1234' } });
        fireEvent.click(button);
        await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
        mockInvoke.mockClear();
      }
      
      await waitFor(() => {
        const lockoutTime = localStorage.getItem('manager_lockout_until');
        expect(lockoutTime).toBeTruthy();
        expect(parseInt(lockoutTime)).toBeGreaterThan(Date.now());
      });
    });

    test('displays lockout countdown timer', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      // Trigger lockout
      for (let i = 0; i < 3; i++) {
        fireEvent.change(input, { target: { value: '1234' } });
        fireEvent.click(button);
        await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
        mockInvoke.mockClear();
      }
      
      await waitFor(() => {
        expect(screen.getByText('Account Locked')).toBeInTheDocument();
        expect(screen.getByText(/5:00|4:5/)).toBeInTheDocument(); // Timer shows 5:00 or close
      });
    });

    test('prevents authentication during lockout', async () => {
      // Set lockout in localStorage
      const lockoutTime = Date.now() + 5 * 60 * 1000;
      localStorage.setItem('manager_lockout_until', lockoutTime.toString());

      render(<ManagerPinPrompt {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Account Locked')).toBeInTheDocument();
        expect(screen.queryByText('Authenticate')).not.toBeInTheDocument();
      });
    });

    test('clears lockout after 5 minutes', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      // Trigger lockout
      for (let i = 0; i < 3; i++) {
        fireEvent.change(input, { target: { value: '1234' } });
        fireEvent.click(button);
        await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
        mockInvoke.mockClear();
      }
      
      await waitFor(() => {
        expect(screen.getByText('Account Locked')).toBeInTheDocument();
      });
      
      // Fast-forward 5 minutes
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000 + 1000);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Account Locked')).not.toBeInTheDocument();
        expect(screen.getByText('Authenticate')).toBeInTheDocument();
      });
    });

    test('resets attempts counter on successful authentication', async () => {
      mockInvoke
        .mockResolvedValueOnce({ success: false, error: 'Invalid PIN' })
        .mockResolvedValueOnce({ success: false, error: 'Invalid PIN' })
        .mockResolvedValueOnce({
          success: true,
          manager: { id: 'mgr1', name: 'John Doe', role: 'manager' }
        });

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      // Two failed attempts
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      await waitFor(() => expect(screen.getByText(/2 attempts remaining/)).toBeInTheDocument());
      
      fireEvent.change(input, { target: { value: '5678' } });
      fireEvent.click(button);
      await waitFor(() => expect(screen.getByText(/1 attempt remaining/)).toBeInTheDocument());
      
      // Successful attempt
      fireEvent.change(input, { target: { value: '9999' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(localStorage.getItem('manager_lockout_until')).toBeNull();
      });
    });
  });

  describe('Modal Behavior', () => {
    test('closes modal when cancel button is clicked', async () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('closes modal when close icon is clicked', async () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const closeButton = screen.getByLabelText('Close modal');
      
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('closes modal when overlay is clicked', async () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const overlay = document.querySelector('.manager-pin-overlay');
      
      fireEvent.click(overlay);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('does not close when modal content is clicked', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      const modal = document.querySelector('.manager-pin-modal');
      
      fireEvent.click(modal);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('closes modal when Escape key is pressed', async () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('resets state when modal opens', () => {
      const { rerender } = render(<ManagerPinPrompt {...defaultProps} isOpen={false} />);
      
      rerender(<ManagerPinPrompt {...defaultProps} isOpen={true} />);
      
      const input = screen.getByLabelText('Enter Manager PIN');
      expect(input.value).toBe('');
    });

    test('prevents body scroll when modal is open', () => {
      render(<ManagerPinPrompt {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    test('restores body scroll when modal is closed', () => {
      const { unmount } = render(<ManagerPinPrompt {...defaultProps} />);
      
      unmount();
      
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Error Handling', () => {
    test('handles authentication error gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Authentication failed. Please try again.')).toBeInTheDocument();
      });
    });

    test('shows loading state during authentication', async () => {
      mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<ManagerPinPrompt {...defaultProps} />);
      const input = screen.getByLabelText('Enter Manager PIN');
      const button = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(button);
      
      expect(screen.getByText('Authenticating...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });
});
