import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import StoriesBar from "../components/story/StoriesBar";
import PostCard from "../components/post/post-card/PostCard";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { fetchHomeFeedPosts, normalizePost } from "../services/homeFeedService";
import useRealtimePosts from "../hooks/useRealtimePosts";
import * as postApi from "../services/postService";
import type { Post } from "../types";

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [postsMap, setPostsMap] = useState<Map<string, Post>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  const feedPosts = Array.from(postsMap.values());

  const handlePostCreated = useCallback(async (newPost: any) => {
    console.log("🔥 WebSocket: NEW_POST received", newPost);
    toast.success("New post created!");
    try {
      const authorData = await postApi.fetchPostAuthorById(newPost.authorId);
      const normalized = normalizePost(newPost, authorData);
      setPostsMap((prev) => {
        const next = new Map(prev);
        next.set(normalized.id, normalized);
        return next;
      });
    } catch (err) {
      console.error("Error normalizing created post:", err);
    }
  }, []);

  const handlePostUpdated = useCallback((updatedPost: any) => {
    console.log("🔥 WebSocket: POST_UPDATED received", updatedPost);
    setPostsMap((prev) => {
      const postId = updatedPost.id;
      const existing = prev.get(postId);
      if (!existing) return prev;

      const next = new Map(prev);
      next.set(postId, { ...existing, ...updatedPost });
      return next;
    });
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    console.log("🔥 WebSocket: POST_DELETED received", postId);
    setPostsMap((prev) => {
      if (!prev.has(postId)) return prev;
      const next = new Map(prev);
      next.delete(postId);
      return next;
    });
  }, []);

  const handleActivityBump = useCallback(
    (postId: string, lastActivityAt: string, actorId?: string) => {
      console.log("🔥 WebSocket: BUMP received", postId, lastActivityAt, "actor:", actorId);

      setPostsMap((prev) => {
        const existing = prev.get(postId);
        if (!existing) return prev;

        const next = new Map(prev);
        next.set(postId, { ...existing, lastActivityAt });
        return next;
      });
    },
    []
  );

  // Listen to global post events
  useRealtimePosts({
    topic: "/topic/posts",
    onPostCreated: handlePostCreated,
    onPostUpdated: handlePostUpdated,
    onPostDeleted: handlePostDeleted,
    onActivityBump: handleActivityBump,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchPosts = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);

        if (!currentUser?.id) {
          if (isMounted) setLoading(false);
          return;
        }

        if (isMounted) setError(null);

        const routeBoostPostId = (
          location.state as { boostPostId?: string } | null
        )?.boostPostId;
        const storedBoostPostId =
          sessionStorage.getItem("homeBoostPostId") || undefined;
        const boostPostId = routeBoostPostId || storedBoostPostId;

        const feedResult = await fetchHomeFeedPosts(200, {
          prioritizePostId: boostPostId,
        });

        if (!isMounted) return;

        if (isMounted) {
          setPostsMap(() => {
            const next = new Map<string, Post>();
            feedResult.posts.forEach((post) => {
              next.set(post.id, post);
            });
            return next;
          });
          // Update pagination state
          nextCursorRef.current = feedResult.nextCursorLastActivityAt;
          setHasMore(feedResult.hasNext);
          setError(null);

          if (boostPostId) {
            sessionStorage.removeItem("homeBoostPostId");
            navigate(location.pathname, { replace: true, state: null });
          }
        }
      } catch (err: any) {
        console.error("❌ Error fetching posts:", err);
        if (isMounted) {
          setError(err.response?.data?.message || "Failed to load posts");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPosts();

    return () => {
      isMounted = false;
    };
  }, [currentUser, location.pathname, location.state, navigate]);

  // Load more handler for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !nextCursorRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const feedResult = await fetchHomeFeedPosts(200, {
        lastActivityAt: nextCursorRef.current || undefined,
      });

      if (feedResult.posts.length === 0) {
        setHasMore(false);
        return;
      }

      setPostsMap((prev) => {
        const next = new Map(prev);
        // Only add posts that don't exist yet (avoid duplicates)
        feedResult.posts.forEach((post) => {
          if (!next.has(post.id)) {
            next.set(post.id, post);
          }
        });
        return next;
      });

      nextCursorRef.current = feedResult.nextCursorLastActivityAt;
      setHasMore(feedResult.hasNext);
    } catch (err) {
      console.error("❌ Error loading more posts:", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = document.getElementById("feed-load-more-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMoreRef.current) {
          void loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="min-h-screen">
      {/* Stories */}
      <StoriesBar />

      <div>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Loading posts...
            </p>
          </div>
        ) : !currentUser ? (
          <div className="p-8 text-center text-gray-500">
            Please login to view posts
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : postsMap.size === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No posts available. Start following friends to see their posts!
          </div>
        ) : (
          <>
            {feedPosts.map((post) => <PostCard key={post.id} post={post} />)}

            {/* Infinite scroll sentinel */}
            <div id="feed-load-more-sentinel" className="py-8 text-center">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 dark:border-white"></div>
                  <span className="text-gray-500">Loading more...</span>
                </div>
              )}
              {!hasMore && !loadingMore && (
                <span className="text-gray-400 text-sm">You've reached the end</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
