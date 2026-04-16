import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Users, Loader2, AlertCircle, UserMinus, RefreshCw } from "lucide-react";
import friendService from "../../services/friendService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { buildS3Url } from "../../utils/s3";
import type { User } from "../../types";

interface FriendsListProps {
    userId: string;
    showUnfriendButton?: boolean;
    onFriendRemoved?: (friendId: number) => void;
    // Optional: external data for real-time updates
    externalFriends?: User[];
    externalLoading?: boolean;
    externalError?: string;
    onRefresh?: () => void;
    onUnfriend?: (userId: number) => Promise<boolean>;
}

export default function FriendsList({ 
    userId, 
    showUnfriendButton = false,
    onFriendRemoved,
    externalFriends,
    externalLoading,
    externalError,
    onRefresh,
    onUnfriend,
}: FriendsListProps) {
    const currentUser = useCurrentUser();
    
    // Check if viewing own profile
    const isOwnProfile = currentUser?.id?.toString() === userId;
    
    // Local state (used when externalFriends not provided)
    const [localFriends, setLocalFriends] = useState<User[]>([]);
    const [localLoading, setLocalLoading] = useState(true);
    const [localError, setLocalError] = useState("");
    const [unfriendingId, setUnfriendingId] = useState<number | null>(null);

    // Use external data if provided, otherwise use local state
    const useExternal = externalFriends !== undefined;
    const friends = useExternal ? externalFriends : localFriends;
    const loading = useExternal ? (externalLoading ?? false) : localLoading;
    const error = useExternal ? (externalError ?? "") : localError;

    // Load friends locally (only if not using external data)
    const loadFriends = useCallback(async () => {
        if (useExternal) return;
        
        setLocalLoading(true);
        setLocalError("");
        try {
            const friendsList = await friendService.getFriends(userId);
            setLocalFriends(friendsList || []);
        } catch (err: any) {
            console.error("Error loading friends:", err);
            setLocalError("Không thể tải danh sách bạn bè. Vui lòng thử lại.");
        } finally {
            setLocalLoading(false);
        }
    }, [userId, useExternal]);

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    const handleRefresh = useCallback(() => {
        if (onRefresh) {
            onRefresh();
        } else {
            loadFriends();
        }
    }, [onRefresh, loadFriends]);

    const handleUnfriend = useCallback(async (friendId: number, friendUsername: string) => {
        if (!currentUser?.id) return;

        const confirmed = window.confirm(
            `Bạn có chắc muốn hủy kết bạn với ${friendUsername}?`
        );
        if (!confirmed) return;

        setUnfriendingId(friendId);
        try {
            if (onUnfriend) {
                const success = await onUnfriend(friendId);
                if (success) {
                    onFriendRemoved?.(friendId);
                } else {
                    alert("Không thể hủy kết bạn. Vui lòng thử lại.");
                }
            } else {
                await friendService.cancelFriendRequest({
                    senderId: currentUser.id,
                    receivedId: friendId,
                });
                setLocalFriends(prev => prev.filter(f => f.id !== friendId));
                onFriendRemoved?.(friendId);
            }
        } catch (err: any) {
            console.error("Error unfriending:", err);
            alert("Không thể hủy kết bạn. Vui lòng thử lại.");
        } finally {
            setUnfriendingId(null);
        }
    }, [currentUser?.id, onFriendRemoved, onUnfriend]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
                <button 
                    onClick={handleRefresh}
                    className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                >
                    <RefreshCw size={14} />
                    Thử lại
                </button>
            </div>
        );
    }

    if (friends.length === 0) {
        return (
            <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626] p-8 text-center">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold dark:text-white mb-2">
                    Chưa có bạn bè
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isOwnProfile ? "Bạn chưa có bạn bè nào" : "User này chưa có bạn bè nào"}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#262626]">
                <h2 className="text-lg font-semibold dark:text-white">
                    Bạn bè ({friends.length})
                </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-6">
                {friends.map((friend) => (
                    <div
                        key={friend.id}
                        className="flex flex-col items-center p-4 rounded-lg border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <Link
                            to={`/profile/${friend.username}`}
                            className="flex flex-col items-center w-full"
                        >
                            <img
                                src={buildS3Url(friend.avatarUrl) || friend.avatarUrl || "https://i.pravatar.cc/150"}
                                alt={friend.username}
                                className="w-20 h-20 rounded-full object-cover mb-3"
                            />
                            <p className="font-semibold dark:text-white text-center truncate w-full">
                                {friend.username}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center truncate w-full">
                                {friend.fullName || friend.name}
                            </p>
                        </Link>

                        {/* Unfriend button - only show on own profile */}
                        {showUnfriendButton && isOwnProfile && (
                            <button
                                onClick={() => handleUnfriend(friend.id, friend.username)}
                                disabled={unfriendingId === friend.id}
                                className="mt-3 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#262626] rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {unfriendingId === friend.id ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <UserMinus size={14} />
                                )}
                                <span>Hủy kết bạn</span>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
