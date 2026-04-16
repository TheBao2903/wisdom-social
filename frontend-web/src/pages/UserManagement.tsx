import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import userService from "../services/userService";
import { User } from "../types";

export default function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        setError("");
        try {
            const allUsers = await userService.getAllUsers();
            setUsers(allUsers);
        } catch (err: any) {
            console.error("Error loading users:", err);
            setError("Không thể tải danh sách users. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn xóa user "${username}"? Hành động này không thể hoàn tác.`
        );

        if (!confirmed) return;

        setDeletingUserId(userId);
        try {
            await userService.deleteUser(userId);
            // Remove from list
            setUsers((prev) => prev.filter((u) => u.id !== userId));
            alert(`Đã xóa user "${username}" thành công!`);
        } catch (err: any) {
            console.error("Error deleting user:", err);
            alert("Không thể xóa user. Vui lòng thử lại.");
        } finally {
            setDeletingUserId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#000] flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#000]">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-[#262626] sticky top-0 bg-white dark:bg-[#000] z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold dark:text-white">User Management</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Quản lý tất cả users trong hệ thống
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626]">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-[#262626]">
                        <h2 className="text-lg font-semibold dark:text-white">
                            Tất cả Users ({users.length})
                        </h2>
                    </div>

                    <div className="divide-y divide-gray-200 dark:divide-[#262626]">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <img
                                        src={user.avatar || "https://i.pravatar.cc/150"}
                                        alt={user.username}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            to={`/profile/${user.username}`}
                                            className="font-semibold dark:text-white hover:underline"
                                        >
                                            {user.username}
                                        </Link>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                            {user.fullName || user.name}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            ID: {user.id}
                                        </p>
                                    </div>
                                    {user.isVerified && (
                                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                                            Verified
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                    disabled={deletingUserId === user.id}
                                    className="ml-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {deletingUserId === user.id ? (
                                        <>
                                            <Loader2 className="animate-spin" size={16} />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={16} />
                                            Delete
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    {users.length === 0 && !loading && (
                        <div className="px-6 py-12 text-center">
                            <p className="text-gray-500 dark:text-gray-400">
                                Không có user nào trong hệ thống
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
