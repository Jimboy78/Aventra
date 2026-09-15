"use client";

import { useState, useEffect, useCallback } from "react";

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'auto-save';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export default function NotificationSystem({ notifications, onDismiss }: NotificationSystemProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Show animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!notification.persistent && notification.duration !== 0) {
      const duration = notification.duration || getDefaultDuration(notification.type);
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  }, [notification.id, onDismiss]);

  const getNotificationStyle = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/90 border-green-600 text-green-100';
      case 'error':
        return 'bg-red-900/90 border-red-600 text-red-100';
      case 'warning':
        return 'bg-yellow-900/90 border-yellow-600 text-yellow-100';
      case 'info':
        return 'bg-blue-900/90 border-blue-600 text-blue-100';
      case 'auto-save':
        return 'bg-purple-900/90 border-purple-600 text-purple-100';
      default:
        return 'bg-gray-900/90 border-gray-600 text-gray-100';
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'auto-save':
        return '💾';
      default:
        return '🔔';
    }
  };

  return (
    <div
      className={`
        pixel-card border-2 p-4 backdrop-blur-sm transition-all duration-300 ease-out
        ${getNotificationStyle(notification.type)}
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
        ${isLeaving ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="text-xl flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-pixel font-bold text-sm">
            {notification.title}
          </h4>
          {notification.message && (
            <p className="text-pixel text-xs mt-1 opacity-90">
              {notification.message}
            </p>
          )}
          
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-xs underline hover:no-underline opacity-80 hover:opacity-100"
            >
              {notification.action.label}
            </button>
          )}
        </div>

        {!notification.persistent && (
          <button
            onClick={handleDismiss}
            className="text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {!notification.persistent && notification.duration !== 0 && (
        <div className="mt-2 w-full h-1 bg-black/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/40 rounded-full animate-notification-progress"
            style={{
              animationDuration: `${notification.duration || getDefaultDuration(notification.type)}ms`
            }}
          />
        </div>
      )}
    </div>
  );
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { ...notification, id }]);
    return id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'success', title, message, ...options });
  }, [addNotification]);

  const error = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'error', title, message, ...options });
  }, [addNotification]);

  const warning = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'warning', title, message, ...options });
  }, [addNotification]);

  const info = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'info', title, message, ...options });
  }, [addNotification]);

  const autoSave = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'auto-save', title, message, duration: 3000, ...options });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    autoSave,
  };
}

function getDefaultDuration(type: Notification['type']): number {
  switch (type) {
    case 'success':
      return 4000;
    case 'error':
      return 8000;
    case 'warning':
      return 6000;
    case 'info':
      return 5000;
    case 'auto-save':
      return 3000;
    default:
      return 5000;
  }
}