import { useState, useLayoutEffect, useCallback, useEffect, useRef } from "react";
import friendService from "../services/friendService";
import blockService from "../services/blockService";
import { useCurrentUser } from "./useCurrentUser";
import { useFriendDataOptional } from "./useFriendDataOptional";


export type FriendshipStatus = "loading" | "none" | "pending_sent" | "pending_received" | "friends" | "blocked" | "blocked_by";

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
    
    // Pull refreshTrigger + optimistic actions + the canonical lists from
    // context so profile-level send/cancel updates the suggestion widget +
    // FriendRequests page, AND vice versa (widget send → profile button
    // re-renders to "Đã gửi" without refetch).
    const {
        refreshTrigger,
        acceptRequest: ctxAcceptRequest,
        rejectRequest: ctxRejectRequest,
        cancelSentRequest: ctxCancelSentRequest,
        unfriend: ctxUnfriend,
        refreshSentRequests: ctxRefreshSentRequests,
        sentRequests: ctxSentRequests,
        friends: ctxFriends,
        friendRequests: ctxFriendRequests,
        isInitialLoadComplete: ctxLoadComplete,
    } = useFriendDataOptional();

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
                const [blockedByMe, blockedByTarget, friends, receivedRequests, sentRequests] = await Promise.all([
                    blockService.getBlockedUsers(currentUser.id),
                    blockService.getBlockedUsers(targetUserId),
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
                const targetIdStr = String(targetUserId);
                const myIdStr = String(currentUser.id);

                // 0. Check block status first (takes priority over friend status)
                const iBlockedThem = blockedByMe.some((u: any) => String(u.id) === targetIdStr);
                const theyBlockedMe = blockedByTarget.some((u: any) => String(u.id) === myIdStr);

                if (iBlockedThem) {
                    newStatus = "blocked";
                } else if (theyBlockedMe) {
                    newStatus = "blocked_by";
                } else {
                    // 1. Check if they are friends
                    const isFriend = friends.some((f: any) => String(f.id) === targetIdStr);
                    if (isFriend) {
                        newStatus = "friends";
                    } else {
                        // 2. Check if they sent us a request
                        const hasReceivedRequest = receivedRequests.some((u: any) => String(u.id) === targetIdStr);
                        if (hasReceivedRequest) {
                            newStatus = "pending_received";
                        } else {
                            // 3. Check if WE sent a request to them
                            const hasSentRequest = sentRequests.some((u: any) => String(u.id) === targetIdStr);
                            if (hasSentRequest) {
                                newStatus = "pending_sent";
                            }
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

    // Realtime sync from context: when sentRequests / friends / friendRequests
    // change (e.g. widget sends a request to this profile's user), reflect
    // the new status here without firing another API fetch.
    useEffect(() => {
        if (!targetUserId || !currentUser?.id) return;
        if (currentUser.id === targetUserId) return;
        // Wait until context has loaded the initial lists, otherwise we'd
        // briefly flip a real "pending_sent" back to "none".
        if (!ctxLoadComplete) return;
        // Don't override the initial-load placeholder before our own API
        // checkStatus pass completes for this target.
        if (loadedTargetIdRef.current !== targetUserId) return;

        const tid = String(targetUserId);
        const isFriend = ctxFriends.some((u: any) => String(u.id) === tid);
        const isReceived = ctxFriendRequests.some((u: any) => String(u.id) === tid);
        const isSent = ctxSentRequests.some((u: any) => String(u.id) === tid);

        // Compute what the context THINKS the status is right now.
        const ctxStatus: FriendshipStatus = isFriend
            ? "friends"
            : isReceived
                ? "pending_received"
                : isSent
                    ? "pending_sent"
                    : "none";

        // Always defer to the context value — it reflects the latest
        // optimistic actions across the app (widget send/cancel, FriendRequests
        // accept/reject, etc.). If the API truth disagrees, the next
        // refreshTrigger (WebSocket event) re-runs checkStatus to reconcile.
        // Exception: never override a block status set by the API check.
        setStatus((cur) => {
            if (cur === "blocked" || cur === "blocked_by") return cur;
            return cur === ctxStatus ? cur : ctxStatus;
        });
    }, [
        targetUserId,
        currentUser?.id,
        ctxLoadComplete,
        ctxFriends,
        ctxFriendRequests,
        ctxSentRequests,
    ]);

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
            // Sync the FriendDataContext sentRequests so the suggestion
            // widget + "Đã gửi" tab reflect this action without page reload.
            ctxRefreshSentRequests?.();
            return true;
        } catch (err: any) {
            console.error("Error sending friend request:", err);
            setError("Không thể gửi lời mời kết bạn");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId, ctxRefreshSentRequests]);

    // Accept friend request — delegate to context so FriendRequests tab
    // removes the request and friends list refreshes without page reload.
    const acceptRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            const ok = ctxAcceptRequest
                ? await ctxAcceptRequest(targetUserId)
                : await friendService
                      .acceptFriendRequest({
                          senderId: targetUserId,
                          receivedId: currentUser.id,
                      })
                      .then(() => true)
                      .catch(() => false);

            if (ok) {
                setStatus("friends");
                return true;
            }
            setError("Không thể chấp nhận lời mời");
            return false;
        } catch (err: any) {
            console.error("Error accepting friend request:", err);
            setError("Không thể chấp nhận lời mời");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId, ctxAcceptRequest]);

    // Reject friend request — delegate to context so FriendRequests tab
    // removes the request immediately without page reload.
    const rejectRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            const ok = ctxRejectRequest
                ? await ctxRejectRequest(targetUserId)
                : await friendService
                      .rejectFriendRequest({
                          senderId: targetUserId,
                          receivedId: currentUser.id,
                      })
                      .then(() => true)
                      .catch(() => false);

            if (ok) {
                setStatus("none");
                return true;
            }
            setError("Không thể từ chối lời mời");
            return false;
        } catch (err: any) {
            console.error("Error rejecting friend request:", err);
            setError("Không thể từ chối lời mời");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId, ctxRejectRequest]);

    // Cancel sent request — delegate to context's optimistic action so
    // suggestion widget + sent-tab patch immediately without page reload.
    // Falls back to direct service call when no FriendDataProvider exists.
    const cancelRequest = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            const ok = ctxCancelSentRequest
                ? await ctxCancelSentRequest(targetUserId)
                : await friendService
                      .cancelFriendRequest({
                          senderId: currentUser.id,
                          receivedId: targetUserId,
                      })
                      .then(() => true)
                      .catch(() => false);

            if (ok) {
                setStatus("none");
                return true;
            }
            setError("Không thể hủy lời mời");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId, ctxCancelSentRequest]);

    // Unfriend — delegate to context so ctxFriends is updated immediately.
    // Without this, ctxFriends still contains the target after unfriending, and
    // the context-sync effect would flip a subsequent "pending_sent" back to "friends".
    const unfriend = useCallback(async (): Promise<boolean> => {
        if (!currentUser?.id || !targetUserId) return false;

        setLoading(true);
        setError(null);
        try {
            const ok = ctxUnfriend
                ? await ctxUnfriend(targetUserId)
                : await friendService
                      .cancelFriendRequest({
                          senderId: currentUser.id,
                          receivedId: targetUserId,
                      })
                      .then(() => true)
                      .catch(() => false);

            if (ok) {
                setStatus("none");
                return true;
            }
            setError("Không thể hủy kết bạn");
            return false;
        } catch (err: any) {
            console.error("Error unfriending:", err);
            setError("Không thể hủy kết bạn");
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUserId, ctxUnfriend]);

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
