import { useCallback } from "react";
import { UserPlus, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useFriendData } from "../../contexts/FriendDataContext";
import FriendRequestItem from "./FriendRequestItem";

interface FriendRequestsListProps {
    onRequestHandled?: () => void;
}

export default function FriendRequestsList({ onRequestHandled }: FriendRequestsListProps) {
    const { 
        friendRequests: requests, 
        friendRequestsLoading: loading, 
        friendRequestsError: error,
        refreshFriendRequests,
        acceptRequest,
        rejectRequest 
    } = useFriendData();

    const handleAccept = useCallback(async (userId: number) => {
        const success = await acceptRequest(userId);
        if (success) {
            toast.success("Đã chấp nhận lời mời kết bạn");
            onRequestHandled?.();
        } else {
            toast.error("Không thể chấp nhận lời mời. Vui lòng thử lại.");
        }
    }, [acceptRequest, onRequestHandled]);

    const handleReject = useCallback(async (userId: number) => {
        const success = await rejectRequest(userId);
        if (success) {
            toast.success("Đã từ chối lời mời");
            onRequestHandled?.();
        } else {
            toast.error("Không thể từ chối lời mời. Vui lòng thử lại.");
        }
    }, [rejectRequest, onRequestHandled]);

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
                    onClick={() => refreshFriendRequests()}
                    className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                >
                    <RefreshCw size={14} />
                    Thử lại
                </button>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="text-center py-8">
                <UserPlus size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold dark:text-white mb-2">
                    Không có lời mời nào
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Bạn chưa nhận được lời mời kết bạn nào
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {requests.length} lời mời kết bạn
            </div>
            {requests.map((user) => (
                <FriendRequestItem
                    key={user.id}
                    user={user}
                    type="received"
                    onAccept={handleAccept}
                    onReject={handleReject}
                />
            ))}
        </div>
    );
}
