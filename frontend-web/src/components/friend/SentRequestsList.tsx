import { useState, useEffect, useCallback } from "react";
import { Send, Loader2, AlertCircle, X, RefreshCw } from "lucide-react";
import friendService from "../../services/friendService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { buildS3Url } from "../../utils/s3";
import type { User } from "../../types";

interface SentRequestsListProps {
    onRequestCanceled?: () => void;
}

export default function SentRequestsList({ onRequestCanceled }: SentRequestsListProps) {
    const currentUser = useCurrentUser();
    const [sentRequests, setSentRequests] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancelingId, setCancelingId] = useState<number | null>(null);

    const loadSentRequests = useCallback(async () => {
        if (!currentUser?.id) return;
        
        setLoading(true);
        setError("");
        try {
            console.log("🔄 Loading sent requests from API...");
            const requests = await friendService.getSentRequests(currentUser.id);
            setSentRequests(requests || []);
            console.log(`✅ Loaded ${requests?.length || 0} sent requests`);
        } catch (err: any) {
            console.error("Error loading sent requests:", err);
            setError("Không thể tải danh sách lời mời đã gửi.");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        loadSentRequests();
    }, [loadSentRequests]);

    const handleCancel = useCallback(async (userId: number) => {
        if (!currentUser?.id) return;
        
        setCancelingId(userId);
        try {
            await friendService.cancelFriendRequest({
                senderId: currentUser.id,
                receivedId: userId,
            });
            // Remove from local state
            setSentRequests(prev => prev.filter(u => u.id !== userId));
            onRequestCanceled?.();
        } catch (err: any) {
            console.error("Error canceling friend request:", err);
            alert("Không thể hủy lời mời. Vui lòng thử lại.");
        } finally {
            setCancelingId(null);
        }
    }, [currentUser?.id, onRequestCanceled]);

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
                    onClick={() => loadSentRequests()}
                    className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                >
                    <RefreshCw size={14} />
                    Thử lại
                </button>
            </div>
        );
    }

    if (sentRequests.length === 0) {
        return (
            <div className="text-center py-8">
                <Send size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold dark:text-white mb-2">
                    Không có lời mời nào
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Bạn chưa gửi lời mời kết bạn cho ai
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {sentRequests.length} lời mời đã gửi
            </div>
            {sentRequests.map((user) => (
                <div 
                    key={user.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                >
                    <img
                        src={buildS3Url(user.avatarUrl) || user.avatarUrl || "https://i.pravatar.cc/150"}
                        alt={user.username}
                        className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold dark:text-white truncate">
                            {user.username}
                        </p>
                        {(user.fullName || user.name) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {user.fullName || user.name}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Đang chờ phản hồi
                        </p>
                    </div>
                    <button
                        onClick={() => handleCancel(user.id)}
                        disabled={cancelingId === user.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#262626] rounded-lg hover:bg-gray-200 dark:hover:bg-[#363636] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {cancelingId === user.id ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <X size={16} />
                        )}
                        <span>Hủy</span>
                    </button>
                </div>
            ))}
        </div>
    );
}
