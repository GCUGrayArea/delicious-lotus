import React, { createContext, useCallback, useState, ReactNode } from 'react';
import { ToastContainer } from '@/components/ad-generator/ui/Toast';
import type { ToastProps, ToastContainerProps } from '@/components/ad-generator/ui/Toast';

/**
 * Notification Context Value
 */
export interface NotificationContextValue {
  showNotification: (notification: Omit<ToastProps, 'id' | 'onClose'>) => string;
  showSuccess: (message: string, title?: string) => string;
  showError: (message: string, title?: string) => string;
  showWarning: (message: string, title?: string) => string;
  showInfo: (message: string, title?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

/**
 * Notification Context
 */
export const NotificationContext = createContext<
  NotificationContextValue | undefined
>(undefined);

/**
 * Notification Provider Props
 */
interface NotificationProviderProps {
  children: ReactNode;
  position?: ToastContainerProps['position'];
  maxToasts?: number;
}

/**
 * Generate unique ID for toasts
 */
const generateId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * NotificationProvider Component
 *
 * Provides a global notification system using React Context.
 * Manages toast notifications with auto-dismiss and manual dismiss.
 *
 * Features:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-dismiss after configurable duration
 * - Manual dismiss
 * - Queue management with max toasts limit
 * - Convenience methods for each toast type
 *
 * @example
 * ```tsx
 * <NotificationProvider maxToasts={5}>
 *   <App />
 * </NotificationProvider>
 * ```
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  /**
   * Show a notification
   */
  const showNotification = useCallback(
    (notification: Omit<ToastProps, 'id' | 'onClose'>): string => {
      const id = generateId();

      const newToast: ToastProps = {
        id,
        ...notification,
        onClose: (toastId: string) => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        },
      };

      setToasts((prev) => {
        // Add new toast
        const updated = [...prev, newToast];

        // Limit number of toasts
        if (updated.length > maxToasts) {
          return updated.slice(updated.length - maxToasts);
        }

        return updated;
      });

      return id;
    },
    [maxToasts]
  );

  /**
   * Show success notification
   */
  const showSuccess = useCallback(
    (message: string, title?: string): string => {
      return showNotification({
        type: 'success',
        title: title || 'Success',
        message,
        duration: 5000,
      });
    },
    [showNotification]
  );

  /**
   * Show error notification
   */
  const showError = useCallback(
    (message: string, title?: string): string => {
      return showNotification({
        type: 'error',
        title: title || 'Error',
        message,
        duration: 7000, // Errors stay longer
      });
    },
    [showNotification]
  );

  /**
   * Show warning notification
   */
  const showWarning = useCallback(
    (message: string, title?: string): string => {
      return showNotification({
        type: 'warning',
        title: title || 'Warning',
        message,
        duration: 6000,
      });
    },
    [showNotification]
  );

  /**
   * Show info notification
   */
  const showInfo = useCallback(
    (message: string, title?: string): string => {
      return showNotification({
        type: 'info',
        title: title || 'Info',
        message,
        duration: 5000,
      });
    },
    [showNotification]
  );

  /**
   * Dismiss a specific toast
   */
  const dismiss = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Dismiss all toasts
   */
  const dismissAll = useCallback((): void => {
    setToasts([]);
  }, []);

  const value: NotificationContextValue = {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismiss,
    dismissAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} position={position} />
    </NotificationContext.Provider>
  );
};

NotificationProvider.displayName = 'NotificationProvider';
