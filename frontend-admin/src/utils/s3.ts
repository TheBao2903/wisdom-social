/**
 * S3 Utility Functions (admin)
 *
 * Giống cách frontend-web load ảnh: backend trả về S3 object key (vd
 * "images/posts/1/uuid.jpg") chứ không phải URL đầy đủ. buildS3Url() ghép key
 * thành URL S3 hoàn chỉnh để hiển thị. Các URL đã đầy đủ / data: / blob: /
 * đường dẫn nội bộ được giữ nguyên.
 */

const S3_BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME || "wisdom-social-db";
const S3_REGION = import.meta.env.VITE_S3_REGION || "ap-southeast-1";

/**
 * Ghép full S3 URL từ S3 key.
 * @param s3Key Object key (path), vd "images/posts/1/uuid.jpg"
 * @returns URL đầy đủ, vd "https://bucket.s3.region.amazonaws.com/images/posts/1/uuid.jpg"
 */
export const buildS3Url = (s3Key: string | null | undefined): string | null => {
    if (!s3Key) return null;

    const value = s3Key.trim();
    if (!value) return null;

    // Giữ nguyên URL đầy đủ, data URL, blob URL và đường dẫn nội bộ (/path...).
    if (/^https?:\/\//i.test(value)) {
        const withSlash = value.replace(/(amazonaws\.com)(?!\/)/i, "$1/");
        const duplicatedUrlMatch = withSlash.match(
            /^(https?:\/\/[^/]+\/)(https?:\/\/.+)$/i,
        );
        return duplicatedUrlMatch?.[2] ?? withSlash;
    }
    if (/^data:/i.test(value) || /^blob:/i.test(value) || value.startsWith("/")) {
        return value;
    }

    const normalizedKey = value.startsWith("/") ? value.substring(1) : value;
    return `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${normalizedKey}`;
};

/** Avatar URL từ key/path */
export const getAvatarUrl = (avatarKey: string | null | undefined): string | null =>
    buildS3Url(avatarKey);

/** Cover URL từ key/path */
export const getCoverUrl = (coverKey: string | null | undefined): string | null =>
    buildS3Url(coverKey);

/** Ảnh bài đăng từ key/path */
export const getPostImageUrl = (imageKey: string | null | undefined): string | null =>
    buildS3Url(imageKey);

/** Ảnh/video story từ key/path */
export const getStoryMediaUrl = (mediaKey: string | null | undefined): string | null =>
    buildS3Url(mediaKey);
