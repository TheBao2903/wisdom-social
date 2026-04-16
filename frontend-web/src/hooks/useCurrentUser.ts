import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { getCurrentUser } from '../utils/auth';
import websocketService from '../services/websocket';

interface CurrentUser {
    id: number;
    name: string;
    username: string;
    fullName: string;
    avatarUrl: string;
    bio?: string;
    phone?: string;
    birthday: string;
    gender: string;
}

// Helper: convert phone to international format
const convertPhoneToInternational = (phone: string | undefined): string => {
  if (!phone) return '';
  if (phone.startsWith('+84')) return phone;
  if (phone.startsWith('0')) return '+84' + phone.substring(1);
  if (phone.startsWith('84')) return '+' + phone;
  return '+84' + phone;
};

export function useCurrentUser() {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);
    const fetchUserDataRef = useRef<() => Promise<void>>(null!);

    // Fetch current user from API - wrapped in useCallback
    const fetchUserData = useCallback(async () => {
        try {
            console.log("🔄 Fetching current user via auth/me...");
            const user = await getCurrentUser();
            console.log("✅ Current user fetched:", user);
            console.log("👤 User avatar before setState:", user?.avatarUrl);
            if (user) {
                console.log("📌 Setting currentUser state...");
                console.log("🔍 user object:", user);
                console.log("🔍 user.avatarUrl:", user.avatarUrl);
                flushSync(() => {
                    setCurrentUser(user);
                });
                console.log("✅ setCurrentUser() called (flushed)");
            } else {
                console.warn("⚠️ getCurrentUser returned null");
            }
        } catch (error) {
            console.error("❌ Failed to fetch current user:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Update ref - always latest version
    useEffect(() => {
        fetchUserDataRef.current = fetchUserData;
    }, [fetchUserData]);

    // Initial load
    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    // Setup WebSocket subscription for profile updates
    useEffect(() => {
        if (!currentUser?.phone) {
            console.log("🔴 No phone from currentUser, skipping WebSocket subscription");
            return;
        }

        const setupProfileUpdateListener = async () => {
            try {
                console.log("🟡 Setting up profile update listener for phone:", currentUser.phone);

                // Ensure WebSocket is connected
                const wsConnected = websocketService.isConnected();
                console.log("🟡 WebSocket connected?", wsConnected);

                if (!wsConnected) {
                    await websocketService.connect();
                    console.log("🟢 WebSocket connected");
                }

                // Convert phone to international format
                const internationalPhone = convertPhoneToInternational(currentUser.phone);
                console.log("🟡 International phone:", internationalPhone);

                // Handle profile update event - call ref instead of closure
                const handleProfileUpdate = async (updatedData: any) => {
                    console.log("🟢🟢🟢 PROFILE UPDATE EVENT RECEIVED 🟢🟢🟢");
                    console.log("📱 Updated data from WebSocket:", updatedData);

                    // Refresh current user data using ref (always latest)
                    console.log("🟡 Calling fetchUserData to refresh...");
                    await fetchUserDataRef.current();
                    console.log("✅ fetchUserData completed");
                };

                // Subscribe to profile updates
                console.log("🟡 Subscribing to: /topic/user/" + internationalPhone + "/profile-update");
                websocketService.subscribeToProfileUpdates(
                    internationalPhone,
                    handleProfileUpdate
                );
                console.log("🟢 Subscribed to profile updates");
            } catch (error) {
                console.error("❌ Error setting up profile update listener:", error);
            }
        };

        setupProfileUpdateListener();

        // Cleanup on unmount or when currentUser changes
        return () => {
            if (currentUser?.phone) {
                const internationalPhone = convertPhoneToInternational(currentUser.phone);
                console.log("🟠 Unsubscribing from profile updates");
                websocketService.unsubscribeFromProfileUpdates(internationalPhone);
            }
        };
    }, [currentUser?.phone]);

    return currentUser;
}
