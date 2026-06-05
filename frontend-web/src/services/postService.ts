/**
 * Post Data Service
 * Handles all API calls for post-related operations
 */

import axiosClient from "../api/axiosClient";
import type { PostData, UserData, CommentData } from "../types/post";
import { uploadMediaAndGetFormat, buildS3Url } from "../utils/s3";

export type MediaKind = "video" | "image";

export const detectMediaKind = (
    url?: string,
    explicitType?: string
): MediaKind => {
    const normalizedType = (explicitType || "").toLowerCase();
    if (normalizedType.includes("video")) {
        return "video";
    }

    const lower = (url || "").toLowerCase();
    if (
        /\.(mp4|webm|mov|avi|mkv)(\?|#|$)/.test(lower) ||
        lower.includes("/videos/")
    ) {
        return "video";
    }

    return "image";
};

export const isVideoMedia = (url?: string, explicitType?: string): boolean => {
    return detectMediaKind(url, explicitType) === "video";
};

export const formatMediaDuration = (durationSeconds?: number | null): string => {
    const totalSeconds = Math.max(0, Math.floor(Number(durationSeconds || 0)));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export interface MediaUploadMetadataPayload {
    duration?: number;
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    originalFileName?: string;
}

const readVideoMetadata = (file: File): Promise<{ duration?: number; width?: number; height?: number }> => {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            video.removeAttribute("src");
            video.load();
        };

        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const duration = Number.isFinite(video.duration)
                ? Math.max(0, Math.floor(video.duration))
                : undefined;
            resolve({
                duration,
                width: video.videoWidth || undefined,
                height: video.videoHeight || undefined,
            });
            cleanup();
        };
        video.onerror = () => {
            resolve({});
            cleanup();
        };

        video.src = objectUrl;
    });
};

const readImageMetadata = (file: File): Promise<{ width?: number; height?: number }> => {
    return new Promise((resolve) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
        };

        image.onload = () => {
            resolve({
                width: image.naturalWidth || undefined,
                height: image.naturalHeight || undefined,
            });
            cleanup();
        };
        image.onerror = () => {
            resolve({});
            cleanup();
        };

        image.src = objectUrl;
    });
};

const extractMediaUploadMetadata = async (file: File): Promise<MediaUploadMetadataPayload> => {
    const base: MediaUploadMetadataPayload = {
        fileSize: file.size,
        mimeType: file.type || undefined,
        originalFileName: file.name || undefined,
    };

    if (file.type.startsWith("video/")) {
        const videoMeta = await readVideoMetadata(file);
        return { ...base, ...videoMeta };
    }

    if (file.type.startsWith("image/")) {
        const imageMeta = await readImageMetadata(file);
        return { ...base, ...imageMeta };
    }

    return base;
};

/**
 * Transform media array to full S3 URLs
 * Builds complete S3 path: posts/{authorId}/images/{filename}
 */
export const transformMediaToS3Urls = (
    media: Array<{ url: string; type: string; order?: number }> | undefined,
    authorId: string
): string[] => {
    if (!media || media.length === 0) return [];

    return media
        .map((m: any) => {
            const rawUrl = (m?.url || "").toString().trim();
            if (!rawUrl) return "";

            // Already absolute URL.
            if (/^https?:\/\//i.test(rawUrl)) {
                return rawUrl;
            }

            let key = rawUrl;

            // Strip query / fragment if any key accidentally contains them.
            const queryIndex = key.indexOf("?");
            if (queryIndex >= 0) key = key.substring(0, queryIndex);
            const fragmentIndex = key.indexOf("#");
            if (fragmentIndex >= 0) key = key.substring(0, fragmentIndex);

            const normalizedKey = key.startsWith("/") ? key.substring(1) : key;

            // Common persisted key formats.
            if (
                normalizedKey.startsWith("posts/") ||
                normalizedKey.startsWith("images/") ||
                normalizedKey.startsWith("videos/") ||
                normalizedKey.startsWith("files/") ||
                normalizedKey.startsWith("audios/") ||
                normalizedKey.startsWith("users/") ||
                normalizedKey.startsWith("conversations/") ||
                normalizedKey.startsWith("stories/")
            ) {
                return buildS3Url(normalizedKey) || "";
            }

            const s3Path = `posts/${authorId}/images/${normalizedKey}`;
            return buildS3Url(s3Path) || "";
        });
};

/**
 * Fetch post details by ID
 */
export const fetchPostById = async (postId: string): Promise<PostData> => {
    console.log(`📥 Fetching post: ${postId}`);
    const response = await axiosClient.get(`/posts/${postId}`);
    console.log("✅ Post response:", response.data);

    if (!response.data.data) {
        throw new Error("No post data in response");
    }

    return response.data.data;
};

/**
 * Fetch current authenticated viewer id
 */
export const fetchCurrentViewerId = async (): Promise<string> => {
    const response = await axiosClient.get(`/auth/me`);
    const meData = response.data?.data ?? response.data;
    return String(meData?.id ?? "").trim();
};

/**
 * Fetch user data by ID
 */
export const fetchUserById = async (userId: string | number): Promise<UserData> => {
    console.log(`📥 Fetching user: ${userId}`);
    const response = await axiosClient.get(`/auth/user/${userId}`);
    console.log("✅ User response:", response.data);

    if (!response.data.data) {
        throw new Error("No user data in response");
    }

    const userData = response.data.data;
    return {
        ...userData,
        avatarUrl:
            buildS3Url(userData.avatarUrl) ||
            userData.avatarUrl ||
            "https://i.pravatar.cc/150?img=5",
    };
};

/**
 * Fetch post author display identity without applying profile privacy masking.
 * This mirrors story author summaries and is only for post surfaces.
 */
export const fetchPostAuthorById = async (userId: string | number): Promise<UserData> => {
    console.log(`📥 Fetching post author: ${userId}`);
    let response;
    try {
        response = await axiosClient.get(`/posts/authors/${userId}/summary`);
        console.log("✅ Post author response:", response.data);
    } catch (error: any) {
        if (error?.response?.status !== 403) {
            throw error;
        }

        console.warn("Post author summary forbidden, falling back to profile endpoint:", userId);
        response = await axiosClient.get(`/auth/user/${userId}`);
        console.log("✅ User fallback response:", response.data);
    }

    if (!response.data.data) {
        throw new Error("No post author data in response");
    }

    const userData = response.data.data;
    return {
        ...userData,
        avatarUrl:
            buildS3Url(userData.avatarUrl) ||
            userData.avatarUrl ||
            "https://i.pravatar.cc/150?img=5",
    };
};

/**
 * Fetch multiple users by IDs
 */
export const fetchUsersByIds = async (userIds: string[]): Promise<UserData[]> => {
    const promises = userIds.map((userId) =>
        axiosClient.get(`/auth/user/${userId}`).catch(() => null)
    );
    const responses = await Promise.all(promises);
    return responses
        .filter((res) => res !== null)
        .map((res) => {
            const userData = res!.data.data;
            return {
                ...userData,
                avatarUrl:
                    buildS3Url(userData.avatarUrl) ||
                    userData.avatarUrl ||
                    "https://i.pravatar.cc/150?img=5",
            };
        });
};

/**
 * Fetch comments for a post
 */
export const fetchPostComments = async (postId: string): Promise<CommentData[]> => {
    console.log(`📥 Fetching comments for post: ${postId}`);
    const response = await axiosClient.get(`/comments`, {
        params: { targetType: "POST", targetId: postId },
    });
    console.log("✅ Comments response:", response.data);

    // Filter only top-level comments (no parentId)
    const allComments = response.data.data || [];
    return allComments.filter((comment: CommentData) => !comment.parentId);
};

/**
 * Fetch replies for a comment
 */
export const fetchCommentReplies = async (commentId: string): Promise<CommentData[]> => {
    console.log(`📥 Fetching replies for comment: ${commentId}`);
    const response = await axiosClient.get(`/comments`, {
        params: { parentId: commentId },
    });
    return response.data.data || [];
};

/**
 * Fetch reactions count for a post
 */
export const fetchPostReactionsCount = async (postId: string): Promise<number> => {
    console.log(`📥 Fetching reactions for post: ${postId}`);
    const response = await axiosClient.get(`/reactions`, {
        params: { targetType: "POST", targetId: postId },
    });
    console.log("✅ Reactions response:", response.data);
    return response.data.data?.length || 0;
};

/**
 * Fetch user's current reaction on a post
 */
export const fetchUserReaction = async (
    userId: string,
    postId: string
): Promise<{ type: string } | null> => {
    try {
        console.log(`📥 Fetching user reaction for post: ${postId}, user: ${userId}`);
        const response = await axiosClient.get(`/reactions/user`, {
            params: {
                userId,
                targetType: "POST",
                targetId: postId,
            },
        });
        console.log("✅ Reaction response:", response.data);
        return response.data.data || null;
    } catch (error) {
        console.log("⚠️ Error fetching reaction:", error);
        return null;
    }
};

/**
 * Check if post is saved
 */
export const checkPostSaved = async (
    userId: string,
    postId: string
): Promise<boolean> => {
    console.log(`📥 Checking save status for post: ${postId}, user: ${userId}`);
    const response = await axiosClient.get(`/saved-posts/check`, {
        params: { userId, postId },
    });
    console.log("✅ Save status response:", response.data);
    return response.data.data || false;
};

/**
 * Submit a comment on a post
 */
export const submitComment = async (
    userId: string,
    postId: string,
    content: string
): Promise<CommentData> => {
    console.log(`📝 Submitting comment on post: ${postId}`);
    const response = await axiosClient.post(
        `/comments?userId=${userId}`,
        {
            targetType: "POST",
            targetId: postId,
            content,
        }
    );
    console.log("✅ Comment submitted:", response.data);
    return response.data.data;
};

/**
 * Delete a comment
 */
export const deleteComment = async (
    commentId: string,
    userId: string
): Promise<void> => {
    console.log(`🗑️ Deleting comment: ${commentId}`);
    await axiosClient.delete(`/comments/${commentId}?userId=${userId}`);
    console.log("✅ Comment deleted");
};

/**
 * Submit reaction on a post
 */
export const togglePostReaction = async (
    userId: string,
    postId: string,
    reactionType: string
): Promise<any> => {
    console.log(`😊 Toggling reaction on post: ${postId}, type: ${reactionType}`);
    const response = await axiosClient.post(`/reactions/toggle`, null, {
        params: {
            userId,
            targetType: "POST",
            targetId: postId,
            reactionType,
        },
    });
    console.log("✅ Reaction toggled:", response.data);
    return response.data.data;
};

/**
 * Toggle save status for a post
 */
export const togglePostSaved = async (
    userId: string,
    postId: string
): Promise<void> => {
    console.log(`💾 Toggling save status for post: ${postId}`);
    await axiosClient.post(`/saved-posts/toggle`, null, {
        params: { userId, postId },
    });
    console.log("✅ Save status toggled");
};

/**
 * Update post privacy (simplified version)
 */
export const updatePostPrivacy = async (
    userId: string | number,
    postId: string,
    newPrivacy: string
): Promise<PostData> => {
    console.log(`🔒 Updating post privacy: ${postId} to ${newPrivacy}`);

    const formData = new FormData();
    const postData = {
        privacy: newPrivacy,
    };

    formData.append("postData", JSON.stringify(postData));

    const response = await axiosClient.put(`/posts/${postId}?userId=${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    console.log("✅ Privacy updated:", response.data);
    return response.data.data;
};

// S3 functions are now in utils/s3.ts - imported at the top of this file

/**
 * Update post with full data (for edit operations)
 */
export const updatePost = async (
    userId: string | number,
    postId: string,
    postData: any,
    newImages: File[] = []
): Promise<PostData> => {
    console.log(`✏️ Updating post: ${postId}`);
    console.log("📦 Post data:", postData);
    console.log("📸 New images count:", newImages.length);

    const uploadedImageUrls: string[] = [];
    const mediaMetadatas: MediaUploadMetadataPayload[] = [];

    try {
        // Step 1: Upload new images to S3 if there are any
        if (newImages.length > 0) {
            console.log(`📤 Starting upload for ${newImages.length} images...`);

            for (const imageFile of newImages) {
                try {
                    const metadata = await extractMediaUploadMetadata(imageFile);
                    mediaMetadatas.push(metadata);
                    // Use s3 utility to upload and get the uuid.extension format
                    const uuidWithExt = await uploadMediaAndGetFormat(imageFile);
                    uploadedImageUrls.push(uuidWithExt);
                    console.log(`✅ Image uploaded and added to list: ${uuidWithExt}`);
                } catch (error: any) {
                    console.error(`❌ Failed to upload ${imageFile.name}:`, error);
                    throw new Error(`Failed to upload image: ${imageFile.name}`);
                }
            }
        }

        // Step 2: Update post with multipart form-data body.
        console.log("📝 Uploading post metadata with image URLs...");
        console.log("Image URLs to send:", uploadedImageUrls);

        const payload = {
            ...postData,
            mediaMetadatas,
        };

        const formData = new FormData();
        formData.append("postData", JSON.stringify(payload));
        uploadedImageUrls.forEach((url) => {
            formData.append("imageUrls", url);
        });

        const response = await axiosClient.put(
            `/posts/${postId}?userId=${userId}`,
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        console.log("✅ Post updated response:", response.data);

        if (!response.data.data) {
            throw new Error("No post data in response");
        }

        return response.data.data;
    } catch (error: any) {
        console.error("❌ Error in updatePost:", error);
        console.error("Response status:", error?.response?.status);
        console.error("Full response data:", JSON.stringify(error?.response?.data, null, 2));
        console.error("Error message from response:", error?.response?.data?.message);
        throw error;
    }
};

/**
 * Delete a post
 */
export const deletePost = async (postId: string, userId: string): Promise<void> => {
    console.log(`🗑️ Deleting post: ${postId}`);
    await axiosClient.delete(`/posts/${postId}?userId=${userId}`);
    console.log("✅ Post deleted");
};

/**
 * Search users for mentions
 */
export const searchUsers = async (
    _userId: string,
    query: string
): Promise<UserData[]> => {
    try {
        console.log(`🔍 Searching users with query: ${query}`);
        // Endpoint in UserController.java: @GetMapping("/users/username/{keyword}")
        const response = await axiosClient.get(`/auth/users/username/${query}`);

        // The backend returns List<User> directly in the response body (response.data)
        const users = Array.isArray(response.data) ? response.data : (response.data?.data || []);

        return users.map((user: any) => ({
            id: user.id.toString(),
            username: user.username,
            name: user.name || user.username,
            avatarUrl: user.avatarUrl || "https://i.pravatar.cc/150?img=5",
        }));
    } catch (error) {
        console.error("❌ Error searching users:", error);
        return [];
    }
};

/**
 * Search mention suggestions (friends only) with pagination
 */
export const searchMentionUsers = async (
    viewerId: string,
    query: string,
    page: number = 0,
    size: number = 10
): Promise<{ data: UserData[], hasMore: boolean }> => {
    try {
        console.log(`🔍 Searching mention users for ${viewerId}, query: ${query}, page: ${page}`);
        const response = await axiosClient.get(`/auth/users/mentions`, {
            params: { viewerId, query, page, size },
        });

        const paginatedData = response.data.data;
        const users = (paginatedData.data || []).map((user: any) => ({
            id: user.id.toString(),
            username: user.username,
            name: user.name || user.username,
            avatarUrl: user.avatarUrl || "https://i.pravatar.cc/150?img=5",
        }));

        return {
            data: users,
            hasMore: paginatedData.hasMore,
        };
    } catch (error) {
        console.error("❌ Error searching mention users:", error);
        return { data: [], hasMore: false };
    }
};



/**
 * Create a new post with optional images
 */
export const createPost = async (
    userId: string | number,
    postData: any,
    imageFiles: File[] = []
): Promise<PostData> => {
    try {
        console.log(`✏️ Creating new post for user: ${userId}`);
        console.log("Post data:", postData);
        console.log("Image files count:", imageFiles.length);

        const uploadedImageUrls: string[] = [];
        const mediaMetadatas: MediaUploadMetadataPayload[] = [];

        // Step 1: Upload images to S3 if there are any
        if (imageFiles.length > 0) {
            console.log(`📤 Starting upload for ${imageFiles.length} images...`);

            for (const imageFile of imageFiles) {
                try {
                    const metadata = await extractMediaUploadMetadata(imageFile);
                    mediaMetadatas.push(metadata);
                    // Use s3 utility to upload and get the uuid.extension format
                    const uuidWithExt = await uploadMediaAndGetFormat(imageFile);
                    uploadedImageUrls.push(uuidWithExt);
                    console.log(`✅ Image uploaded and added to list: ${uuidWithExt}`);
                } catch (error: any) {
                    console.error(`❌ Failed to upload ${imageFile.name}:`, error);
                    throw new Error(`Failed to upload image: ${imageFile.name}`);
                }
            }
        }

        // Step 2: Create post with image URLs
        console.log("📝 Creating post with image URLs...");
        console.log("Image URLs to send:", uploadedImageUrls);

        const payload = {
            ...postData,
            mediaMetadatas,
        };

        const formData = new FormData();
        formData.append("postData", JSON.stringify(payload));
        uploadedImageUrls.forEach((url) => {
            formData.append("imageUrls", url);
        });

        const response = await axiosClient.post(
            `/posts?userId=${userId}`,
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        console.log("✅ Post created response:", response.data);

        if (!response.data.data) {
            throw new Error("No post data in response");
        }

        return response.data.data;
    } catch (error: any) {
        console.error("❌ Error in createPost:", error);
        console.error("Response status:", error?.response?.status);
        console.error("Full response data:", JSON.stringify(error?.response?.data, null, 2));
        console.error("Error message from response:", error?.response?.data?.message);
        throw error;
    }
};

/**
 * Create a post on a Page, reusing the same media-upload pipeline as the wall
 * composer (createPost). Uploads files to S3 first, then submits the S3 keys
 * plus the post payload to the page endpoint.
 */
export const createPagePost = async (
    pageId: string | number,
    postData: any,
    imageFiles: File[] = []
): Promise<any> => {
    try {
        const uploadedImageUrls: string[] = [];
        const mediaMetadatas: MediaUploadMetadataPayload[] = [];

        if (imageFiles.length > 0) {
            for (const imageFile of imageFiles) {
                try {
                    const metadata = await extractMediaUploadMetadata(imageFile);
                    mediaMetadatas.push(metadata);
                    const uuidWithExt = await uploadMediaAndGetFormat(imageFile);
                    uploadedImageUrls.push(uuidWithExt);
                } catch (error) {
                    console.error(`❌ Failed to upload ${imageFile.name}:`, error);
                    throw new Error(`Failed to upload image: ${imageFile.name}`);
                }
            }
        }

        const payload = { ...postData, mediaMetadatas };

        const formData = new FormData();
        formData.append("pageId", String(pageId));
        formData.append("postData", JSON.stringify(payload));
        uploadedImageUrls.forEach((url) => {
            formData.append("images", url);
        });

        const response = await axiosClient.post(`page/post/add`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return response.data.data;
    } catch (error: any) {
        console.error("❌ Error in createPagePost:", error);
        throw error;
    }
};

/**
 * Get all saved posts by user ID
 */
export const getSavedPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    try {
        console.log(`📥 Fetching saved posts for user: ${userId}`);
        const savedResponse = await axiosClient.get(`/saved-posts/user?userId=${userId}`);

        if (!savedResponse.data.success) {
            return [];
        }

        const savedPostsData = savedResponse.data.data || [];

        // Fetch each post's details with author info
        const postDetailsPromises = savedPostsData.map(async (savedPost: any) => {
            try {
                const postResponse = await axiosClient.get(`/posts/${savedPost.targetId}`);
                const post = postResponse.data.data;

                const authorData = post.authorSummary || await fetchPostAuthorById(post.authorId);

                const images = transformMediaToS3Urls(post.media, post.authorId);
                const imageUrl = images && images.length > 0 ? images[0] : null;
                const media = (post.media || []).map((m: any, index: number) => ({
                    url: images[index] || "",
                    type: (m?.type || "image").toLowerCase(),
                    duration: typeof m?.duration === "number" ? m.duration : undefined,
                }));

                return {
                    id: post.id,
                    imageUrl: imageUrl,
                    likes: post.stats?.reactCount || 0,
                    comments: post.stats?.commentCount || 0,
                    caption: post.content,
                    privacy: post.privacy,
                    allowComments: post.allowComments !== false,
                    allowShares: post.allowShares !== false,
                    images: images,
                    media,
                    user: {
                        id: authorData.id.toString(),
                        username: authorData.username,
                        fullName: authorData.name || authorData.username,
                        avatar: authorData.avatarUrl || "https://i.pravatar.cc/150?img=5",
                    },
                };
            } catch (error) {
                console.error(`❌ Error fetching saved post:`, error);
                return null;
            }
        });

        const transformedPosts = (await Promise.all(postDetailsPromises)).filter(
            (post) => post !== null
        );
        console.log(`✅ Saved posts fetched: ${transformedPosts.length}`);
        return transformedPosts;
    } catch (error) {
        console.error("❌ Error fetching saved posts:", error);
        throw error;
    }
};

/**
 * Get all posts tagged with a user
 */
export const getTaggedPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    try {
        console.log(`📥 Fetching tagged posts for user: ${userId}`);
        const postsResponse = await axiosClient.get(`/posts/tagged/${userId}`);

        if (!postsResponse.data.success) {
            return [];
        }

        const postsData = postsResponse.data.data || [];

        // Fetch author data for each post
        const transformedPostsPromises = postsData.map(async (post: any) => {
            try {
                const authorData = post.authorSummary || await fetchPostAuthorById(post.authorId);

                const rawMedia = post.media || post.mediaList || [];
                const images = transformMediaToS3Urls(rawMedia, post.authorId);
                const firstImage = images && images.length > 0 ? images[0] : null;
                const media = rawMedia.map((m: any, index: number) => ({
                    ...m,
                    url: images[index] || (m?.url || ""),
                    type: (m?.type || "image").toLowerCase(),
                    duration: typeof m?.duration === "number" ? m.duration : undefined,
                }));

                return {
                    id: post.id,
                    imageUrl: firstImage,
                    likes: post.stats?.reactCount || 0,
                    comments: post.stats?.commentCount || 0,
                    caption: post.content,
                    privacy: post.privacy,
                    allowComments: post.allowComments !== false,
                    allowShares: post.allowShares !== false,
                    images: images,
                    media,
                    user: {
                        id: authorData.id.toString(),
                        username: authorData.username,
                        fullName: authorData.fullName || authorData.name || authorData.username,
                        avatar: authorData.avatarUrl || "https://i.pravatar.cc/150?img=5",
                    },
                };
            } catch (error) {
                console.error(`❌ Error fetching author for tagged post ${post.id}:`, error);

                const rawMedia = post.media || post.mediaList || [];
                const images = transformMediaToS3Urls(rawMedia, post.authorId);
                return {
                    id: post.id,
                    imageUrl: images && images.length > 0 ? images[0] : null,
                    likes: post.stats?.reactCount || 0,
                    comments: post.stats?.commentCount || 0,
                    caption: post.content,
                    privacy: post.privacy,
                    images: images,
                    media: rawMedia.map((m: any, index: number) => ({
                        ...m,
                        url: images[index] || (m?.url || ""),
                        type: (m?.type || "image").toLowerCase()
                    })),
                };
            }
        });

        const transformedPosts = (await Promise.all(transformedPostsPromises)).filter(
            (post) => post !== null
        );
        console.log(`✅ Tagged posts fetched: ${transformedPosts.length}`);
        return transformedPosts;
    } catch (error) {
        console.error("❌ Error fetching tagged posts:", error);
        throw error;
    }
};

/**
 * Share a post
 */
export const sharePost = async (postId: string, content?: string): Promise<any> => {
    try {
        const response = await axiosClient.post("/post-shares", {}, {
            params: {
                postId,
                content: content || ""
            }
        });
        return response.data.data;
    } catch (error) {
        console.error("❌ Error sharing post:", error);
        throw error;
    }
};

/**
 * Get shared posts for a user
 */
export const getSharedPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    try {
        console.log(`📥 Fetching shared posts for user: ${userId}`);
        const response = await axiosClient.get(`/post-shares/user/${userId}`);

        if (!response.data.success) {
            return [];
        }

        const sharesData = response.data.data || [];

        // Fetch full post details for each shared post
        const transformedPostsPromises = sharesData.map(async (share: any) => {
            try {
                // We use the originalPostId to get the actual post content
                const postResponse = await axiosClient.get(`/posts/${share.originalPostId}`);
                const post = postResponse.data.data;

                if (!post) return null;

                // Fetch author data for the original post
                const authorData = post.authorSummary || await fetchPostAuthorById(post.authorId);

                const rawMedia = post.media || post.mediaList || [];
                const images = transformMediaToS3Urls(rawMedia, post.authorId);
                const firstImage = images && images.length > 0 ? images[0] : null;
                const media = rawMedia.map((m: any, index: number) => ({
                    ...m,
                    url: images[index] || (m?.url || ""),
                    type: (m?.type || "image").toLowerCase(),
                }));

                return {
                    id: post.id,
                    shareId: share.id, // Keep track of the share ID
                    shareContent: share.content, // The caption added when sharing
                    imageUrl: firstImage,
                    likes: post.stats?.reactCount || 0,
                    comments: post.stats?.commentCount || 0,
                    caption: post.content,
                    privacy: post.privacy,
                    images: images,
                    media,
                    user: {
                        id: authorData.id.toString(),
                        username: authorData.username,
                        fullName: authorData.fullName || authorData.name || authorData.username,
                        avatar: authorData.avatarUrl || "https://i.pravatar.cc/150?img=5",
                    },
                };
            } catch (err) {
                console.error(`Error fetching original post for share ${share.id}:`, err);
                return null;
            }
        });

        const transformedPosts = (await Promise.all(transformedPostsPromises)).filter(
            (post) => post !== null
        );

        console.log(`✅ Shared posts fetched: ${transformedPosts.length}`);
        return transformedPosts;
    } catch (error) {
        console.error("❌ Error fetching shared posts:", error);
        return [];
    }
};

/**
 * Get all posts by user ID
 */
export const getUserPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    try {
        console.log(`📥 Fetching posts for user: ${userId}`);
        const response = await axiosClient.get(`/posts/user/${userId}`);
        const rawData = response.data?.data ?? response.data;
        const postsData = Array.isArray(rawData)
            ? rawData
            : Array.isArray(rawData?.content)
                ? rawData.content
                : [];

        const transformedPosts = postsData.map((post: any) => {
            const authorId = post.authorId || userId.toString();
            const rawMedia = post.media || post.mediaList || [];
            const images = transformMediaToS3Urls(rawMedia, authorId);
            const firstImage = images && images.length > 0 ? images[0] : null;
            const media = rawMedia.map((m: any, index: number) => ({
                ...m,
                url: images[index] || (m?.url || ""),
                type: (m?.type || "image").toLowerCase(),
                duration: typeof m?.duration === "number" ? m.duration : undefined,
            }));

            return {
                id: post.id,
                imageUrl: firstImage,
                likes: post.stats?.reactCount || 0,
                comments: post.stats?.commentCount || 0,
                caption: post.content,
                privacy: post.privacy,
                images: images,
                media,
            };
        });

        console.log(`✅ User posts fetched: ${transformedPosts.length}`);
        return transformedPosts;
    } catch (error) {
        console.error("❌ Error fetching user posts:", error);
        throw error;
    }
};

export const getUserPostsCount = async (userId: string | number): Promise<number> => {
    try {
        const response = await axiosClient.get(`/posts/user/${userId}/count`);
        const countData = response.data?.data ?? response.data;
        const count = typeof countData === "number" ? countData : Number(countData);
        return Number.isFinite(count) ? count : 0;
    } catch (error) {
        console.error("❌ Error fetching user posts count:", error);
        return 0;
    }
};

/**
 * Get user by username
 */
export const getUserByUsername = async (username: string): Promise<any> => {
    try {
        console.log(`📥 Fetching user: ${username}`);
        const response = await axiosClient.get(`/auth/user/${username}`);

        if (!response.data.success) {
            return null;
        }

        const userData = response.data.data;
        return {
            id: userData.id.toString(),
            username: userData.username,
            fullName: userData.name || userData.username,
            avatarUrl:
                buildS3Url(userData.avatarUrl) ||
                userData.avatarUrl ||
                "https://i.pravatar.cc/150?img=5",
            bio: userData.bio,
            friendsCount: userData.friendCount || 0,
            followersCount: userData.followerCount || 0,
            followingCount: userData.followingCount || 0,
            postsCount: userData.postCount || 0,
        };
    } catch (error) {
        console.error("❌ Error fetching user:", error);
        throw error;
    }
};

/**
 * Get post with all tagged user details
 */
export const getPostWithTaggedUsers = async (postId: string): Promise<any> => {
    try {
        console.log(`📥 Fetching post with tags: ${postId}`);
        const response = await axiosClient.get(`/posts/${postId}`);
        const post = response.data.data;

        let taggedUsers: string[] = [];
        if (post.taggedUserIds && post.taggedUserIds.length > 0) {
            const taggedUsersResponses = await Promise.all(
                post.taggedUserIds.map((userId: string) =>
                    axiosClient.get(`/auth/user/${userId}`).catch(() => null)
                )
            );
            taggedUsers = taggedUsersResponses
                .filter((res) => res !== null)
                .map((res) => res!.data.data.username);
        }

        return {
            ...post,
            taggedUsernames: taggedUsers,
        };
    } catch (error) {
        console.error("❌ Error fetching post with tags:", error);
        throw error;
    }
};
