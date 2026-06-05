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
export const convertPhoneToInternational = (phone: string | undefined): string => {
    if (!phone) return '';
    const normalized = phone.trim().replace(/\s+/g, '');
    if (!normalized) return '';
    if (normalized.startsWith('+84')) return normalized;
    if (normalized.startsWith('0')) return '+84' + normalized.substring(1);
    if (normalized.startsWith('84')) return '+' + normalized;
    return '+84' + normalized;
};

export function useCurrentUser() {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [, setLoading] = useState(true);
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

        const internationalPhone = convertPhoneToInternational(currentUser.phone);
        console.log("🟡 International phone:", internationalPhone);

        const handleProfileUpdate = async (updatedData: any) => {
            console.log("🟢🟢🟢 PROFILE UPDATE EVENT RECEIVED 🟢🟢🟢");
            console.log("📱 Updated data from WebSocket:", updatedData);

            // Refresh current user data using ref (always latest)
            console.log("🟡 Calling fetchUserData to refresh...");
            await fetchUserDataRef.current();
            console.log("✅ fetchUserData completed");
        };

        let cancelled = false;

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

                if (cancelled) return;

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
            cancelled = true;
            console.log("🟠 Unsubscribing from profile updates");
            websocketService.unsubscribeFromProfileUpdates(
                internationalPhone,
                handleProfileUpdate,
            );
        };
    }, [currentUser?.phone]);

    return currentUser;
}
