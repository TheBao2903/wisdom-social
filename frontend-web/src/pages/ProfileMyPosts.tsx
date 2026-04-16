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

export default function ProfileMyPosts() {
  const { username } = useParams();
  const { user, isOwnProfile } = useOutletContext<OutletContext>();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        if (!user) return;

        setLoading(true);
        // Fetch user's posts
        const postsResponse = await axios.get(
          `${API_BASE_URL}/posts/user/${user.id}`
        );

        if (postsResponse.data.success) {
          const postsData = postsResponse.data.data;
          // Transform posts to match PostGrid expected format
          const transformedPosts = postsData.map((post: Post) => {
            return {
              id: post.id,
              imageUrl:
                post.media && post.media.length > 0 ? post.media[0].url : null,
              likes: post.stats?.reactCount || 0,
              comments: post.stats?.commentCount || 0,
              caption: post.content,
              privacy: post.privacy,
              images: [
                post.media && post.media.length > 0 ? post.media[0].url : "",
              ],
              user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                avatar: user.avatar,
              },
            };
          });
          setPosts(transformedPosts);
        }
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    );
  }

  return <PostGrid posts={posts} isOwnProfile={isOwnProfile} />;
}
