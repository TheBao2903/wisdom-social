import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getNotifications, getUnreadCount, markAsRead as apiMarkAsRead, markAllAsRead as apiMarkAllAsRead } from "../services/notificationService";
import websocketService from "../services/websocket";
import type { Notification } from "../types";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearUnreadCount: () => void;
  fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      const [fetchedNotifications, count] = await Promise.all([
        getNotifications(0, 50),
        getUnreadCount()
      ]);

      setNotifications(fetchedNotifications);
      setUnreadCount(count);
    } catch (error) {
      console.error("NotificationProvider: Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const userId = currentUser.id.toString();
    const destination = `/topic/user/${userId}/notifications`;
    
    const handleNewNotification = (notification: Notification) => {
      console.log("🔔 [FRONTEND-NOTI] Received Real-time:", notification);
      
      setNotifications((prev) => {
        if (prev.some(n => n.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 50);
      });

      if (!notification.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    let subscriptionAttempted = false;
    let intervalId: any = null;

    const attemptSubscription = () => {
      if (websocketService.isConnected()) {
        console.log("🔔 [FRONTEND-NOTI] WebSocket connected, subscribing to:", destination);
        websocketService.subscribeToTopic(destination, handleNewNotification);
        subscriptionAttempted = true;
        if (intervalId) clearInterval(intervalId);
      } else {
        console.log("🔔 [FRONTEND-NOTI] WebSocket not connected yet, waiting...");
      }
    };

    // Try immediately
    attemptSubscription();

    // If not connected, retry every 2 seconds until successful
    if (!subscriptionAttempted) {
      intervalId = setInterval(attemptSubscription, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      console.log("🔔 [FRONTEND-NOTI] Unsubscribing from:", destination);
      websocketService.unsubscribeFromTopic(destination);
    };
  }, [currentUser?.id]);

  const markAsRead = async (id: string) => {
    const success = await apiMarkAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const success = await apiMarkAllAsRead();
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    }
  };

  const clearUnreadCount = () => {
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        clearUnreadCount,
        fetchNotifications: fetchInitialData
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
};
