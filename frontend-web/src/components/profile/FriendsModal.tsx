import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { X, Loader2, AlertCircle } from "lucide-react";
import friendService from "../../services/friendService";
import blockService from "../../services/blockService";
import BlockUnblockButton from "../friend/BlockUnblockButton";
import { buildS3Url } from "../../utils/s3";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import useBlockNotifications from "../../hooks/useBlockNotifications";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import type { User } from "../../types";

interface FriendsModalProps {
    userId: number;
    onClose: () => void;
    onCountChange?: (count: number) => void;
}

export default function FriendsModal({ userId, onClose, onCountChange }: FriendsModalProps) {
    const currentUser = useCurrentUser();
    const [friends, setFriends] = useState<User[]>([]);
    const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const blockTrigger = useBlockNotifications();
    const presenceByUserId = usePresenceStatus(friends.map((friend) => friend.id));

    const loadData = useCallback(async () => {
        if (!currentUser?.id) return;
        
        setLoading(true);
        setError("");
        try {
            // Load friends list and blocked users in parallel
            const [friendsList, blockedUsers] = await Promise.all([
                friendService.getFriends(userId),
                blockService.getBlockedUsers(currentUser.id),
            ]);
            setFriends(friendsList);
            onCountChange?.(friendsList.length);
            setBlockedUserIds(new Set(blockedUsers.map(u => u.id)));
        } catch (err: any) {
            console.error("Error loading data:", err);
            setError("Không thể tải danh sách bạn bè. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }, [userId, currentUser?.id, onCountChange]);

    useEffect(() => {
        loadData();
    }, [loadData, blockTrigger]);

    // Handler to update blocked status locally
    const handleBlockStatusChange = useCallback((targetUserId: number, isBlocked: boolean) => {
        setBlockedUserIds(prev => {
            const next = new Set(prev);
            if (isBlocked) {
                next.add(targetUserId);
            } else {
                next.delete(targetUserId);
            }
            return next;
        });
        if (isBlocked) {
            setFriends((prev) => {
                const next = prev.filter((friend) => friend.id !== targetUserId);
                onCountChange?.(next.length);
                return next;
            });
        }
    }, [onCountChange]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[80vh] bg-white dark:bg-[#262626] rounded-2xl shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#363636]">
                    <h2 className="text-lg font-semibold dark:text-white">
                        Bạn bè ({friends.length})
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                        </div>
                    )}

                    {error && (
                        <div className="m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                            <AlertCircle size={20} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {!loading && friends.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
                            <span className="text-sm">Chưa có bạn bè</span>
                        </div>
                    )}

                    {!loading && friends.length > 0 && (
                        <div className="divide-y divide-gray-200 dark:divide-[#363636]">
                            {friends.map((friend) => (
                                <div
                                    key={friend.id}
                                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#3a3a3a] transition-colors"
                                >
                                    <Link
                                        to={`/profile/${friend.username}`}
                                        onClick={onClose}
                                        className="flex items-center gap-3 flex-1 min-w-0"
                                    >
                                        <span className="relative flex-shrink-0">
                                            <img
                                                src={buildS3Url(friend.avatarUrl) || friend.avatarUrl || "https://i.pravatar.cc/150"}
                                                alt={friend.username}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                            {presenceByUserId[Number(friend.id)]?.online && (
                                                <span
                                                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-[#262626]"
                                                    title="Dang hoat dong"
                                                />
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold dark:text-white text-sm truncate">
                                                {friend.username}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {friend.fullName || friend.name}
                                            </p>
                                        </div>
                                    </Link>
                                    <div className="ml-3 flex-shrink-0">
                                        <BlockUnblockButton
                                            userId={friend.id}
                                            username={friend.username}
                                            initialIsBlocked={blockedUserIds.has(friend.id)}
                                            skipInitialCheck={true}
                                            onBlockStatusChange={handleBlockStatusChange}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
