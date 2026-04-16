import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, Loader2 } from "lucide-react";
import { buildS3Url } from "../../utils/s3";
import type { User } from "../../types";

interface FriendRequestItemProps {
    user: User;
    type: "received" | "sent";
    onAccept?: (userId: number) => Promise<void>;
    onReject?: (userId: number) => Promise<void>;
    onCancel?: (userId: number) => Promise<void>;
}

export default function FriendRequestItem({
    user,
    type,
    onAccept,
    onReject,
    onCancel,
}: FriendRequestItemProps) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleAccept = async () => {
        if (!onAccept) return;
        setActionLoading("accept");
        try {
            await onAccept(user.id);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!onReject) return;
        setActionLoading("reject");
        try {
            await onReject(user.id);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async () => {
        if (!onCancel) return;
        const confirmed = window.confirm("Bạn có chắc muốn hủy lời mời kết bạn?");
        if (!confirmed) return;
        
        setActionLoading("cancel");
        try {
            await onCancel(user.id);
        } finally {
            setActionLoading(null);
        }
    };

    const avatarUrl = buildS3Url(user.avatarUrl) || user.avatarUrl || "https://i.pravatar.cc/150";
    const displayName = user.fullName || user.name || user.username;

    return (
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors rounded-lg">
            {/* User Info */}
            <Link
                to={`/profile/${user.username}`}
                className="flex items-center gap-3 flex-1 min-w-0"
            >
                <img
                    src={avatarUrl}
                    alt={user.username}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                    <p className="font-semibold dark:text-white truncate">
                        {user.username}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {displayName}
                    </p>
                </div>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {type === "received" ? (
                    <>
                        {/* Accept Button */}
                        <button
                            onClick={handleAccept}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            {actionLoading === "accept" ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <Check size={16} />
                            )}
                            <span>Chấp nhận</span>
                        </button>

                        {/* Reject Button */}
                        <button
                            onClick={handleReject}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1 px-4 py-2 bg-gray-200 dark:bg-[#363636] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#454545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            {actionLoading === "reject" ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <X size={16} />
                            )}
                            <span>Từ chối</span>
                        </button>
                    </>
                ) : (
                    /* Cancel Button for Sent Requests */
                    <button
                        onClick={handleCancel}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1 px-4 py-2 bg-gray-200 dark:bg-[#363636] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#454545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        {actionLoading === "cancel" ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <X size={16} />
                        )}
                        <span>Hủy lời mời</span>
                    </button>
                )}
            </div>
        </div>
    );
}
