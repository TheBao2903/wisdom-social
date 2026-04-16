import { useState, useEffect, useCallback } from "react";
import { Ban, Loader2 } from "lucide-react";
import friendService from "../../services/friendService";
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface BlockUnblockButtonProps {
    userId: number;
    username: string;
    // Optional: pre-loaded block status (to avoid extra API call)
    initialIsBlocked?: boolean;
    // If true, skip the initial API check (use when parent already loaded the status)
    skipInitialCheck?: boolean;
    // Callback when block status changes
    onBlockStatusChange?: (userId: number, isBlocked: boolean) => void;
}

export default function BlockUnblockButton({ 
    userId, 
    username,
    initialIsBlocked,
    skipInitialCheck = false,
    onBlockStatusChange,
}: BlockUnblockButtonProps) {
    const currentUser = useCurrentUser();
    const [isBlocked, setIsBlocked] = useState(initialIsBlocked ?? false);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(!skipInitialCheck);

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
            const blockedUsers = await friendService.getBlockedUsers(currentUser.id);
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

    const handleBlockUnblock = useCallback(async () => {
        if (!currentUser) {
            alert("Vui lòng đăng nhập để thực hiện hành động này");
            return;
        }

        if (!currentUser.id) {
            console.error("❌ currentUser.id is undefined:", currentUser);
            alert("Lỗi: Không thể lấy ID người dùng hiện tại");
            return;
        }

        const action = isBlocked ? "bỏ chặn" : "chặn";
        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn ${action} "${username}"?`
        );

        if (!confirmed) return;

        setLoading(true);
        try {
            const requestData = {
                senderId: currentUser.id,
                receivedId: userId,
            };

            if (isBlocked) {
                await friendService.unblockUser(requestData);
                setIsBlocked(false);
                onBlockStatusChange?.(userId, false);
                alert(`Đã bỏ chặn "${username}" thành công!`);
            } else {
                await friendService.blockUser(requestData);
                setIsBlocked(true);
                onBlockStatusChange?.(userId, true);
                alert(`Đã chặn "${username}" thành công!`);
            }
        } catch (error: any) {
            console.error("Error block/unblock user:", error);
            alert(`Không thể ${action} user. Vui lòng thử lại.`);
        } finally {
            setLoading(false);
        }
    }, [currentUser, isBlocked, userId, username, onBlockStatusChange]);

    // Don't render anything until currentUser is available
    if (!currentUser) {
        return (
            <div className="px-4 py-[7px] bg-gray-200 dark:bg-[#363636] rounded-lg">
                <Loader2 className="animate-spin" size={16} />
            </div>
        );
    }

    if (checking) {
        return (
            <div className="px-4 py-[7px] bg-gray-200 dark:bg-[#363636] rounded-lg">
                <Loader2 className="animate-spin" size={16} />
            </div>
        );
    }

    return (
        <button
            onClick={handleBlockUnblock}
            disabled={loading}
            className={`px-4 py-[7px] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 ${
                isBlocked
                    ? "bg-gray-500 hover:bg-gray-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
            }`}
        >
            {loading ? (
                <Loader2 className="animate-spin" size={16} />
            ) : (
                <Ban size={16} />
            )}
            {isBlocked ? "Unblock" : "Block"}
        </button>
    );
}
