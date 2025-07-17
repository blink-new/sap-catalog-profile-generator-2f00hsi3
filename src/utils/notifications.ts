// Simple notification system for rate limit and AI model status
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // Auto-dismiss after this many ms
}

class NotificationManager {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  add(notification: Omit<Notification, 'id' | 'timestamp'>) {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.notifications.unshift(newNotification);
    
    // Keep only last 10 notifications
    if (this.notifications.length > 10) {
      this.notifications = this.notifications.slice(0, 10);
    }

    this.notify();

    // Auto-dismiss if duration is specified
    if (notification.duration) {
      setTimeout(() => {
        this.remove(newNotification.id);
      }, notification.duration);
    }

    return newNotification.id;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notify();
  }

  clear() {
    this.notifications = [];
    this.notify();
  }

  // Convenience methods for common notification types
  info(title: string, message: string, duration = 5000) {
    return this.add({ type: 'info', title, message, duration });
  }

  warning(title: string, message: string, duration = 8000) {
    return this.add({ type: 'warning', title, message, duration });
  }

  error(title: string, message: string, duration = 10000) {
    return this.add({ type: 'error', title, message, duration });
  }

  success(title: string, message: string, duration = 4000) {
    return this.add({ type: 'success', title, message, duration });
  }

  // AI-specific notifications
  rateLimitWarning(modelName: string, waitTime: number) {
    const minutes = Math.floor(waitTime / 60000);
    const seconds = Math.floor((waitTime % 60000) / 1000);
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    
    return this.warning(
      'AI Model Rate Limited',
      `${modelName} has reached its rate limit. Switching to alternative models. Wait time: ${timeStr}`,
      8000
    );
  }

  modelFailure(modelName: string, reason: string) {
    return this.error(
      'AI Model Error',
      `${modelName} failed: ${reason}. Trying alternative models...`,
      6000
    );
  }

  fallbackMode(componentName: string) {
    return this.warning(
      'Using Fallback Algorithm',
      `All AI models are unavailable for "${componentName}". Generated code using fallback algorithm.`,
      10000
    );
  }

  codeGenerated(componentName: string, code: string, modelName: string) {
    return this.success(
      'Code Generated',
      `Generated "${code}" for "${componentName}" using ${modelName}`,
      3000
    );
  }
}

export const notifications = new NotificationManager();