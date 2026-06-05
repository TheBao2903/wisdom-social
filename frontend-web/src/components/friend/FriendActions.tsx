import { useState, useEffect, useRef } from "react";
import { UserPlus, UserMinus, UserCheck, Clock, Loader2, X } from "lucide-react";
import { useFriendStatus, type FriendshipStatus } from "../../hooks/useFriendStatus";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import ConfirmModal from "../common/ConfirmModal";

interface FriendActionsProps {
    targetUserId: number;
    targetUsername?: string;
    size?: "sm" | "md" | "lg";
    showText?: boolean;
    layout?: "horizontal" | "vertical";
    onStatusChange?: (status: FriendshipStatus) => void;
    onFriendAccepted?: () => void;
    onFriendRemoved?: () => void;
}

export default function FriendActions({
    targetUserId,
    targetUsername,
    size = "md",
    showText = true,
    layout = "horizontal",
    onStatusChange,
    onFriendAccepted,
    onFriendRemoved,
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

    // Notify parent whenever status settles (not just on user action)
    const onStatusChangeRef = useRef(onStatusChange);
    useEffect(() => { onStatusChangeRef.current = onStatusChange; });
    useEffect(() => {
        if (status !== "loading") onStatusChangeRef.current?.(status);
    }, [status]);

    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        confirmText: string;
        variant: "danger" | "warning" | "default";
        action: () => Promise<void>;
    } | null>(null);

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
            onFriendAccepted?.();
        }
    };

    const handleRejectRequest = () => {
        setConfirmModal({
            title: "Từ chối lời mời",
            message: `Bạn có chắc muốn từ chối lời mời kết bạn${targetUsername ? ` từ ${targetUsername}` : ""}?`,
            confirmText: "Từ chối",
            variant: "warning",
            action: async () => {
                const success = await rejectRequest();
                if (success) onStatusChange?.("none");
            },
        });
    };

    const handleCancelRequest = () => {
        setConfirmModal({
            title: "Hủy lời mời kết bạn",
            message: "Bạn có chắc muốn hủy lời mời kết bạn đã gửi?",
            confirmText: "Hủy lời mời",
            variant: "warning",
            action: async () => {
                const success = await cancelRequest();
                if (success) onStatusChange?.("none");
            },
        });
    };

    const handleUnfriend = () => {
        setConfirmModal({
            title: "Hủy kết bạn",
            message: `Bạn có chắc muốn hủy kết bạn${targetUsername ? ` với ${targetUsername}` : ""}?`,
            confirmText: "Hủy kết bạn",
            variant: "danger",
            action: async () => {
                const success = await unfriend();
                if (success) {
                    onStatusChange?.("none");
                    onFriendRemoved?.();
                }
            },
        });
    };

    const containerClass = layout === "vertical" ? "flex flex-col gap-2" : "flex flex-row gap-2";

    const modal = confirmModal && (
        <ConfirmModal
            open
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            cancelText="Hủy"
            variant={confirmModal.variant}
            onConfirm={async () => {
                const act = confirmModal.action;
                setConfirmModal(null);
                await act();
            }}
            onCancel={() => setConfirmModal(null)}
        />
    );

    // Render based on status
    switch (status) {
        case "none":
            return (
                <>
                {modal}
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
                </>
            );

        case "pending_sent":
            return (
                <>
                {modal}
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
                </>
            );

        case "pending_received":
            return (
                <>
                {modal}
                <div className={containerClass}>
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
                </>
            );

        case "friends":
            return (
                <>
                {modal}
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
                </>
            );

        case "blocked":
        case "blocked_by":
            return null;

        default:
            return modal ?? null;
    }
}
