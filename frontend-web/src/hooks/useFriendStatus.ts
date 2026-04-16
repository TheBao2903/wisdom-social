import { useState, useLayoutEffect, useCallback, useRef } from "react";
import friendService from "../services/friendService";
import { useCurrentUser } from "./useCurrentUser";
import { useFriendDataOptional } from "./useFriendDataOptional";
import type { User } from "../types";

export type FriendshipStatus = "loading" | "none" | "pending_sent" | "pending_received" | "friends";

interface UseFriendStatusResult {
    status: FriendshipStatus;
    loading: boolean;
    error: string | null;
    sendRequest: () => Promise<boolean>;
    acceptRequest: () => Promise<boolean>;
    rejectRequest: () => Promise<boolean>;
    cancelRequest: () => Promise<boolean>;
    unfriend: () => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useFriendStatus(targetUserId: number | undefined): UseFriendStatusResult {
    const currentUser = useCurrentUser();
    const [status, setStatus] = useState<FriendshipStatus>("loading");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualRefreshCount, setManualRefreshCount] = useState(0);
    
    // Track if we've completed initial load for this specific targetUserId
    const loadedTargetIdRef = useRef<number | null>(null);
    
    // Only get refreshTrigger from context for WebSocket updates
    const { refreshTrigger } = useFriendDataOptional();

    // Check friendship status by loading ALL data from API first
    useLayoutEffect(() => {
        let cancelled = false;
        
        const checkStatus = async () => {
            // Wait for currentUser to be available
            if (!currentUser?.id) {
                // Keep loading state while waiting for currentUser
                return;
            }
            
            if (!targetUserId) {
                if (!cancelled) {
                    setStatus("none");
                    loadedTargetIdRef.current = null;
                }
                return;
            }

            // Don't check if viewing own profile
            if (currentUser.id === targetUserId) {
                if (!cancelled) {
                    setStatus("none");
                    loadedTargetIdRef.current = targetUserId;
                }
                return;
            }
            
            // CRITICAL: Only show loading on first load or when targetUserId changes
            const isNewTarget = loadedTargetIdRef.current !== targetUserId;
            if (isNewTarget && !cancelled) {
                setStatus("loading");
            }

            try {
                // Load ALL data in parallel
                const [friends, receivedRequests, sentRequests] = await Promise.all([
                    friendService.getFriends(currentUser.id),
                    friendService.getFriendRequests(currentUser.id),
                    friendService.getSentRequests(currentUser.id),
                ]);
                
                if (cancelled) {
                    return;
                }
                
                // Mark this targetUserId as loaded
                loadedTargetIdRef.current = targetUserId;
                
                // Determine the new status
                let newStatus: FriendshipStatus = "none";
                
                // 1. Check if they are friends
                const isFriend = friends.some((f: User) => f.id === targetUserId);
                if (isFriend) {
                    newStatus = "friends";
                } else {
                    // 2. Check if they sent us a request
                    const hasReceivedRequest = receivedRequests.some((u: User) => u.id === targetUserId);
                    if (hasReceivedRequest) {
                        newStatus = "pending_received";
                    } else {
                        // 3. Check if WE sent a request to them
                        const hasSentRequest = sentRequests.some((u: User) => u.id === targetUserId);
                        if (hasSentRequest) {
                            newStatus = "pending_sent";
                        }
                    }
                }
                
                setStatus(newStatus);
            } catch (err) {
                console.error("Error checking friendship status:", err);
                if (!cancelled) {
                    setError("Không thể kiểm tra trạng thái bạn bè");
                    // Only set to "none" if this was the first load
                    if (isNewTarget) {
                        setStatus("none");
                    }
                    loadedTargetIdRef.current = targetUserId;
                }
            }
        };

        checkStatus();
        
        return () => {
            cancelled = true;
        };
    }, [currentUser?.id, targetUserId, refreshTrigger, manualRefreshCount]);

    // Send friend request
    const sendRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            await friendService.sendFriendRequest({
                senderId: currentUser.id,
                receivedId: targetUserId,
            });
            setStatus("pending_sent");
            return true;
        } catch (err: any) {
            console.error("Error sending friend request:", err);
            setError("Không thể gửi lời mời kết bạn");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId]);

    // Accept friend request
    const acceptRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            await friendService.acceptFriendRequest({
                senderId: targetUserId,
                receivedId: currentUser.id,
            });
            setStatus("friends");
            return true;
        } catch (err: any) {
            console.error("Error accepting friend request:", err);
            setError("Không thể chấp nhận lời mời");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId]);

    // Reject friend request
    const rejectRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            await friendService.rejectFriendRequest({
                senderId: targetUserId,
                receivedId: currentUser.id,
            });
            setStatus("none");
            return true;
        } catch (err: any) {
            console.error("Error rejecting friend request:", err);
            setError("Không thể từ chối lời mời");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId]);

    // Cancel sent request
    const cancelRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            await friendService.cancelFriendRequest({
                senderId: currentUser.id,
                receivedId: targetUserId,
            });
            setStatus("none");
            return true;
        } catch (err: any) {
            console.error("Error canceling friend request:", err);
            setError("Không thể hủy lời mời");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId]);

    // Unfriend
    const unfriend = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            await friendService.cancelFriendRequest({
                senderId: currentUser.id,
                receivedId: targetUserId,
            });
            setStatus("none");
            return true;
        } catch (err: any) {
            console.error("Error unfriending:", err);
            setError("Không thể hủy kết bạn");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId]);

    // Refresh status - triggers re-run of useEffect
    const refresh = useCallback(async () => {
        loadedTargetIdRef.current = null; // Reset to trigger loading state
        setStatus("loading");
        setManualRefreshCount(c => c + 1);
    }, []);

    return {
        status,
        loading,
        error,
        sendRequest,
        acceptRequest,
        rejectRequest,
        cancelRequest,
        unfriend,
        refresh,
    };
}

export default useFriendStatus;
