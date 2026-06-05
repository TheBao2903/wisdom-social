import type {
    Conversation,
    ConversationMember,
    Message,
    MessageType,
} from "../services/chatService";
import type { MembersByUserId } from "../stores/chatRuntimeStore";
import { buildConversationDisplayInfo } from "./conversationDisplayInfo";

/**
 * Các hằng số điều khiển UX & paging.
 * - PAGE_SIZE: số tin nhắn mỗi lần tải.
 * - NEAR_BOTTOM_THRESHOLD_PX: ngưỡng để coi user đang "gần cuối" (phục vụ auto-scroll).
 * - LOAD_MORE_TRIGGER_PX: khi scrollTop < ngưỡng => tải thêm tin nhắn cũ.
 * - SCROLLABLE_EPSILON_PX: sai số nhỏ để kiểm tra container có thật sự scroll được.
 */
export const PAGE_SIZE = 20;
export const NEAR_BOTTOM_THRESHOLD_PX = 200;
export const LOAD_MORE_TRIGGER_PX = 100;
export const SCROLLABLE_EPSILON_PX = 2;
export const MARK_AS_READ_DEBOUNCE_MS = 1000;
export const MESSAGE_WINDOW_LIMIT = 200;
export const MESSAGE_TRIM_BATCH = 20;
export const MAX_FILES_PER_SEND = 50;
export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const RECALLED_REPLY_TEXT = "Tin nhắn đã được thu hồi";
export const JUMP_NOT_FOUND_TOAST = "Không thể tìm thấy tin nhắn.";
export const JUMP_TOAST_TIMEOUT_MS = 2400;
export const GROUP_READ_ONLY_COMPOSER_NOTICE =
    "Bạn không thể gửi tin nhắn vào nhóm được nữa";

export const GROUP_SYSTEM_MEMBER_SYNC_TYPES = new Set<MessageType>([
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

export type LoadOlderOptions = { keepAtBottom?: boolean };
export type VisibleAnchorSnapshot = { messageId: string; topOffset: number };

export interface ReadReceipt {
    userId: number;
    lastMessageId: string;
    seenAt: string;
}

export function resolveApiErrorMessage(
    error: unknown,
    fallback: string,
): string {
    if (
        error &&
        typeof error === "object" &&
        "response" in (error as Record<string, unknown>)
    ) {
        const response = (
            error as {
                response?: {
                    status?: number;
                    data?: unknown;
                };
            }
        ).response;

        const data =
            response?.data && typeof response.data === "object"
                ? (response.data as Record<string, unknown>)
                : null;
        const status = response?.status;

        if (data) {
            // Khử lồng ApiResponse { message, data: { message } }
            const directMessage =
                typeof data.message === "string" ? data.message : null;
            const nestedData =
                data.data && typeof data.data === "object"
                    ? (data.data as Record<string, unknown>)
                    : null;
            const nestedMessage =
                nestedData && typeof nestedData.message === "string"
                    ? nestedData.message
                    : null;
            const springMessage =
                typeof data.error === "string" ? data.error : null;

            const finalServerMsg =
                directMessage || nestedMessage || springMessage;
            if (finalServerMsg && finalServerMsg.trim()) {
                return finalServerMsg;
            }
        }

        // Nếu không có message từ server nhưng status là 403 -> Trả về lỗi quyền truy cập thay vì fallback
        if (status === 403) {
            return "Bạn không có quyền truy cập hội thoại này.";
        }
    }

    return fallback;
}

export function safeParseMemberIds(content: string): number[] {
    if (!content) return [];

    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((value) => {
                if (typeof value === "object" && value !== null && "id" in value) {
                    return Number(value.id);
                }
                return Number(value);
            })
            .filter((value) => Number.isFinite(value));
    } catch {
        return [];
    }
}

export function resolveReadOnlyReasonFromApiMessage(
    message: string,
): string | null {
    const normalized = message.toLowerCase();

    if (
        normalized.includes("xóa khỏi nhóm") ||
        normalized.includes("bị đuổi") ||
        normalized.includes("bị kick") ||
        normalized.includes("kicked")
    ) {
        return "Bạn đã bị xóa khỏi nhóm.";
    }

    if (
        normalized.includes("rời nhóm") ||
        normalized.includes("rời khỏi nhóm")
    ) {
        return "Bạn đã rời khỏi nhóm.";
    }

    if (normalized.includes("giải tán")) {
        return "Nhóm đã bị giải tán.";
    }

    if (
        normalized.includes("không phải thành viên") ||
        normalized.includes("không có quyền") ||
        normalized.includes("access denied") ||
        normalized.includes("forbidden")
    ) {
        return "Bạn không có quyền truy cập hội thoại này.";
    }

    return null;
}

export function resolveReadOnlyReasonFromSystemMessage(
    message: Message,
    currentUserId: number,
): string | null {
    if (message.type === "SYSTEM_DISBAND_GROUP") {
        return "Nhóm đã bị giải tán.";
    }

    if (message.type === "SYSTEM_LEAVE_GROUP") {
        if (Number(message.senderId) === Number(currentUserId)) {
            return "Bạn đã rời khỏi nhóm.";
        }
        return null;
    }

    if (message.type === "SYSTEM_KICK_MEMBER" || message.type === "SYSTEM_BLOCK_MEMBER") {
        const targetIds = safeParseMemberIds(message.content);
        if (targetIds.some((id) => Number(id) === Number(currentUserId))) {
            return "Bạn đã bị xóa khỏi nhóm.";
        }
    }

    return null;
}

export function getConversationDisplayInfo(
    conversation: Conversation,
    userId: number,
    membersById: MembersByUserId = {},
) {
    const displayInfo = buildConversationDisplayInfo({
        conversation,
        currentUserId: userId,
        members: Object.values(membersById),
    });

    return {
        displayName: displayInfo.name,
        displayAvatar: displayInfo.avatarUrl,
        displayCompositeAvatars: displayInfo.compositeAvatarUrls,
    };
}

export function toMembersByUserId(
    members:
        | ConversationMember[]
        | Record<string, ConversationMember>
        | null
        | undefined,
): MembersByUserId {
    // Hàm chuẩn hoá members về map { [userId]: member } để render nhanh theo senderId.
    // Đây là điểm quan trọng của kiến trúc "client-side joining":
    // - Tin nhắn chỉ cần senderId
    // - UI sẽ tra nickname/avatar từ members map theo userId
    // => Tránh phụ thuộc vào dữ liệu senderName/senderAvatar nằm sẵn trong message.
    const normalized: MembersByUserId = {};
    if (!members) return normalized;

    if (Array.isArray(members)) {
        for (const member of members) {
            const numericId = Number(member.userId);
            normalized[numericId] = { ...member, userId: numericId };
        }
        return normalized;
    }

    for (const [rawUserId, member] of Object.entries(members)) {
        if (!member || typeof member !== "object") continue;

        // Ưu tiên userId trong value, fallback từ key nếu key là số.
        // Lý do: backend có thể trả map mà key và value không luôn đồng nhất,
        // hoặc có lúc response bị bọc khiến key không phải số.
        const valueUserId = (member as { userId?: unknown }).userId;
        const userId =
            typeof valueUserId === "number" ? valueUserId : Number(rawUserId);

        if (!Number.isFinite(userId)) continue;

        const normalizedMember = member as ConversationMember;
        normalized[userId] = {
            ...normalizedMember,
            userId,
            nickname: normalizedMember.nickname || "Unknown",
            username: normalizedMember.username || "",
        };
    }

    return normalized;
}

export function isImageFile(file: File): boolean {
    return file.type.startsWith("image/");
}

export function toAttachmentCategory(file: File): "IMAGE" | "FILE" {
    return isImageFile(file) ? "IMAGE" : "FILE";
}

export function getValidationErrorForFiles(files: File[]): string | null {
    if (files.length === 0) return null;
    if (files.length > MAX_FILES_PER_SEND) {
        return `Mỗi lần gửi tối đa ${MAX_FILES_PER_SEND} tệp.`;
    }

    for (const file of files) {
        const maxAllowed = isImageFile(file)
            ? MAX_IMAGE_SIZE_BYTES
            : MAX_FILE_SIZE_BYTES;
        if (file.size > maxAllowed) {
            const maxMb = isImageFile(file) ? 25 : 100;
            return `Tệp ${file.name} vượt quá ${maxMb}MB.`;
        }
    }

    return null;
}

export function getFileClientKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
}

export function normalizeReplyPreviewContent(message: Message): Message {
    if (!message.replyInfo) return message;
    const current = (message.replyInfo.content ?? "").trim();
    if (current) return message;

    return {
        ...message,
        replyInfo: {
            ...message.replyInfo,
            content: RECALLED_REPLY_TEXT,
        },
    };
}

export function normalizeMessagesForUi(messages: Message[]): Message[] {
    return messages.map(normalizeReplyPreviewContent);
}
