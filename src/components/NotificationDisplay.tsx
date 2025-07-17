import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  X, 
  XCircle 
} from 'lucide-react';
import { notifications, type Notification } from '../utils/notifications';

export const NotificationDisplay: React.FC = () => {
  const [notificationList, setNotificationList] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notifications.subscribe(setNotificationList);
    return unsubscribe;
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'info': return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBackgroundColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-orange-50 border-orange-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'info': return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'text-green-800';
      case 'warning': return 'text-orange-800';
      case 'error': return 'text-red-800';
      case 'info': return 'text-blue-800';
    }
  };

  if (notificationList.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notificationList.slice(0, 5).map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border shadow-lg transition-all duration-300 ${getBackgroundColor(notification.type)}`}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            <div className="flex-1 min-w-0">
              <h4 className={`font-medium text-sm ${getTextColor(notification.type)}`}>
                {notification.title}
              </h4>
              <p className={`text-xs mt-1 ${getTextColor(notification.type)} opacity-90`}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => notifications.remove(notification.id)}
              className={`flex-shrink-0 ${getTextColor(notification.type)} opacity-60 hover:opacity-100 transition-opacity`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      
      {notificationList.length > 5 && (
        <div className="text-center">
          <button
            onClick={() => notifications.clear()}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all ({notificationList.length})
          </button>
        </div>
      )}
    </div>
  );
};