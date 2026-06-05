import type { MessageAttachment, MessageType } from "../services/chatService";

export function isEmojiOnly(text: string): boolean {
    if (!text) return false;
    // Dùng nhóm thay vì character class để tránh false-positive từ eslint.
    const emojiRegex =
        /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+$/u;
    // Kiểm tra có ít nhất 1 emoji và không có ký tự text thường
    const hasEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(
        text,
    );
    return hasEmoji && emojiRegex.test(text.trim());
}

export function getFileNameFromUrl(
    url: string | undefined,
    fallback = "tệp đính kèm",
) {
    if (!url) return fallback;
    return url.split("/").pop()?.split("?")[0] ?? fallback;
}

export function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${mb.toFixed(2)} MB`;
}

export type FileCategory = "video" | "pdf" | "word" | "excel" | "ppt" | "other";

const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm"]);
const IMAGE_FILE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "avif",
    "heic",
]);
const AUDIO_FILE_EXTENSIONS = new Set([
    "mp3",
    "wav",
    "ogg",
    "aac",
    "m4a",
    "opus",
    "weba",
]);
const WORD_FILE_EXTENSIONS = new Set(["doc", "docx"]);
const EXCEL_FILE_EXTENSIONS = new Set(["xls", "xlsx"]);
const PPT_FILE_EXTENSIONS = new Set(["ppt", "pptx"]);

const WORD_MIME_TYPES = new Set([
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const EXCEL_MIME_TYPES = new Set([
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const PPT_MIME_TYPES = new Set([
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const GROUP_SYSTEM_MESSAGE_TYPES = new Set<MessageType>([
    "SYSTEM_POLL_CREATED",
    "SYSTEM_POLL_VOTED",
    "SYSTEM_POLL_CHANGED",
    "SYSTEM_POLL_CLOSED",
    "SYSTEM_POLL_PINNED",
    "SYSTEM_CREATE_GROUP",
    "SYSTEM_ADD_MEMBER",
    "SYSTEM_UPDATE_ROLE",
    "SYSTEM_KICK_MEMBER",
    "SYSTEM_BLOCK_MEMBER",
    "SYSTEM_MEMBER_BLOCKED_FROM_JOIN",
    "SYSTEM_LEAVE_GROUP",
    "SYSTEM_DISBAND_GROUP",
    "SYSTEM_UPDATE_SETTING",
    "SYSTEM_REQUIRE_APPROVAL",
    "SYSTEM_JOIN_VIA_LINK",
    "SYSTEM_GROUP_INVITE_LINK_SENT",
]);

export function isGroupSystemType(
    type: MessageType,
): type is
    | "SYSTEM_CREATE_GROUP"
    | "SYSTEM_ADD_MEMBER"
    | "SYSTEM_UPDATE_ROLE"
    | "SYSTEM_KICK_MEMBER"
    | "SYSTEM_BLOCK_MEMBER"
    | "SYSTEM_LEAVE_GROUP"
    | "SYSTEM_DISBAND_GROUP"
    | "SYSTEM_UPDATE_SETTING"
    | "SYSTEM_REQUIRE_APPROVAL"
    | "SYSTEM_JOIN_VIA_LINK"
    | "SYSTEM_GROUP_INVITE_LINK_SENT"
    | "SYSTEM_POLL_CREATED"
    | "SYSTEM_POLL_VOTED"
    | "SYSTEM_POLL_CHANGED"
    | "SYSTEM_POLL_CLOSED"
    | "SYSTEM_POLL_PINNED"
    | "SYSTEM_MEMBER_BLOCKED_FROM_JOIN" {
    return GROUP_SYSTEM_MESSAGE_TYPES.has(type);
}

interface ReplyMediaPayload {
    type?: MessageType;
    content?: string;
    fileName?: string;
    mimeType?: string;
}

export interface ParsedReplyContent {
    sourceUrl?: string;
    thumbnailUrl?: string;
    posterUrl?: string;
    fileName?: string;
    mimeType?: string;
    text?: string;
}

function getFileExtension(fileName: string): string {
    return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeMimeType(mimeType?: string): string {
    if (!mimeType) return "";
    return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isImageFile(fileName?: string, mimeType?: string): boolean {
    const normalizedMime = normalizeMimeType(mimeType);
    if (normalizedMime.startsWith("image/")) return true;

    if (!fileName) return false;
    const ext = getFileExtension(fileName);
    return IMAGE_FILE_EXTENSIONS.has(ext);
}

export function isAudioFile(fileName?: string, mimeType?: string): boolean {
    const normalizedMime = normalizeMimeType(mimeType);
    if (normalizedMime.startsWith("audio/")) return true;

    if (!fileName) return false;
    const ext = getFileExtension(fileName);
    return AUDIO_FILE_EXTENSIONS.has(ext);
}

function isVideoFile(fileName?: string, mimeType?: string): boolean {
    if (isAudioFile(fileName, mimeType)) return false;

    const normalizedMime = normalizeMimeType(mimeType);
    if (normalizedMime.startsWith("video/")) return true;

    if (!fileName) return false;
    const ext = getFileExtension(fileName);
    return VIDEO_FILE_EXTENSIONS.has(ext);
}

export function getReplyMediaType(
    message?: ReplyMediaPayload | null,
): "image" | "video" | "other" {
    if (!message) return "other";

    if (message.type === "IMAGE") return "image";
    if (message.type === "VIDEO") return "video";
    if (message.type === "AUDIO") return "other";

    const candidateName = message.fileName || message.content;
    if (isAudioFile(candidateName, message.mimeType)) return "other";
    if (isImageFile(candidateName, message.mimeType)) return "image";
    if (isVideoFile(candidateName, message.mimeType)) return "video";
    return "other";
}

export function isLikelyMediaSource(value?: string): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    return (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("blob:") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("/") ||
        normalized.includes("/") ||
        normalized.includes(".jpg") ||
        normalized.includes(".jpeg") ||
        normalized.includes(".png") ||
        normalized.includes(".gif") ||
        normalized.includes(".webp") ||
        normalized.includes(".mp4") ||
        normalized.includes(".mov") ||
        normalized.includes(".avi") ||
        normalized.includes(".mkv") ||
        normalized.includes(".webm")
    );
}

export function parseReplyContent(content?: string): ParsedReplyContent {
    const raw = content?.trim();
    if (!raw) return {};

    if (raw.startsWith("{") && raw.endsWith("}")) {
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const getString = (...keys: string[]) => {
                for (const key of keys) {
                    const value = parsed[key];
                    if (typeof value === "string" && value.trim()) {
                        return value;
                    }
                }
                return undefined;
            };

            return {
                sourceUrl: getString("url", "fileUrl", "src", "content"),
                thumbnailUrl: getString(
                    "thumbnailUrl",
                    "thumbnail",
                    "previewUrl",
                ),
                posterUrl: getString("posterUrl", "poster"),
                fileName: getString("fileName", "name"),
                mimeType: getString("mimeType", "type", "contentType"),
                text: getString("text", "caption", "message"),
            };
        } catch {
            // Fallback dùng raw content phía dưới.
        }
    }

    return {
        sourceUrl: raw,
        fileName: getFileNameFromUrl(raw, ""),
        text: raw,
    };
}

export function resolveFileCategory(
    fileName: string,
    mimeType?: string,
    messageType?: MessageType,
): FileCategory {
    if (messageType === "VIDEO") return "video";

    // Ưu tiên extension trước, sau đó mới fallback sang mimeType.
    const ext = getFileExtension(fileName);
    if (VIDEO_FILE_EXTENSIONS.has(ext)) return "video";
    if (ext === "pdf") return "pdf";
    if (WORD_FILE_EXTENSIONS.has(ext)) return "word";
    if (EXCEL_FILE_EXTENSIONS.has(ext)) return "excel";
    if (PPT_FILE_EXTENSIONS.has(ext)) return "ppt";

    const normalizedMime = normalizeMimeType(mimeType);
    if (!normalizedMime) return "other";

    if (normalizedMime.startsWith("video/")) return "video";
    if (normalizedMime === "application/pdf") return "pdf";
    if (WORD_MIME_TYPES.has(normalizedMime)) return "word";
    if (EXCEL_MIME_TYPES.has(normalizedMime)) return "excel";
    if (PPT_MIME_TYPES.has(normalizedMime)) return "ppt";

    return "other";
}

export function getFileTypeBadge(fileCategory: FileCategory): string | null {
    if (fileCategory === "pdf") return "PDF";
    if (fileCategory === "word") return "WORD";
    if (fileCategory === "excel") return "EXCEL";
    if (fileCategory === "ppt") return "PPT";
    if (fileCategory === "video") return "VIDEO";
    return null;
}

export function isDocumentCategory(fileCategory: FileCategory): boolean {
    return fileCategory === "pdf" || fileCategory === "word";
}

export function getFileTypePalette(fileCategory: FileCategory) {
    if (fileCategory === "pdf") {
        return {
            iconBg: "bg-red-100 dark:bg-red-950",
            iconText: "text-red-600 dark:text-red-300",
            badgeBg: "bg-red-100 dark:bg-red-950",
            badgeText: "text-red-700 dark:text-red-200",
        };
    }
    if (fileCategory === "word") {
        return {
            iconBg: "bg-blue-100 dark:bg-blue-950",
            iconText: "text-blue-600 dark:text-blue-300",
            badgeBg: "bg-blue-100 dark:bg-blue-950",
            badgeText: "text-blue-700 dark:text-blue-200",
        };
    }
    if (fileCategory === "excel") {
        return {
            iconBg: "bg-emerald-100 dark:bg-emerald-950",
            iconText: "text-emerald-600 dark:text-emerald-300",
            badgeBg: "bg-emerald-100 dark:bg-emerald-950",
            badgeText: "text-emerald-700 dark:text-emerald-200",
        };
    }
    if (fileCategory === "ppt") {
        return {
            iconBg: "bg-orange-100 dark:bg-orange-950",
            iconText: "text-orange-600 dark:text-orange-300",
            badgeBg: "bg-orange-100 dark:bg-orange-950",
            badgeText: "text-orange-700 dark:text-orange-200",
        };
    }
    if (fileCategory === "video") {
        return {
            iconBg: "bg-sky-100 dark:bg-sky-950",
            iconText: "text-sky-600 dark:text-sky-300",
            badgeBg: "bg-sky-100 dark:bg-sky-950",
            badgeText: "text-sky-700 dark:text-sky-200",
        };
    }

    return {
        iconBg: "bg-gray-200 dark:bg-gray-700",
        iconText: "text-gray-600 dark:text-gray-300",
        badgeBg: "bg-gray-200 dark:bg-gray-700",
        badgeText: "text-gray-700 dark:text-gray-200",
    };
}

export function resolveLocalAvailabilityLabel(
    attachment?: MessageAttachment,
): string | null {
    if (!attachment) return null;
    const metadata = attachment as MessageAttachment & Record<string, unknown>;

    const localBooleanKeys = [
        "isLocal",
        "existsOnDevice",
        "availableOnDevice",
        "isAvailableOnDevice",
        "downloaded",
    ];
    if (localBooleanKeys.some((key) => metadata[key] === true)) {
        return "Đã có trên máy";
    }

    const localStringKeys = ["localStatus", "status", "deviceStatus"];
    const localStatusRaw = localStringKeys
        .map((key) => metadata[key])
        .find((value): value is string => typeof value === "string");

    if (!localStatusRaw) return null;

    const normalized = localStatusRaw.trim().toLowerCase();
    if (!normalized) return null;

    if (
        normalized.includes("đã có trên máy") ||
        normalized.includes("local") ||
        normalized.includes("available") ||
        normalized.includes("downloaded") ||
        normalized.includes("device")
    ) {
        return "Đã có trên máy";
    }

    return null;
}

export function resolveVideoPosterUrl(
    attachment?: MessageAttachment,
): string | undefined {
    if (!attachment) return undefined;
    const metadata = attachment as MessageAttachment & Record<string, unknown>;
    const posterKeys = ["thumbnailUrl", "thumbnail", "posterUrl", "poster"];

    for (const key of posterKeys) {
        const value = metadata[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    return undefined;
}
