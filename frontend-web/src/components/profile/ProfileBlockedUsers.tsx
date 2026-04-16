import { useState, useEffect } from "react";
import { Ban, Loader2, AlertCircle } from "lucide-react";
import type { User } from "../../types";
import { friendService } from "../../services/friendService";
import { buildS3Url } from "../../utils/s3";

interface ProfileBlockedUsersProps {
  userId: string | number;
  isOwnProfile: boolean;
}

export default function ProfileBlockedUsers({
  userId,
  isOwnProfile,
}: ProfileBlockedUsersProps) {
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOwnProfile) {
      setLoading(false);
      return;
    }

    const loadBlockedUsers = async () => {
      setLoading(true);
      setError("");
      try {
        const users = await friendService.getBlockedUsers(userId);
        setBlockedUsers(users || []);
      } catch (err) {
        console.error("Error loading blocked users:", err);
        setError("Không thể tải danh sách người dùng bị chặn");
      } finally {
        setLoading(false);
      }
    };

    loadBlockedUsers();
  }, [userId, isOwnProfile]);

  if (!isOwnProfile) {
    return (
      <div className="text-center py-24">
        <Ban size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold dark:text-white mb-2">
          Danh sách bị chặn
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Bạn không có quyền xem danh sách này
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-gray-400" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertCircle size={24} />
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (blockedUsers.length === 0) {
    return (
      <div className="text-center py-24">
        <Ban size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold dark:text-white mb-2">
          Chưa chặn ai
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Những người bạn chặn sẽ hiển thị ở đây
        </p>
      </div>
    );
  }

  const handleUnblock = async (blockedId: string | number) => {
    try {
      await friendService.unblockUser({
        senderId: Number(userId),
        receivedId: Number(blockedId),
      });
      setBlockedUsers((prev) =>
        prev.filter((u) => u.id !== blockedId)
      );
    } catch (err) {
      console.error("Error unblocking user:", err);
      alert("Không thể bỏ chặn. Vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-4">
      {blockedUsers.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors"
        >
          <img
            src={buildS3Url(user.avatarUrl) || user.avatarUrl || "https://i.pravatar.cc/150"}
            alt={user.username}
            className="w-14 h-14 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold dark:text-white truncate text-base">
              {user.fullName || user.name || user.username}
            </p>
            {user.username && (
              <p className="text-gray-600 dark:text-gray-400 truncate text-sm">
                @{user.username}
              </p>
            )}
          </div>
          <button
            onClick={() => handleUnblock(user.id)}
            className="px-5 py-2 bg-gray-200 dark:bg-[#262626] hover:bg-gray-300 dark:hover:bg-[#363636] dark:text-white rounded-lg font-medium transition-colors text-sm"
          >
            Bỏ chặn
          </button>
        </div>
      ))}
    </div>
  );
}
