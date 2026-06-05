import apiClient from "@/api/apiClient";

const S3_BUCKET_NAME = "wisdom-social-db";
const S3_REGION = "ap-southeast-1";

export type UploadableMediaFile = {
    uri: string;
    name?: string;
    type?: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number | null;
};

export type PresignedPostUpload = {
    uploadUrl: string;
    imageUrl: string;
    uuid: string;
    extension: string;
    objectKey: string;
};

const unwrap = (payload: any) => payload?.data ?? payload;

const getFileName = (file: UploadableMediaFile): string =>
    file.name || file.uri.split("/").pop() || `post-media-${Date.now()}.jpg`;

const getMimeType = (file: UploadableMediaFile): string =>
    file.type || file.mimeType || (getFileName(file).toLowerCase().endsWith(".mp4") ? "video/mp4" : "image/jpeg");

const getExtension = (file: UploadableMediaFile): string => {
    const fileName = getFileName(file);
    const fromName = fileName.includes(".") ? fileName.split(".").pop() : undefined;
    if (fromName) return fromName.toLowerCase();
    const mime = getMimeType(file);
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    if (mime.includes("video")) return "mp4";
    return "jpg";
};

export function buildS3Url(url?: string | null): string | undefined {
    const value = url?.trim();
    if (!value) return undefined;

    if (/^https?:\/\//i.test(value)) {
        const withSlash = value.replace(/(amazonaws\.com)(?!\/)/i, "$1/");
        const duplicatedUrlMatch = withSlash.match(
            /^(https?:\/\/[^/]+\/)(https?:\/\/.+)$/i,
        );
        return duplicatedUrlMatch?.[2] ?? withSlash;
    }

    if (
        /^data:/i.test(value) ||
        /^blob:/i.test(value) ||
        value.startsWith("file://") ||
        value.startsWith("content://")
    ) {
        return value;
    }

    const normalizedKey = value.replace(/^\/+/, "");
    return `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${normalizedKey}`;
}

export const getPresignedUploadUrl = async (extension: string): Promise<PresignedPostUpload> => {
    const response = await apiClient.get("/posts/upload-url", { params: { extension } });
    const data = unwrap(response.data);
    const uploadUrl = data?.presignedUrl;
    const objectKey = data?.objectKey;

    if (!uploadUrl || !objectKey) {
        throw new Error("Missing required fields from backend: presignedUrl, objectKey");
    }

    const filename = String(objectKey).substring(String(objectKey).lastIndexOf("/") + 1);
    const lastDotIndex = filename.lastIndexOf(".");
    const uuid = lastDotIndex >= 0 ? filename.substring(0, lastDotIndex) : filename;
    const ext = lastDotIndex >= 0 ? filename.substring(lastDotIndex + 1) : extension;

    return {
        uploadUrl,
        imageUrl: objectKey,
        objectKey,
        uuid,
        extension: ext,
    };
};

export const uploadFileToS3 = async (presignedUrl: string, file: UploadableMediaFile): Promise<void> => {
    const fileResponse = await fetch(file.uri);
    const blob = await fileResponse.blob();
    const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
            "Content-Type": getMimeType(file),
        },
        body: blob,
    });

    if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
};

export const uploadMediaAndGetFormat = async (file: UploadableMediaFile): Promise<string> => {
    const extension = getExtension(file);
    const { uploadUrl, uuid, extension: ext } = await getPresignedUploadUrl(extension);
    await uploadFileToS3(uploadUrl, file);
    return `${uuid}.${ext}`;
};

export const uploadImageAndGetFormat = uploadMediaAndGetFormat;

export const getAvatarUrl = buildS3Url;
export const getCoverUrl = buildS3Url;
export const getPostImageUrl = buildS3Url;
export const getStoryMediaUrl = buildS3Url;
