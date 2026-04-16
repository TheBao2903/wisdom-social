/**
 * S3 Utility Functions
 * Handle S3 operations including upload, presigned URLs, and URL construction
 */

import axiosClient from "../api/axiosClient";

const S3_BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME || "cnmt-hk1-amz";
const S3_REGION = import.meta.env.VITE_S3_REGION || "ap-southeast-1";

/**
 * Get presigned upload URL and upload metadata from backend
 * @param extension File extension (jpg, png, etc.)
 * @returns Object with uploadUrl, uuid, extension for S3 upload
 */
export const getPresignedUploadUrl = async (
    extension: string
): Promise<{ uploadUrl: string; imageUrl: string; uuid: string; extension: string }> => {
    try {
        console.log(`📋 [S3] Getting presigned URL for extension: ${extension}`);
        const response = await axiosClient.get("/posts/upload-url", {
            params: { extension },
        });
        console.log(`📋 test:`, response.data.data);
        const uploadUrl = response.data.data?.uploadUrl;
        const imageUrl = response.data.data?.imageUrl;
        const uuid = response.data.data?.uuid;
        const ext = response.data.data?.extension;

        if (!uploadUrl || !uuid || !ext) {
            throw new Error("Missing required fields: uploadUrl, uuid, extension");
        }

        console.log(`✅ [S3] Got presigned URL`, { uuid, extension: ext });
        return { uploadUrl, imageUrl, uuid, extension: ext };
    } catch (error: any) {
        console.error(`❌ [S3] Error getting presigned URL:`, error);
        throw new Error("Failed to get presigned upload URL: " + (error?.message || "Unknown error"));
    }
};

/**
 * Upload file directly to S3 using presigned URL
 * @param presignedUrl The presigned PUT URL from backend
 * @param file The File object to upload
 */
export const uploadFileToS3 = async (presignedUrl: string, file: File): Promise<void> => {
    try {
        console.log(`📤 [S3] Uploading ${file.name} to S3...`);
        console.log(`📤 [S3] File type: ${file.type}, size: ${file.size} bytes`);

        const response = await fetch(presignedUrl, {
            method: "PUT",
            headers: {
                "Content-Type": file.type || "image/jpeg",
            },
            body: file,
        });

        console.log(`📤 [S3] S3 response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [S3] Upload failed: ${response.status}`);
            console.error(`❌ [S3] Response:`, errorText);
            throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
        }

        const eTag = response.headers.get('etag');
        console.log(`✅ [S3] File ${file.name} uploaded successfully (ETag: ${eTag})`);
    } catch (error: any) {
        console.error(`❌ [S3] Error uploading ${file.name}:`, error);
        throw error;
    }
};

/**
 * Upload image file to S3 and get the format for backend
 * @param file File to upload
 * @returns uuid.extension format expected by backend
 */
export const uploadImageAndGetFormat = async (file: File): Promise<string> => {
    try {
        const extension = file.name.split(".").pop() || "jpg";
        console.log(`🔄 [S3] Processing image upload for: ${file.name}`);

        // Step 1: Get presigned URL
        const { uploadUrl, uuid, extension: ext } = await getPresignedUploadUrl(extension);

        // Step 2: Upload to S3
        await uploadFileToS3(uploadUrl, file);

        // Step 3: Return format for backend (uuid.extension)
        const uuidWithExt = `${uuid}.${ext}`;
        console.log(`✅ [S3] Image upload complete, format for backend: ${uuidWithExt}`);
        return uuidWithExt;
    } catch (error: any) {
        console.error(`❌ [S3] Failed to upload image:`, error);
        throw new Error(`Failed to upload image ${file.name}: ${error.message}`);
    }
};

/**
 * Construct full S3 URL from S3 key
 * @param s3Key The S3 object key (path), e.g., "images/posts/1/uuid.jpg"
 * @returns Full S3 URL, e.g., "https://bucket.s3.region.amazonaws.com/images/posts/1/uuid.jpg"
 */
export const buildS3Url = (s3Key: string | null | undefined): string | null => {
    if (!s3Key) return null;
    return `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
};

/**
 * Get avatar URL from avatar key or path
 */
export const getAvatarUrl = (avatarKey: string | null | undefined): string | null => {
    return buildS3Url(avatarKey);
};

/**
 * Get cover URL from cover key or path
 */
export const getCoverUrl = (coverKey: string | null | undefined): string | null => {
    return buildS3Url(coverKey);
};
/**
 * Get post image URL from image key or path
 */
export const getPostImageUrl = (imageKey: string | null | undefined): string | null => {
    return buildS3Url(imageKey);
};

/**
 * Get story image/video URL from key or path
 */
export const getStoryMediaUrl = (mediaKey: string | null | undefined): string | null => {
    return buildS3Url(mediaKey);
};