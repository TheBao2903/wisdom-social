import { UserPlus, UserMinus, UserCheck, Clock, Loader2, X } from "lucide-react";
import { useFriendStatus, type FriendshipStatus } from "../../hooks/useFriendStatus";
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface FriendActionsProps {
    targetUserId: number;
    targetUsername?: string;
    size?: "sm" | "md" | "lg";
    showText?: boolean;
    layout?: "horizontal" | "vertical";
    onStatusChange?: (status: FriendshipStatus) => void;
}

export default function FriendActions({
    targetUserId,
    targetUsername,
    size = "md",
    showText = true,
    layout = "horizontal",
    onStatusChange,
}: FriendActionsProps) {
    const currentUser = useCurrentUser();
    const {
        status,
        loading,
        sendRequest,
        acceptRequest,
        rejectRequest,
        cancelRequest,
        unfriend,
    } = useFriendStatus(targetUserId);

    // Size classes (defined early so loading state can use them)
    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-2.5 text-base",
    };

    const iconSize = {
        sm: 14,
        md: 16,
        lg: 18,
    };

    const baseClasses = `flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]}`;

    // Log every render to debug
    console.log(`🎨 [FriendActions] Rendering for user ${targetUserId}, status:`, status, 'loading:', loading);

    // Don't render if viewing own profile
    if (currentUser?.id === targetUserId) {
        return null;
    }

    // CRITICAL: Don't render ANY button until we know the actual status
    // This prevents the flicker from showing wrong button
    if (status === "loading") {
        return (
            <div className={`${baseClasses} bg-gray-200 dark:bg-[#363636] text-gray-400 cursor-wait`}>
                <Loader2 className="animate-spin" size={iconSize[size]} />
                {showText && <span>Đang tải...</span>}
            </div>
        );
    }

    // Handlers
    const handleSendRequest = async () => {
        const success = await sendRequest();
        if (success) {
            onStatusChange?.("pending_sent");
        }
    };

    const handleAcceptRequest = async () => {
        const success = await acceptRequest();
        if (success) {
            onStatusChange?.("friends");
        }
    };

    const handleRejectRequest = async () => {
        const confirmed = window.confirm(
            `Bạn có chắc muốn từ chối lời mời kết bạn${targetUsername ? ` từ ${targetUsername}` : ""}?`
        );
        if (!confirmed) return;

        const success = await rejectRequest();
        if (success) {
            onStatusChange?.("none");
        }
    };

    const handleCancelRequest = async () => {
        const confirmed = window.confirm("Bạn có chắc muốn hủy lời mời kết bạn?");
        if (!confirmed) return;

        const success = await cancelRequest();
        if (success) {
            onStatusChange?.("none");
        }
    };

    const handleUnfriend = async () => {
        const confirmed = window.confirm(
            `Bạn có chắc muốn hủy kết bạn${targetUsername ? ` với ${targetUsername}` : ""}?`
        );
        if (!confirmed) return;

        const success = await unfriend();
        if (success) {
            onStatusChange?.("none");
        }
    };

    const containerClass = layout === "vertical" ? "flex flex-col gap-2" : "flex flex-row gap-2";

    // Render based on status
    switch (status) {
        case "none":
            return (
                <button
                    onClick={handleSendRequest}
                    disabled={loading}
                    className={`${baseClasses} bg-blue-500 text-white hover:bg-blue-600`}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={iconSize[size]} />
                    ) : (
                        <UserPlus size={iconSize[size]} />
                    )}
                    {showText && <span>Kết bạn</span>}
                </button>
            );

        case "pending_sent":
            return (
                <button
                    onClick={handleCancelRequest}
                    disabled={loading}
                    className={`${baseClasses} bg-gray-200 dark:bg-[#363636] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#454545]`}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={iconSize[size]} />
                    ) : (
                        <Clock size={iconSize[size]} />
                    )}
                    {showText && <span>Đã gửi lời mời</span>}
                </button>
            );

        case "pending_received":
            return (
                <div className={containerClass}>
                    {/* Accept Button */}
                    <button
                        onClick={handleAcceptRequest}
                        disabled={loading}
                        className={`${baseClasses} bg-blue-500 text-white hover:bg-blue-600`}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={iconSize[size]} />
                        ) : (
                            <UserCheck size={iconSize[size]} />
                        )}
                        {showText && <span>Chấp nhận</span>}
                    </button>

                    {/* Reject Button */}
                    <button
                        onClick={handleRejectRequest}
                        disabled={loading}
                        className={`${baseClasses} bg-gray-200 dark:bg-[#363636] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#454545]`}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={iconSize[size]} />
                        ) : (
                            <X size={iconSize[size]} />
                        )}
                        {showText && <span>Từ chối</span>}
                    </button>
                </div>
            );

        case "friends":
            return (
                <button
                    onClick={handleUnfriend}
                    disabled={loading}
                    className={`${baseClasses} bg-gray-200 dark:bg-[#363636] text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400`}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={iconSize[size]} />
                    ) : (
                        <UserMinus size={iconSize[size]} />
                    )}
                    {showText && <span>Bạn bè</span>}
                </button>
            );

        default:
            return null;
    }
}
