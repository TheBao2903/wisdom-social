import type { Conversation, MessageType } from "../services/chatService";
import type {
    ConversationSnapshot,
    LastMessageUpdate,
} from "../services/websocket";
import { DEFAULT_AVATAR_URL, DEFAULT_GROUP_AVATAR_URL } from "../constants/ui";
import { buildConversationDisplayInfo } from "./conversationDisplayInfo";

export function parseOptionalInt(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function sortConversationsByLastMessageAt(
    conversationList: Conversation[],
): Conversation[] {
    return [...conversationList].sort((a, b) => {
        const timeA = a.lastMessage?.lastMessageAt
            ? new Date(a.lastMessage.lastMessageAt).getTime()
            : a.updatedAt
              ? new Date(a.updatedAt).getTime()
              : 0;
        const timeB = b.lastMessage?.lastMessageAt
            ? new Date(b.lastMessage.lastMessageAt).getTime()
            : b.updatedAt
              ? new Date(b.updatedAt).getTime()
              : 0;
        return timeB - timeA;
    });
}

export const GROUP_SYSTEM_SYNC_TYPES = new Set<MessageType>([
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

export function resolveReadOnlyNoticeFromConversation(
    conversation: Conversation | ConversationSnapshot | undefined,
    currentUserId: number,
): string | null {
    if (!conversation) return null;

    if (conversation.type === "DIRECT") {
        if (conversation.directBlockedByMe) return "Bạn đã chặn người này.";
        if (conversation.directBlockedMe) return "Bạn không thể nhắn tin với người này.";
        return null;
    }

    if (conversation.type !== "GROUP") return null;

    const currentMember = (conversation.members ?? []).find(
        (member) => Number(member.userId) === Number(currentUserId),
    );
    if (!currentMember) return null;

    if (currentMember.status === "BLOCKED") {
        return "Bạn đã bị chặn khỏi nhóm.";
    }
    if (currentMember.status === "KICKED") {
        return "Bạn đã bị xóa khỏi nhóm.";
    }
    if (currentMember.status === "LEFT") {
        return "Bạn đã rời khỏi nhóm.";
    }
    if (currentMember.status === "GROUP_DISBANDED") {
        return "Nhóm đã bị giải tán.";
    }

    if (conversation.isMessageRestricted && currentMember.role === "MEMBER") {
        return "";
    }

    return null;
}

export function resolveReadOnlyNoticeFromLastMessage(
    lastMessage: LastMessageUpdate,
    currentUserId: number,
): string | null {
    if (lastMessage.lastMessageType === "SYSTEM_DISBAND_GROUP") {
        return "Nhóm đã bị giải tán.";
    }

    if (lastMessage.lastMessageType === "SYSTEM_LEAVE_GROUP") {
        if (Number(lastMessage.lastSenderId) === Number(currentUserId)) {
            return "Bạn đã rời khỏi nhóm.";
        }
        return null;
    }

    if (lastMessage.lastMessageType === "SYSTEM_KICK_MEMBER" || lastMessage.lastMessageType === "SYSTEM_BLOCK_MEMBER") {
        const targetIds = safeParseMemberIds(lastMessage.lastMessageContent);
        if (targetIds.some((id) => Number(id) === Number(currentUserId))) {
            if (lastMessage.lastMessageType === "SYSTEM_BLOCK_MEMBER") {
                return "Bạn đã bị chặn khỏi nhóm.";
            }
            return "Bạn đã bị xóa khỏi nhóm.";
        }
    }

    return null;
}

export function getConversationDisplayInfo(
    conv: Conversation,
    currentUserId: number,
) {
    const displayInfo = buildConversationDisplayInfo({
        conversation: conv,
        currentUserId,
    });

    const fallbackName =
        conv.name?.trim() ||
        (conv.type === "GROUP" ? "Nhóm chat" : "Người dùng");
    const fallbackAvatar = conv.imageUrl?.trim() || null;

    const resolvedName =
        displayInfo.name === "Unknown" || displayInfo.name === "Group Chat"
            ? fallbackName
            : displayInfo.name;
    const resolvedAvatar = displayInfo.avatarUrl || fallbackAvatar;

    const fallbackAvatarUrl =
        conv.type === "GROUP" ? DEFAULT_GROUP_AVATAR_URL : DEFAULT_AVATAR_URL;
    const compositeAvatars = displayInfo.compositeAvatarUrls;

    return {
        name: resolvedName,
        avatar: resolvedAvatar,
        fallbackAvatar: fallbackAvatarUrl,
        compositeAvatars,
        hasCompositeAvatar: compositeAvatars.length > 0,
    };
}

export function formatConversationTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) {
        const diffInMinutes = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60),
        );
        return diffInMinutes < 1 ? "now" : `${diffInMinutes}m`;
    }
    if (diffInHours < 24) return `${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;

    return date.toLocaleDateString("vi-VN", {
        month: "short",
        day: "numeric",
    });
}
