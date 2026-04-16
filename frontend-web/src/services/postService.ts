/**
 * Post Data Service
 * Handles all API calls for post-related operations
 */

import axiosClient from "../api/axiosClient";
import type { PostData, UserData, CommentData } from "../types/postType"; import { uploadImageAndGetFormat } from "../utils/s3";
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
 * Fetch user data by ID
 */
export const fetchUserById = async (userId: string | number): Promise<UserData> => {
    console.log(`📥 Fetching user: ${userId}`);
    const response = await axiosClient.get(`/auth/user/${userId}`);
    console.log("✅ User response:", response.data);

    if (!response.data.data) {
        throw new Error("No user data in response");
    }

    return response.data.data;
};

/**
 * Fetch multiple users by IDs
 */
export const fetchUsersByIds = async (userIds: string[]): Promise<UserData[]> => {
    const promises = userIds.map((userId) =>
        axiosClient.get(`/auth/user/${userId}`).catch(() => null)
    );
    const responses = await Promise.all(promises);
    return responses.filter((res) => res !== null).map((res) => res!.data.data);
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

    try {
        // Step 1: Upload new images to S3 if there are any
        if (newImages.length > 0) {
            console.log(`📤 Starting upload for ${newImages.length} images...`);

            for (const imageFile of newImages) {
                try {
                    // Use s3 utility to upload and get the uuid.extension format
                    const uuidWithExt = await uploadImageAndGetFormat(imageFile);
                    uploadedImageUrls.push(uuidWithExt);
                    console.log(`✅ Image uploaded and added to list: ${uuidWithExt}`);
                } catch (error: any) {
                    console.error(`❌ Failed to upload ${imageFile.name}:`, error);
                    throw new Error(`Failed to upload image: ${imageFile.name}`);
                }
            }
        }

        // Step 2: Update post with imageUrls parameter
        console.log("📝 Uploading post metadata with image URLs...");
        console.log("Image URLs to send:", uploadedImageUrls);

        // Build query parameters (uploadedImageUrls already contains uuid.extension format)
        const params = new URLSearchParams();
        params.append("postData", JSON.stringify(postData));

        uploadedImageUrls.forEach((url) => {
            params.append("imageUrls", url);
        });

        console.log("📤 Sending to backend with params:", params.toString());

        const response = await axiosClient.put(
            `/posts/${postId}?userId=${userId}&${params.toString()}`
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
    userId: string,
    query: string
): Promise<UserData[]> => {
    console.log(`🔍 Searching users with query: ${query}`);
    const response = await axiosClient.get(`/auth/user/search`, {
        params: { userId, query },
    });
    console.log("✅ Search results:", response.data);
    return response.data.data || [];
};

/**
 * Submit reaction on a comment
 */
export const toggleCommentReaction = async (
    userId: string,
    commentId: string,
    reactionType: string
): Promise<any> => {
    console.log(`😊 Toggling reaction on comment: ${commentId}`);
    const response = await axiosClient.post(`/reactions/toggle`, null, {
        params: {
            userId,
            targetType: "COMMENT",
            targetId: commentId,
            reactionType,
        },
    });
    console.log("✅ Comment reaction toggled:", response.data);
    return response.data.data;
};

/**
 * Fetch reactions count for a comment
 */
export const fetchCommentReactionsCount = async (commentId: string): Promise<number> => {
    console.log(`📥 Fetching reactions for comment: ${commentId}`);
    const response = await axiosClient.get(`/reactions`, {
        params: { targetType: "COMMENT", targetId: commentId },
    });
    return response.data.data?.length || 0;
};

/**
 * Fetch user's reaction on a comment
 */
export const fetchUserCommentReaction = async (
    userId: string,
    commentId: string
): Promise<{ type: string } | null> => {
    try {
        console.log(`📥 Fetching user reaction on comment: ${commentId}`);
        const response = await axiosClient.get(`/reactions/user`, {
            params: {
                userId,
                targetType: "COMMENT",
                targetId: commentId,
            },
        });
        return response.data.data || null;
    } catch (error) {
        return null;
    }
};

/**
 * Fetch friends list for a user
 */
export const fetchFriends = async (userId: string | number): Promise<UserData[]> => {
    try {
        console.log(`📥 Fetching friends for user: ${userId}`);
        const response = await axiosClient.get(`/users/${userId}/friends`);
        console.log("Friends response:", response.data);

        // Parse response if needed
        let friendsData = response.data;
        if (typeof friendsData === "string") {
            friendsData = JSON.parse(friendsData);
        }

        // Map friends data to expected format
        const mappedFriends = (friendsData.data || friendsData || []).map(
            (friend: any) => ({
                id: friend.userId?.toString() || friend.id?.toString(),
                username: friend.username,
                name: friend.name || friend.fullName,
                avatarUrl:
                    friend.avatarUrl || friend.avatar || "https://i.pravatar.cc/150?img=5",
            })
        );

        return mappedFriends;
    } catch (error: any) {
        console.error(`❌ Error fetching friends for user ${userId}:`, error);
        return [];
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

        // Step 1: Upload images to S3 if there are any
        if (imageFiles.length > 0) {
            console.log(`📤 Starting upload for ${imageFiles.length} images...`);

            for (const imageFile of imageFiles) {
                try {
                    // Use s3 utility to upload and get the uuid.extension format
                    const uuidWithExt = await uploadImageAndGetFormat(imageFile);
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

        // Build query parameters (uploadedImageUrls already contains uuid.extension format)
        const params = new URLSearchParams();
        params.append("postData", JSON.stringify(postData));

        // Add each image URL as a separate query parameter
        uploadedImageUrls.forEach((url) => {
            params.append("imageUrls", url);
        });

        console.log("📤 Sending to backend with params:", params.toString());

        const response = await axiosClient.post(
            `/posts?${params.toString()}`
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