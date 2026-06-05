import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import PostCard from "../components/post/post-card/PostCard";
import axiosClient from "../api/axiosClient";
import { fetchPostAuthorById, transformMediaToS3Urls } from "../services/postService";
import { buildS3Url } from "../utils/s3";

interface PostData {
  id: string;
  authorId: string;
  content: string;
  privacy?: string;
  media?: Array<{ url: string; type: string; order: number }>;
  stats?: { reactCount: number; commentCount: number; shareCount: number };
  createdAt: string;
  allowComments?: boolean;
  allowShares?: boolean;
  authorSummary?: any;
}

export default function Post() {
  const { id } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await axiosClient.get(`/posts/${id}`);
        const postData: PostData = response.data.data;

        // Fetch user data for the post author
        const userData = postData.authorSummary || await fetchPostAuthorById(postData.authorId);

        // Transform to PostCard format
        const transformedPost = {
          id: postData.id,
          user: {
            id: userData.id,
            username: userData.username,
            fullName: userData.name || userData.username,
            avatarUrl:
              buildS3Url(userData.avatarUrl) ||
              userData.avatarUrl ||
              "https://i.pravatar.cc/150?img=5",
          },
          images:
            postData.media && postData.media.length > 0
              ? transformMediaToS3Urls(postData.media, postData.authorId)
              : [],
          caption: postData.content,
          privacy: postData.privacy as any,
          likes: postData.stats?.reactCount || 0,
          comments: postData.stats?.commentCount || 0,
          shares: postData.stats?.shareCount || 0,
          timestamp: new Date(postData.createdAt).toISOString(),
          allowComments: postData.allowComments !== false,
          allowShares: postData.allowShares !== false,
        };

        setPost(transformedPost);
      } catch (err: any) {
        console.error("Error fetching post:", err);
        setError(err.response?.data?.message || "Failed to load post");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPost();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error || "Post not found"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PostCard post={post} />
    </div>
  );
}
