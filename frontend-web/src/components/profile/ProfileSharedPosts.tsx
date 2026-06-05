import { Share2, Loader2, AlertCircle } from "lucide-react";
import PostGrid from "./PostGrid";
import { useProfileSharedPosts } from "../../hooks/useProfileHooks";
import type { User } from "../../types";

interface ProfileSharedPostsProps {
  userId: string | number;
  isOwnProfile: boolean;
}

export default function ProfileSharedPosts({
  userId: _userId,
  isOwnProfile,
  user,
}: ProfileSharedPostsProps & { user: User | null }) {
  const { posts, loading, error } = useProfileSharedPosts(user);

  if (!isOwnProfile) {
    return (
      <div className="text-center py-24">
        <Share2 size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold dark:text-white mb-2">
          Danh sách chia sẻ
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Những bài viết được chia sẻ là riêng tư
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-24">
        <Loader2
          size={48}
          className="mx-auto text-gray-400 animate-spin mb-4"
        />
        <p className="text-gray-600 dark:text-gray-400">
          Đang tải danh sách...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-semibold dark:text-white mb-2">Lỗi</h3>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-24">
        <Share2 size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold dark:text-white mb-2">
          Chưa có bài viết nào được chia sẻ
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Các bài viết bạn chia sẻ sẽ xuất hiện ở đây
        </p>
      </div>
    );
  }

  return <PostGrid posts={posts} isOwnProfile={false} />;
}
