import { useState, useEffect, useCallback } from "react";
import { Ban, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import blockService from "../../services/blockService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import ConfirmModal from "../common/ConfirmModal";
import { useFriendDataSafe } from "../../contexts/FriendDataContext";

interface BlockUnblockButtonProps {
    userId: number;
    username: string;
    // Optional: pre-loaded block status (to avoid extra API call)
    initialIsBlocked?: boolean;
    // If true, skip the initial API check (use when parent already loaded the status)
    skipInitialCheck?: boolean;
    iconOnly?: boolean;
    // Callback when block status changes
    onBlockStatusChange?: (userId: number, isBlocked: boolean) => void;
}

export default function BlockUnblockButton({ 
    userId, 
    username,
    initialIsBlocked,
    skipInitialCheck = false,
    iconOnly = false,
    onBlockStatusChange,
}: BlockUnblockButtonProps) {
    const currentUser = useCurrentUser();
    const [isBlocked, setIsBlocked] = useState(initialIsBlocked ?? false);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(!skipInitialCheck);
    const [showConfirm, setShowConfirm] = useState(false);
    const { triggerRefreshAll } = useFriendDataSafe();

    const checkBlockStatus = useCallback(async () => {
        // Skip if parent already provided the status
        if (skipInitialCheck) {
            setChecking(false);
            return;
        }
        
        // Wait for currentUser - keep checking state as true
        if (!currentUser?.id) {
            return;
        }

        setChecking(true);
        try {
            // Get list of blocked users and check if this user is in it
            const blockedUsers = await blockService.getBlockedUsers(currentUser.id);
            const blocked = blockedUsers.some((u) => u.id === userId);
            setIsBlocked(blocked);
        } catch (error) {
            console.error("Error checking block status:", error);
        } finally {
            setChecking(false);
        }
    }, [currentUser?.id, userId, skipInitialCheck]);

    useEffect(() => {
        checkBlockStatus();
    }, [checkBlockStatus]);

    // Update isBlocked when initialIsBlocked prop changes
    useEffect(() => {
        if (initialIsBlocked !== undefined) {
            setIsBlocked(initialIsBlocked);
        }
    }, [initialIsBlocked]);

    const handleBlockUnblock = useCallback(() => {
        if (!currentUser?.id) {
            toast.error("Vui lòng đăng nhập để thực hiện hành động này");
            return;
        }
        setShowConfirm(true);
    }, [currentUser]);

    const doBlockUnblock = useCallback(async () => {
        if (!currentUser?.id) return;
        setShowConfirm(false);
        const action = isBlocked ? "bỏ chặn" : "chặn";
        setLoading(true);
        try {
            if (isBlocked) {
                await blockService.unblockUser(currentUser.id, userId);
                setIsBlocked(false);
                onBlockStatusChange?.(userId, false);
                triggerRefreshAll();
                toast.success(`Đã bỏ chặn ${username}`);
            } else {
                await blockService.blockUser(currentUser.id, userId);
                setIsBlocked(true);
                onBlockStatusChange?.(userId, true);
                triggerRefreshAll();
                toast.success(`Đã chặn ${username}`);
            }
        } catch (error: any) {
            console.error("Error block/unblock user:", error);
            toast.error(`Không thể ${action} người dùng. Vui lòng thử lại.`);
        } finally {
            setLoading(false);
        }
    }, [currentUser, isBlocked, userId, username, onBlockStatusChange, triggerRefreshAll]);

    if (!currentUser || checking) {
        return (
            <button
                type="button"
                disabled
                className={
                    iconOnly
                        ? "inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-[#efefef] text-gray-500 dark:bg-[#262626] dark:text-gray-300"
                        : "px-4 py-[7px] rounded-lg bg-gray-200 dark:bg-[#363636] flex items-center justify-center"
                }
            >
                <Loader2 className="animate-spin" size={16} />
            </button>
        );
    }

    return (
        <>
        <ConfirmModal
            open={showConfirm}
            title={isBlocked ? "Bỏ chặn người dùng" : "Chặn người dùng"}
            message={`Bạn có chắc chắn muốn ${isBlocked ? "bỏ chặn" : "chặn"} "${username}"?`}
            confirmText={isBlocked ? "Bỏ chặn" : "Chặn"}
            cancelText="Hủy"
            variant={isBlocked ? "warning" : "danger"}
            onConfirm={doBlockUnblock}
            onCancel={() => setShowConfirm(false)}
        />
        <button
            onClick={handleBlockUnblock}
            disabled={loading}
            title={isBlocked ? "Bỏ chặn" : "Chặn"}
            className={
                iconOnly
                    ? `inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-[#dbdbdb] transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#363636] ${
                          isBlocked
                              ? "bg-[#efefef] text-gray-700 hover:bg-[#dbdbdb] dark:bg-[#262626] dark:text-gray-200 dark:hover:bg-[#363636]"
                              : "bg-[#efefef] text-red-600 hover:bg-red-50 dark:bg-[#262626] dark:text-red-400 dark:hover:bg-red-900/20"
                      }`
                    : `px-4 py-[7px] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                          isBlocked
                              ? "bg-gray-500 hover:bg-gray-600 text-white"
                              : "bg-red-500 hover:bg-red-600 text-white"
                      }`
            }
        >
            {loading ? (
                <Loader2 className="animate-spin" size={16} />
            ) : (
                <Ban size={16} />
            )}
            {!iconOnly && <span>{isBlocked ? "Bỏ chặn" : "Chặn"}</span>}
        </button>
        </>
    );
}
