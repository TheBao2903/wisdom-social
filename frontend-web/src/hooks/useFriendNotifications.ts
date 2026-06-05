import { useEffect, useCallback, useRef, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import websocketService from "../services/websocket";
import toast from "react-hot-toast";

export type FriendEventType =
  | "friend-request"
  | "friend-accept"
  | "friend-reject"
  | "friend-cancel";

// Matches backend FriendEventPayload DTO
interface BackendFriendPayload {
  eventType: string;
  senderId: number;
  receiverId: number;
  timestamp: string;
}

export interface FriendNotificationPayload {
  event: FriendEventType;
  message: string;
  timestamp: string;
  senderId?: number;
  receiverId?: number;
}

const FRIEND_EVENT_MESSAGES: Record<FriendEventType, string> = {
  "friend-request": "Bạn có lời mời kết bạn mới",
  "friend-accept": "Lời mời kết bạn của bạn đã được chấp nhận",
  "friend-reject": "Lời mời kết bạn của bạn đã bị từ chối",
  "friend-cancel": "Một người dùng đã hủy kết bạn với bạn",
};

interface UseFriendNotificationsOptions {
  onFriendRequest?: (payload: FriendNotificationPayload) => void;
  onFriendAccept?: (payload: FriendNotificationPayload) => void;
  onFriendReject?: (payload: FriendNotificationPayload) => void;
  onFriendCancel?: (payload: FriendNotificationPayload) => void;
  showToasts?: boolean;
}

/**
 * Convert phone number to international format (+84...)
 * Example: 0987654321 -> +84987654321
 */
function convertToInternationalFormat(phone: string): string {
  if (!phone) return phone;

  // Already in international format
  if (phone.startsWith("+84")) {
    return phone;
  }

  // Remove leading 0 and add +84
  if (phone.startsWith("0")) {
    return "+84" + phone.substring(1);
  }

  // If just digits without prefix, assume Vietnamese number
  if (/^\d{9,10}$/.test(phone)) {
    return "+84" + phone;
  }

  return phone;
}

export function useFriendNotifications(options: UseFriendNotificationsOptions = {}) {
  const currentUser = useCurrentUser();
  const [isConnected, setIsConnected] = useState(false);
  const {
    onFriendRequest,
    onFriendAccept,
    onFriendReject,
    onFriendCancel,
    showToasts = true,
  } = options;

  // Use refs to avoid stale closures
  const callbacksRef = useRef({ onFriendRequest, onFriendAccept, onFriendReject, onFriendCancel });
  callbacksRef.current = { onFriendRequest, onFriendAccept, onFriendReject, onFriendCancel };

  const handleFriendEvent = useCallback((eventType: FriendEventType, raw: BackendFriendPayload | string) => {
    const backend = typeof raw === 'object' && raw !== null ? raw as BackendFriendPayload : null;
    const message = FRIEND_EVENT_MESSAGES[eventType];

    const payload: FriendNotificationPayload = {
      event: eventType,
      message,
      timestamp: backend?.timestamp ?? new Date().toISOString(),
      senderId: backend?.senderId,
      receiverId: backend?.receiverId,
    };

    console.log(`🔔 Friend event received: ${eventType}`, raw);

    // Show toast notification with the message from backend
    if (showToasts && message) {
      switch (eventType) {
        case "friend-request":
          toast.success(message, {
            icon: "👋",
            duration: 4000,
          });
          break;
        case "friend-accept":
          toast.success(message, {
            icon: "🎉",
            duration: 4000,
          });
          break;
        case "friend-reject":
          toast(message, {
            icon: "😔",
            duration: 4000,
          });
          break;
        case "friend-cancel":
          toast(message, {
            icon: "❌",
            duration: 4000,
          });
          break;
      }
    }

    // Call specific callback
    switch (eventType) {
      case "friend-request":
        callbacksRef.current.onFriendRequest?.(payload);
        break;
      case "friend-accept":
        callbacksRef.current.onFriendAccept?.(payload);
        break;
      case "friend-reject":
        callbacksRef.current.onFriendReject?.(payload);
        break;
      case "friend-cancel":
        callbacksRef.current.onFriendCancel?.(payload);
        break;
    }
  }, [showToasts]);

  useEffect(() => {
    if (!currentUser?.phone) {
      console.log("📱 No phone number available, waiting for user data...");
      return;
    }

    // Convert to international format (+84...)
    const phoneNumber = convertToInternationalFormat(currentUser.phone);
    console.log(`📱 Setting up friend notifications for phone: ${currentUser.phone} -> ${phoneNumber}`);
    const handlersByEvent = new Map<FriendEventType, (raw: any) => void>();

    const events: FriendEventType[] = [
      "friend-request",
      "friend-accept",
      "friend-reject",
      "friend-cancel"
    ];

    // Subscribe to friend events
    const subscribeToFriendEvents = () => {
      if (!websocketService.isConnected()) {
        console.log("⏳ WebSocket not connected yet, waiting...");
        return;
      }

      console.log("✅ WebSocket is connected, subscribing to friend events...");

      events.forEach((eventType) => {
        const destination = `/topic/user/${phoneNumber}/${eventType}`;
        console.log(`📡 Subscribing to: ${destination}`);

        const handler = (raw: any) => {
          console.log(`📨 Received ${eventType}:`, raw);
          // Backend sends FriendEventPayload: { eventType, senderId, receiverId, timestamp }
          handleFriendEvent(eventType, raw);
        };
        handlersByEvent.set(eventType, handler);

        websocketService.subscribeToTopic(
          destination,
          handler
        );
      });

      setIsConnected(true);
      console.log(`✅ Subscribed to all friend notifications for ${phoneNumber}`);
    };

    // Connect and subscribe
    const setupConnection = async () => {
      try {
        // Ensure WebSocket is connected (safe to call even if already connecting/connected)
        await websocketService.connect(
          undefined,
          (error) => {
            console.error("❌ WebSocket connection error:", error);
          }
        );
        // Subscribe after connection is guaranteed — avoids race condition where
        // another component's connect() call swallows our onConnect callback.
        subscribeToFriendEvents();
      } catch (error) {
        console.error("❌ Error setting up friend notifications:", error);
      }
    };

    setupConnection();

    // Cleanup on unmount
    return () => {
      console.log(`🔌 Cleaning up friend notification subscriptions...`);
      events.forEach((eventType) => {
        const destination = `/topic/user/${phoneNumber}/${eventType}`;
        const handler = handlersByEvent.get(eventType);
        websocketService.unsubscribeFromTopic(destination, handler);
      });
      setIsConnected(false);
    };
  }, [currentUser?.phone, handleFriendEvent]);

  return {
    currentUserPhone: currentUser?.phone,
    isConnected,
  };
}

export default useFriendNotifications;
