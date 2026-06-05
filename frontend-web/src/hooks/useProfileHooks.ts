import { useState, useEffect, useCallback } from "react";
import useRealtimePosts from "./useRealtimePosts";
import {
    getSavedPostsWithDetails,
    getTaggedPostsWithDetails,
    getSharedPostsWithDetails,
    getUserPostsWithDetails,
    getUserByUsername,
    getPostWithTaggedUsers,
    transformMediaToS3Urls,
} from "../services/postService";
import { friendService } from "../services/friendService";
import type { User } from "../types";

/**
 * Hook for fetching saved posts
 */
export const useProfileSavedPosts = (user: User | null) => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError(null);
                const savedPosts = await getSavedPostsWithDetails(user.id);
                setPosts(savedPosts);
            } catch (err: any) {
                console.error("Error fetching saved posts:", err);
                setError(err.message || "Failed to load saved posts");
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, [user]);

    return { posts, loading, error };
};

/**
 * Hook for fetching tagged posts
 */
export const useProfileTaggedPosts = (user: User | null) => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError(null);
                const taggedPosts = await getTaggedPostsWithDetails(user.id);
                setPosts(taggedPosts);
            } catch (err: any) {
                console.error("Error fetching tagged posts:", err);
                setError(err.message || "Failed to load tagged posts");
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, [user]);

    return { posts, loading, error };
};

/**
 * Hook for fetching user's own posts
 */
export const useProfileMyPosts = (user: User | null) => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const transformPost = useCallback((post: any) => {
        if (!user) return post;
        // Robust fallback for authorId
        const authorId = post.authorId || user.id.toString();
        const rawMedia = post.media || post.mediaList || [];
        const images = transformMediaToS3Urls(rawMedia, authorId);

        // Transform the media array itself to contain full URLs
        const transformedMedia = rawMedia.map((m: any, index: number) => ({
            ...m,
            url: images[index] || m.url,
            type: (m.type || "image").toLowerCase()
        }));

        return {
            ...post,
            imageUrl: images && images.length > 0 ? images[0] : null,
            images: images,
            media: transformedMedia,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                avatar: user.avatarUrl,
            },
        };
    }, [user]);

    // Realtime updates
    useRealtimePosts({
        topic: user ? `/topic/user/${user.id}/posts` : undefined,
        onPostCreated: (newPost) => {
            setPosts(prev => [transformPost(newPost), ...prev]);
        },
        onPostUpdated: (updatedPost) => {
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? transformPost(updatedPost) : p));
        },
        onPostDeleted: (postId) => {
            setPosts(prev => prev.filter(p => p.id !== postId));
        }
    });

    useEffect(() => {
        const fetchPosts = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError(null);
                let postsData = await getUserPostsWithDetails(user.id);

                // Build S3 URLs if needed
                postsData = postsData.map((post: any) => transformPost(post));

                setPosts(postsData);
            } catch (err: any) {
                console.error("Error fetching user posts:", err);
                setError(err.message || "Failed to load posts");
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, [user, transformPost]);

    return { posts, loading, error };
};

/**
 * Hook for fetching shared posts
 */
export const useProfileSharedPosts = (user: User | null) => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError(null);
                const sharedPosts = await getSharedPostsWithDetails(user.id);
                setPosts(sharedPosts);
            } catch (err: any) {
                console.error("Error fetching shared posts:", err);
                setError(err.message || "Failed to load shared posts");
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, [user]);

    return { posts, loading, error };
};

/**
 * Hook for fetching user profile by username
 */
export const useUserProfile = (username: string | undefined) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            if (!username) return;

            try {
                setLoading(true);
                setError(null);
                const userData = await getUserByUsername(username);

                if (userData) {
                    setUser({
                        id: userData.id,
                        username: userData.username,
                        fullName: userData.fullName,
                        avatarUrl: userData.avatarUrl,
                        bio: userData.bio,
                        friendsCount: userData.friendsCount,
                        followersCount: userData.followersCount,
                        followingCount: userData.followingCount,
                        postsCount: userData.postsCount,
                    } as User);
                }
            } catch (err: any) {
                console.error("Error fetching user:", err);
                setError(err.message || "Failed to load user");
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [username]);

    return { user, loading, error };
};

/**
 * Hook for fetching post data for editing
 */
export const useEditPostData = (postId: string | undefined) => {
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) return;

            try {
                setLoading(true);
                setError(null);
                const postData = await getPostWithTaggedUsers(postId);
                setPost(postData);
            } catch (err: any) {
                console.error("Error fetching post:", err);
                setError(err.message || "Failed to load post");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [postId]);

    return { post, loading, error };
};

/**
 * Hook for fetching user friends
 */
export const useUserFriends = (userId: string | number | undefined) => {
    const [friends, setFriends] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserFriends = async () => {
            if (!userId) return;

            try {
                setLoading(true);
                setError(null);
                const friendsList = await friendService.getFriends(userId);
                setFriends(friendsList);
            } catch (err: any) {
                console.error("Error fetching friends:", err);
                setError(err.message || "Failed to load friends");
            } finally {
                setLoading(false);
            }
        };

        fetchUserFriends();
    }, [userId]);

    return { friends, loading, error };
};


