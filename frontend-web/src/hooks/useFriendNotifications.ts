import { useEffect, useCallback, useRef, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import websocketService from "../services/websocket";
import toast from "react-hot-toast";

export type FriendEventType = 
    | "friend-request" 
    | "friend-accept" 
    | "friend-reject" 
    | "friend-cancel";

export interface FriendNotificationPayload {
    event: FriendEventType;
    message: string;
    timestamp: string;
}

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

    const handleFriendEvent = useCallback((eventType: FriendEventType, message: string) => {
        const payload: FriendNotificationPayload = {
            event: eventType,
            message: message,
            timestamp: new Date().toISOString(),
        };

        console.log(`🔔 Friend event received: ${eventType}`, message);

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
                
                websocketService.subscribeToTopic(
                    destination,
                    (message: any) => {
                        console.log(`📨 Received ${eventType}:`, message);
                        // Backend sends plain text string, not JSON
                        const messageText = typeof message === 'string' ? message : String(message);
                        handleFriendEvent(eventType, messageText);
                    }
                );
            });

            setIsConnected(true);
            console.log(`✅ Subscribed to all friend notifications for ${phoneNumber}`);
        };

        // Connect and subscribe
        const setupConnection = async () => {
            try {
                // Try to connect if not already connected
                if (!websocketService.isConnected()) {
                    console.log("🔄 Connecting to WebSocket...");
                    await websocketService.connect(
                        () => {
                            console.log("✅ WebSocket connected callback fired");
                            subscribeToFriendEvents();
                        },
                        (error) => {
                            console.error("❌ WebSocket connection error:", error);
                        }
                    );
                } else {
                    // Already connected, just subscribe
                    subscribeToFriendEvents();
                }
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
                websocketService.unsubscribeFromTopic(destination);
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
