import { Link, useLocation } from "react-router-dom";
import { Heart, MessageCircle, Plus } from "lucide-react";
import { buildS3Url } from "../../utils/s3";
import type { Post } from "../../types";

interface PostGridProps {
  posts: Post[];
  isOwnProfile?: boolean;
}

export default function PostGrid({
  posts,
  isOwnProfile = false,
}: PostGridProps) {
  const location = useLocation();

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Create New Post Card - Only show for own profile */}
      {isOwnProfile && (
        <Link
          to="/create"
          className="aspect-[4/5] relative group overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center hover:from-purple-200 hover:to-blue-200 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 transition-all border-2 border-dashed border-gray-300 dark:border-gray-600"
        >
          <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Plus size={32} className="text-[#0095f6]" />
            </div>
            <span className="text-sm font-semibold">Create Post</span>
          </div>
        </Link>
      )}

      {posts.map((post) => {
        const imageUrl = (post as any).imageUrl || post.images?.[0];
        const likesCount = (post as any).likes ?? post.likes ?? 0;
        const commentsCount = (post as any).comments ?? 0;

        return (
          <Link
            key={post.id}
            to={`/post/${post.id}`}
            state={{ from: location.pathname }}
            className="aspect-[4/5] relative group overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
          >
            {imageUrl ? (
              <img
                src={buildS3Url(imageUrl) || imageUrl}
                alt={post.caption}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 px-4 text-center line-clamp-3">
                  {post.caption || "No content"}
                </p>
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white">
              <div className="flex items-center gap-2 font-semibold">
                <Heart size={20} fill="white" />
                <span>{likesCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 font-semibold">
                <MessageCircle size={20} fill="white" />
                <span>{commentsCount.toLocaleString()}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
