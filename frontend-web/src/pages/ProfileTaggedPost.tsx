import { useOutletContext } from "react-router-dom";
import { UserSquare2 } from "lucide-react";
import PostGrid from "../components/profile/PostGrid";
import PrivateAccountLock from "../components/profile/PrivateAccountLock";
import { useProfileTaggedPosts } from "../hooks/useProfileHooks";
import type { User } from "../types";

interface OutletContext {
  user: User;
  isOwnProfile: boolean;
}

export default function ProfileTaggedPost() {
  const { user, isOwnProfile } = useOutletContext<OutletContext>();
  const { posts, loading, error } = useProfileTaggedPosts(user);

  if (!isOwnProfile && user.isPrivate) {
    return <PrivateAccountLock />;
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <div className="w-20 h-20 rounded-full border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center mb-4">
          <UserSquare2 size={40} strokeWidth={1} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Ảnh có mặt bạn
        </h3>
        <p className="text-sm text-center max-w-xs">
          Khi mọi người gắn thẻ bạn trong ảnh, ảnh đó sẽ xuất hiện tại đây.
        </p>
      </div>
    );
  }

  return <PostGrid posts={posts} />;
}
