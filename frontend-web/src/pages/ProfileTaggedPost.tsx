import { useParams, useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";
import PostGrid from "../components/profile/PostGrid";
import axios from "axios";
import type { User } from "../types";

const API_BASE_URL = "http://localhost:8080/api";

interface Post {
  id: string;
  authorId: string;
  content: string;
  privacy: string;
  media: Array<{
    url: string;
    type: string;
  }>;
  location?: {
    name: string;
  };
  hashtags: string[];
  mentions: string[];
  stats: {
    reactCount: number;
    commentCount: number;
    shareCount: number;
    viewCount: number;
  };
  createdAt: string;
}

interface OutletContext {
  user: User;
  isOwnProfile: boolean;
}

export default function ProfileTaggedPost() {
  const { user, isOwnProfile } = useOutletContext<OutletContext>();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTaggedPosts = async () => {
      try {
        if (!user) return;

        setLoading(true);
        // Fetch posts where user is tagged
        const postsResponse = await axios.get(
          `${API_BASE_URL}/posts/tagged/${user.id}`
        );

        if (postsResponse.data.success) {
          const postsData = postsResponse.data.data;

          // Fetch author data for each post
          const transformedPostsPromises = postsData.map(async (post: Post) => {
            try {
              const authorResponse = await axios.get(
                `${API_BASE_URL}/auth/user/${post.authorId}`
              );
              const authorData = authorResponse.data.data;

              return {
                id: post.id,
                imageUrl:
                  post.media && post.media.length > 0
                    ? post.media[0].url
                    : null,
                likes: post.stats?.reactCount || 0,
                comments: post.stats?.commentCount || 0,
                caption: post.content,
                privacy: post.privacy,
                images: [
                  post.media && post.media.length > 0 ? post.media[0].url : "",
                ],
                user: {
                  id: authorData.id.toString(),
                  username: authorData.username,
                  fullName: authorData.name || authorData.username,
                  avatar:
                    authorData.avatarUrl || "https://i.pravatar.cc/150?img=5",
                },
              };
            } catch (error) {
              console.error("Error fetching author for post:", post.id, error);
              return null;
            }
          });

          const transformedPosts = (
            await Promise.all(transformedPostsPromises)
          ).filter((post) => post !== null);
          setPosts(transformedPosts);
        }
      } catch (error) {
        console.error("Error fetching tagged posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTaggedPosts();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Chưa có bài viết nào được gắn thẻ
      </div>
    );
  }

  return <PostGrid posts={posts} />;
}
