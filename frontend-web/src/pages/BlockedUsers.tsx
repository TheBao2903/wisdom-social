import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { UserX, Loader2, AlertCircle } from "lucide-react";
import userService from "../services/userService";
import friendService from "../services/friendService";
import type { User } from "../types";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";

export default function BlockedUsers() {
    const currentUser = useCurrentUser();
    const [activeTab, setActiveTab] = useState<"blocked-by-me" | "blocked-me">("blocked-by-me");
    const [blockedByMe, setBlockedByMe] = useState<User[]>([]);
    const [blockedMe, setBlockedMe] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [unblockingUserId, setUnblockingUserId] = useState<Number | null>(null);

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
            const [blocked] = await Promise.all([
                userService.getUsersBlockedByMe(currentUser.id),
            ]);
            setBlockedByMe(blocked);
        } catch (err: any) {
            console.error("Error loading blocked users:", err);
            setError("Không thể tải danh sách. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handleUnblockUser = async (userId: number, username: string) => {
        if (!currentUser) return;

        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn bỏ chặn "${username}"?`
        );

        if (!confirmed) return;

        setUnblockingUserId(userId);
        try {
            await friendService.unblockUser({
                senderId: currentUser.id,
                receivedId: userId,
            });

            // Remove from list
            setBlockedByMe((prev) => prev.filter((u) => u.id !== userId));
            alert(`Đã bỏ chặn "${username}" thành công!`);
        } catch (err: any) {
            console.error("Error unblocking user:", err);
            alert("Không thể bỏ chặn user. Vui lòng thử lại.");
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

    const displayList = activeTab === "blocked-by-me" ? blockedByMe : blockedMe;
    const isEmpty = displayList.length === 0;

    return (
        <div className="min-h-screen bg-white dark:bg-[#000]">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-[#262626] sticky top-0 bg-white dark:bg-[#000] z-10">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold dark:text-white">Quản lý Chặn</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Xem và quản lý danh sách người bị chặn
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-[#262626] sticky top-16 bg-white dark:bg-[#000] z-10">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab("blocked-by-me")}
                            className={`py-4 px-1 font-semibold border-b-2 transition-colors ${
                                activeTab === "blocked-by-me"
                                    ? "border-blue-500 text-blue-500 dark:text-blue-400"
                                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            Tôi đã chặn ({blockedByMe.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("blocked-me")}
                            className={`py-4 px-1 font-semibold border-b-2 transition-colors ${
                                activeTab === "blocked-me"
                                    ? "border-blue-500 text-blue-500 dark:text-blue-400"
                                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            Chặn tôi ({blockedMe.length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
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
                            {activeTab === "blocked-by-me"
                                ? "Bạn chưa chặn ai"
                                : "Chưa ai chặn bạn"}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {activeTab === "blocked-by-me"
                                ? "Bạn chưa chặn user nào"
                                : "May mắn thay, chưa ai chặn bạn"}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#262626]">
                            <h2 className="text-lg font-semibold dark:text-white">
                                {activeTab === "blocked-by-me"
                                    ? `Danh sách chặn của bạn (${blockedByMe.length})`
                                    : `Danh sách chặn bạn (${blockedMe.length})`}
                            </h2>
                        </div>

                        <div className="divide-y divide-gray-200 dark:divide-[#262626]">
                            {displayList.map((user) => (
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

                                    {activeTab === "blocked-by-me" && (
                                        <button
                                            onClick={() => handleUnblockUser(user.id, user.username)}
                                            disabled={unblockingUserId === user.id}
                                            className="ml-4 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
