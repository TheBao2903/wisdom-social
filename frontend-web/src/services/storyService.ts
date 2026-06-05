/**
 * Story Data Service
 * Handles all API calls for story-related operations
 */

import axiosClient from "../api/axiosClient";

/**
 * Get presigned upload URL for story media
 * @param extension File extension (jpg, png, mp4, etc.)
 * @param originalFilename Original filename
 * @param contentType MIME type
 * @returns Presigned URL response from backend
 */
export const getStoryPresignedUploadUrl = async (
    extension: string,
    originalFilename?: string,
    contentType?: string
): Promise<{ presignedUrl: string; objectKey: string; fileName: string }> => {
    try {
        console.log(`📋 [Story] Getting presigned URL for story extension: ${extension}`);

        const params: Record<string, string> = { extension };
        if (originalFilename) params.originalFilename = originalFilename;
        if (contentType) params.contentType = contentType;

        const response = await axiosClient.get("/stories/upload-url", {
            params,
        });

        console.log("📋 [Story] upload-url response:", response);
        console.log("📋 [Story] upload-url response.data:", response.data);

        const responseData = response.data?.data || response.data;
        const presignedUrl = responseData?.presignedUrl;
        const objectKey = responseData?.objectKey;
        const fileName = responseData?.fileName;

        if (!presignedUrl || !objectKey) {
            throw new Error("Missing required fields: presignedUrl, objectKey");
        }

        console.log(`✅ [Story] Got presigned URL`, { objectKey });
        return { presignedUrl, objectKey, fileName: fileName || originalFilename || "" };
    } catch (error: any) {
        console.error(`❌ [Story] Error getting presigned URL:`, error);
        throw new Error("Failed to get presigned upload URL for story: " + (error?.message || "Unknown error"));
    }
};

/**
 * Upload story media file directly to S3
 * @param presignedUrl The presigned PUT URL from backend
 * @param file The File object to upload
 */
export const uploadStoryMediaToS3 = async (presignedUrl: string, file: File): Promise<void> => {
    try {
        console.log(`📤 [Story] Uploading ${file.name} to S3...`);
        console.log(`📤 [Story] File type: ${file.type}, size: ${file.size} bytes`);

        const response = await fetch(presignedUrl, {
            method: "PUT",
            headers: {
                "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
        });

        console.log(`📤 [Story] S3 response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [Story] Upload failed: ${response.status}`);
            console.error(`❌ [Story] Response:`, errorText);
            throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
        }

        const eTag = response.headers.get('etag');
        console.log(`✅ [Story] File ${file.name} uploaded successfully (ETag: ${eTag})`);
    } catch (error: any) {
        console.error(`❌ [Story] Error uploading ${file.name}:`, error);
        throw error;
    }
};

/**
 * Upload story media file to S3 and get S3 key for backend
 * @param file File to upload (image or video)
 * @returns S3 object key for backend (e.g., stories/userId/images/uuid.extension)
 */
export const uploadStoryMediaAndGetFormat = async (file: File): Promise<string> => {
    try {
        const extension = file.name.split(".").pop() || "jpg";
        console.log(`🔄 [Story] Processing media upload for: ${file.name}`);

        // Step 1: Get presigned URL with file metadata
        const { presignedUrl, objectKey } = await getStoryPresignedUploadUrl(
            extension,
            file.name,
            file.type || "application/octet-stream"
        );

        // Step 2: Upload to S3
        await uploadStoryMediaToS3(presignedUrl, file);

        // Step 3: Return S3 object key for backend
        console.log(`✅ [Story] Media upload complete, S3 key: ${objectKey}`);
        return objectKey;
    } catch (error: any) {
        console.error(`❌ [Story] Failed to upload media:`, error);
        throw new Error(`Failed to upload story media ${file.name}: ${error.message}`);
    }
};

/**
 * Create a new story
 * @param content Story text content
 * @param privacy Story privacy level (PUBLIC, FRIENDS, PRIVATE)
 * @param mediaUrls Array of S3 object keys for media (from uploadStoryMediaAndGetFormat)
 */
export const createStory = async (
    params: {
        content?: string;
        textLayers?: any[];
        musicStickers?: any[];
        privacy: string;
        mediaUrls?: string[];
        musicId?: string;
        musicStartTime?: number;
        muteOriginal?: boolean;
    }
): Promise<any> => {
    try {
        console.log(`📝 [Story] Creating story with text_layers:`, params.textLayers?.length || 0, "music_stickers:", params.musicStickers?.length || 0);

        const formData = new FormData();

        // Add basic fields
        if (params.content) formData.append("content", params.content);
        formData.append("privacy", params.privacy);

        // Add text_layers as JSON
        if (params.textLayers && params.textLayers.length > 0) {
            formData.append("text_layers", JSON.stringify(params.textLayers));
        }

        // Add music_stickers as JSON
        if (params.musicStickers && params.musicStickers.length > 0) {
            formData.append("music_stickers", JSON.stringify(params.musicStickers));
        }

        // Add media URLs
        if (params.mediaUrls && params.mediaUrls.length > 0) {
            params.mediaUrls.forEach((url) => {
                formData.append("mediaUrls", url);
            });
        }

        // Add music metadata
        if (params.musicId) {
            formData.append("musicId", params.musicId);
        }
        if (params.musicStartTime !== undefined) {
            formData.append("musicStartTime", Math.round(params.musicStartTime).toString());
        }
        if (params.muteOriginal !== undefined) {
            formData.append("muteOriginal", params.muteOriginal.toString());
        }

        const response = await axiosClient.post("/stories", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        console.log(`✅ [Story] Story created successfully:`, response.data);
        return response.data;
    } catch (error: any) {
        console.error(`❌ [Story] Error creating story:`, error);
        throw new Error("Failed to create story: " + (error?.message || "Unknown error"));
    }
};

/**
 * Fetch user's stories
 * @param userId User ID
 */
export const fetchUserStories = async (userId: string): Promise<any[]> => {
    try {
        console.log(`📥 [Story] Fetching stories for user: ${userId}`);
        const response = await axiosClient.get(`/stories/user/${userId}`);
        console.log(`✅ [Story] Fetched stories:`, response.data);
        return response.data || [];
    } catch (error: any) {
        console.error(`❌ [Story] Error fetching user stories:`, error);
        throw new Error("Failed to fetch stories: " + (error?.message || "Unknown error"));
    }
};

/**
 * Delete a story
 * @param storyId Story ID
 */
export const deleteStory = async (storyId: string): Promise<void> => {
    try {
        console.log(`🗑️ [Story] Deleting story: ${storyId}`);
        await axiosClient.delete(`/stories/${storyId}`);
        console.log(`✅ [Story] Story deleted successfully`);
    } catch (error: any) {
        console.error(`❌ [Story] Error deleting story:`, error);
        throw new Error("Failed to delete story: " + (error?.message || "Unknown error"));
    }
};

/**
 * Get story feed (current user and friends' stories)
 * @param page Page number (optional)
 * @param size Page size (optional)
 */
export const fetchStoryFeed = async (page?: number, size?: number): Promise<any> => {
    try {
        console.log(`📥 [Story] Fetching story feed`);

        const params: Record<string, any> = {};
        if (page !== undefined) params.page = page;
        if (size !== undefined) params.size = size;

        const response = await axiosClient.get("/stories/feed", { params });
        console.log(`✅ [Story] Fetched story feed:`, response.data);
        return response.data;
    } catch (error: any) {
        console.error(`❌ [Story] Error fetching story feed:`, error);
        throw new Error("Failed to fetch story feed: " + (error?.message || "Unknown error"));
    }
};

/**
 * React to a story
 * @param storyId Story ID
 * @param emoji Reaction emoji (optional)
 */
export const reactToStory = async (storyId: string, emoji?: string): Promise<void> => {
    try {
        console.log(`😊 [Story] Reacting to story: ${storyId} with emoji: ${emoji}`);
        await axiosClient.post(`/stories/${storyId}/react`, null, {
            params: emoji ? { emoji } : undefined
        });
        console.log(`✅ [Story] Reaction recorded`);
    } catch (error: any) {
        console.error(`❌ [Story] Error reacting to story:`, error);
        throw new Error("Failed to react to story: " + (error?.message || "Unknown error"));
    }
};

/**
 * Fetch viewers of a story (owner only)
 * @param storyId Story ID
 */
export const fetchStoryViewers = async (storyId: string): Promise<any[]> => {
    try {
        console.log(`👁️ [Story] Fetching viewers for story: ${storyId}`);
        const response = await axiosClient.get(`/stories/${storyId}/viewers`);
        console.log(`✅ [Story] Viewers fetched:`, response.data);
        const data = response.data?.data || response.data;
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error(`❌ [Story] Error fetching story viewers:`, error);
        throw new Error("Failed to fetch story viewers: " + (error?.message || "Unknown error"));
    }
};

/**
 * Record a story view
 * @param storyId Story ID
 */
export const viewStory = async (storyId: string): Promise<void> => {
    try {
        console.log(`👁️ [Story] Recording view for story: ${storyId}`);
        await axiosClient.post(`/stories/${storyId}/view`);
        console.log(`✅ [Story] View recorded successfully`);
    } catch (error: any) {
        console.error(`❌ [Story] Error recording story view:`, error);
    }
};

/**
 * Update story privacy level
 * @param storyId Story ID
 * @param privacy Privacy type (PUBLIC, FRIENDS, PRIVATE)
 */
export const updateStoryPrivacy = async (storyId: string, privacy: string): Promise<any> => {
    try {
        console.log(`🔒 [Story] Updating privacy for story ${storyId} to ${privacy}`);
        const response = await axiosClient.put(`/stories/${storyId}/privacy`, null, {
            params: { privacy }
        });
        console.log(`✅ [Story] Privacy updated successfully:`, response.data);
        return response.data;
    } catch (error: any) {
        console.error(`❌ [Story] Error updating story privacy:`, error);
        throw new Error("Failed to update story privacy: " + (error?.message || "Unknown error"));
    }
};

/**
 * Update story advanced settings
 * @param storyId Story ID
 * @param settings Settings object containing allowReplies, allowReactions, or allowSharing flags
 */
export const updateStorySettings = async (
    storyId: string,
    settings: { allowReplies?: boolean; allowReactions?: boolean; allowSharing?: boolean }
): Promise<any> => {
    try {
        console.log(`⚙️ [Story] Updating settings for story ${storyId}`, settings);
        const response = await axiosClient.put(`/stories/${storyId}/settings`, null, {
            params: settings
        });
        console.log(`✅ [Story] Settings updated successfully:`, response.data);
        return response.data;
    } catch (error: any) {
        console.error(`❌ [Story] Error updating story settings:`, error);
        throw new Error("Failed to update story settings: " + (error?.message || "Unknown error"));
    }
};
