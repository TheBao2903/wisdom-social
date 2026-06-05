import { useState, useEffect } from "react";

import { UserX, Loader2, AlertCircle, ShieldOff } from "lucide-react";
import blockService from "../services/blockService";
import type { User } from "../types";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";
import ConfirmModal from "../components/common/ConfirmModal";

export default function BlockedUsers() {
    const currentUser = useCurrentUser();
    const [blockedByMe, setBlockedByMe] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [unblockingUserId, setUnblockingUserId] = useState<number | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ userId: number; username: string } | null>(null);
    const [notification, setNotification] = useState("");

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    const loadData = async () => {
        if (!currentUser) return;

        setLoading(true);
        setError("");
        try {
            const blocked = await blockService.getBlockedUsers(currentUser.id);
            setBlockedByMe(blocked);
        } catch (err: any) {
            console.error("Error loading blocked users:", err);
            setError("Không thể tải danh sách. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handleUnblockUser = (userId: number, username: string) => {
        if (!currentUser) return;
        setConfirmModal({ userId, username });
    };

    const doUnblock = async () => {
        if (!currentUser || !confirmModal) return;
        const { userId, username } = confirmModal;
        setConfirmModal(null);
        setUnblockingUserId(userId);
        try {
            await blockService.unblockUser(currentUser.id, userId);
            setBlockedByMe((prev) => prev.filter((u) => u.id !== userId));
        } catch (err: any) {
            console.error("Error unblocking user:", err);
            setNotification(`Không thể bỏ chặn "${username}". Vui lòng thử lại.`);
        } finally {
            setUnblockingUserId(null);
        }
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#000] flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">
                    Vui lòng đăng nhập để xem danh sách
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#000] flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    const isEmpty = blockedByMe.length === 0;

    return (
        <div className="min-h-screen bg-white dark:bg-[#000]">
            <ConfirmModal
                open={!!confirmModal}
                title="Bỏ chặn người dùng"
                message={`Bạn có chắc chắn muốn bỏ chặn "${confirmModal?.username}"?`}
                confirmText="Bỏ chặn"
                cancelText="Hủy"
                variant="warning"
                onConfirm={doUnblock}
                onCancel={() => setConfirmModal(null)}
            />
            <ConfirmModal
                open={!!notification}
                title="Lỗi"
                message={notification}
                variant="warning"
                onConfirm={() => setNotification("")}
            />
            <div className="border-b border-gray-200 dark:border-[#262626] sticky top-0 bg-white dark:bg-[#000] z-10">
                <div className="max-w-3xl mx-auto px-4 py-5">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                            <ShieldOff size={22} className="text-red-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold dark:text-white">Quản lý Chặn</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Xem và quản lý danh sách người bị chặn
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {isEmpty ? (
                    <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626] p-12 text-center">
                        <UserX size={48} className="mx-auto text-gray-400 mb-4" />
                        <h2 className="text-lg font-semibold dark:text-white mb-2">
                            Bạn chưa chặn ai
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Khi bạn chặn một người dùng, họ sẽ xuất hiện trong danh sách này.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#262626]">
                            <h2 className="text-lg font-semibold dark:text-white">
                                Danh sách chặn của bạn ({blockedByMe.length})
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Người trong danh sách này không thể tìm thấy bạn, xem hồ sơ của bạn hoặc kết bạn với bạn.
                            </p>
                        </div>

                        <div className="divide-y divide-gray-200 dark:divide-[#262626]">
                            {blockedByMe.map((user) => (
                                <div
                                    key={user.id.toString()}
                                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <img
                                            src={buildS3Url(user.avatarUrl) || "https://i.pravatar.cc/150"}
                                            alt={user.username}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold dark:text-white">
                                                {user.username}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                {user.fullName || user.name}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleUnblockUser(user.id, user.username)}
                                        disabled={unblockingUserId === user.id}
                                        className="ml-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-[#262626] dark:hover:bg-[#333] dark:text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {unblockingUserId === user.id ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="animate-spin" size={16} />
                                                Bỏ chặn...
                                            </span>
                                        ) : (
                                            "Bỏ chặn"
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
