import { useOutletContext } from "react-router-dom";
import PostGrid from "../components/profile/PostGrid";
import PrivateAccountLock from "../components/profile/PrivateAccountLock";
import { useProfileSavedPosts } from "../hooks/useProfileHooks";
import type { User } from "../types";

interface OutletContext {
  user: User;
  isOwnProfile: boolean;
}

export default function ProfileSavedPost() {
  const { user, isOwnProfile } = useOutletContext<OutletContext>();
  const { posts, loading, error } = useProfileSavedPosts(user);

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
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Chưa có bài viết nào được lưu
      </div>
    );
  }

  return <PostGrid posts={posts} />;
}
