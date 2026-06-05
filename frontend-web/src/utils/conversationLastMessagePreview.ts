import type { Conversation } from "../services/chatService";
import { buildSystemGroupMessage } from "./systemCreateGroupMessage";

interface ConversationLastMessagePreviewParams {
    conversation: Conversation;
    currentUserId: number;
}

export interface ConversationLastMessagePreview {
    text: string;
    showSenderPrefix: boolean;
    senderLabel: string;
}

type GroupSystemPreviewType =
    | "SYSTEM_CREATE_GROUP"
    | "SYSTEM_ADD_MEMBER"
    | "SYSTEM_UPDATE_ROLE"
    | "SYSTEM_KICK_MEMBER"
    | "SYSTEM_BLOCK_MEMBER"
    | "SYSTEM_MEMBER_BLOCKED_FROM_JOIN"
    | "SYSTEM_LEAVE_GROUP"
    | "SYSTEM_DISBAND_GROUP"
    | "SYSTEM_UPDATE_SETTING"
    | "SYSTEM_REQUIRE_APPROVAL"
    | "SYSTEM_JOIN_VIA_LINK"
    | "SYSTEM_GROUP_INVITE_LINK_SENT";

type PollSystemPreviewType =
    | "SYSTEM_POLL_CREATED"
    | "SYSTEM_POLL_VOTED"
    | "SYSTEM_POLL_CHANGED"
    | "SYSTEM_POLL_CLOSED"
    | "SYSTEM_POLL_PINNED";

type PinSystemPreviewType = "SYSTEM_PIN" | "SYSTEM_UPIN";

const DEFAULT_PREVIEW_TEXT = "Bắt đầu trò chuyện";

const GROUP_SYSTEM_PREVIEW_TYPES = new Set<GroupSystemPreviewType>([
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

const POLL_SYSTEM_PREVIEW_TYPES = new Set<PollSystemPreviewType>([
    "SYSTEM_POLL_CREATED",
    "SYSTEM_POLL_VOTED",
    "SYSTEM_POLL_CHANGED",
    "SYSTEM_POLL_CLOSED",
    "SYSTEM_POLL_PINNED",
]);

const PIN_SYSTEM_PREVIEW_TYPES = new Set<PinSystemPreviewType>([
    "SYSTEM_PIN",
    "SYSTEM_UPIN",
]);

function isGroupSystemPreviewType(
    type: Conversation["lastMessage"] extends infer T
        ? T extends { lastMessageType: infer M }
            ? M
            : never
        : never,
): type is GroupSystemPreviewType {
    return GROUP_SYSTEM_PREVIEW_TYPES.has(type as GroupSystemPreviewType);
}

function isPollSystemPreviewType(type: unknown): type is PollSystemPreviewType {
    return POLL_SYSTEM_PREVIEW_TYPES.has(type as PollSystemPreviewType);
}

function isPinSystemPreviewType(type: unknown): type is PinSystemPreviewType {
    return PIN_SYSTEM_PREVIEW_TYPES.has(type as PinSystemPreviewType);
}

function isSystemMessageType(type: unknown): type is string {
    return typeof type === "string" && type.startsWith("SYSTEM_");
}

function isAnonymousPollActorMessage(type: unknown): boolean {
    return type === "SYSTEM_POLL_VOTED" || type === "SYSTEM_POLL_CHANGED";
}

function extractPollTitle(content: string): string {
    const colonIndex = content.indexOf(":");
    return colonIndex >= 0 ? content.slice(colonIndex + 1).trim() : content;
}

function getPollSystemAction(type: unknown): string {
    switch (type) {
        case "SYSTEM_POLL_CREATED":
            return "đã tạo cuộc bình chọn";
        case "SYSTEM_POLL_VOTED":
            return "đã tham gia cuộc bình chọn";
        case "SYSTEM_POLL_CHANGED":
            return "đã đổi lựa chọn trong cuộc bình chọn";
        case "SYSTEM_POLL_CLOSED":
            return "đã khóa bình chọn";
        case "SYSTEM_POLL_PINNED":
            return "đã ghim bình chọn";
        default:
            return "đã cập nhật bình chọn";
    }
}

function buildPollSystemPreview(
    lastMessage: NonNullable<Conversation["lastMessage"]>,
    currentUserId: number,
): string {
    const content = lastMessage.lastMessageContent?.trim() || DEFAULT_PREVIEW_TEXT;
    const title = extractPollTitle(content);
    const actorLabel =
        isAnonymousPollActorMessage(lastMessage.lastMessageType) && Number(lastMessage.lastSenderId) <= 0
            ? "Một thành viên"
            : Number(lastMessage.lastSenderId) === Number(currentUserId)
              ? "Bạn"
              : lastMessage.lastSenderName?.trim() || "Người dùng";

    return title
        ? `${actorLabel} ${getPollSystemAction(lastMessage.lastMessageType)}: ${title}`
        : `${actorLabel} ${getPollSystemAction(lastMessage.lastMessageType)}`;
}

function buildPinSystemPreview(
    lastMessage: NonNullable<Conversation["lastMessage"]>,
    currentUserId: number,
): string {
    const actorLabel =
        Number(lastMessage.lastSenderId) === Number(currentUserId)
            ? "Bạn"
            : lastMessage.lastSenderName?.trim() || "Người dùng";
    const action =
        lastMessage.lastMessageType === "SYSTEM_UPIN"
            ? "đã bỏ ghim một tin nhắn"
            : "đã ghim một tin nhắn";

    return `${actorLabel} ${action}`;
}

export function buildConversationLastMessagePreview({
    conversation,
    currentUserId,
}: ConversationLastMessagePreviewParams): ConversationLastMessagePreview {
    const lastMessage = conversation.lastMessage;
    if (!lastMessage) {
        return {
            text: DEFAULT_PREVIEW_TEXT,
            showSenderPrefix: false,
            senderLabel: "",
        };
    }

    if (isSystemMessageType(lastMessage.lastMessageType)) {
        const isFallbackMessage =
            !lastMessage.lastMessageContent?.trim() &&
            !lastMessage.lastSenderName?.trim() &&
            lastMessage.lastSenderId <= 0;

        if (isFallbackMessage) {
            if (lastMessage.lastMessageType === "SYSTEM_DISBAND_GROUP") {
                return {
                    text: buildSystemGroupMessage({
                        type: lastMessage.lastMessageType,
                        content: lastMessage.lastMessageContent,
                        isOwn: false,
                        senderName: lastMessage.lastSenderName,
                        senderId: lastMessage.lastSenderId,
                        currentUserId,
                        membersById: {},
                    }),
                    showSenderPrefix: false,
                    senderLabel: "",
                };
            }

            return {
                text: DEFAULT_PREVIEW_TEXT,
                showSenderPrefix: false,
                senderLabel: "",
            };
        }

        if (isPollSystemPreviewType(lastMessage.lastMessageType)) {
            return {
                text: buildPollSystemPreview(lastMessage, currentUserId),
                showSenderPrefix: false,
                senderLabel: "",
            };
        }

        if (isPinSystemPreviewType(lastMessage.lastMessageType)) {
            return {
                text: buildPinSystemPreview(lastMessage, currentUserId),
                showSenderPrefix: false,
                senderLabel: "",
            };
        }

        if (!isGroupSystemPreviewType(lastMessage.lastMessageType)) {
            return {
                text: lastMessage.lastMessageContent?.trim() || DEFAULT_PREVIEW_TEXT,
                showSenderPrefix: false,
                senderLabel: "",
            };
        }

        return {
            text: buildSystemGroupMessage({
                type: lastMessage.lastMessageType,
                content: lastMessage.lastMessageContent,
                isOwn: lastMessage.lastSenderId === currentUserId,
                senderName: lastMessage.lastSenderName,
                senderId: lastMessage.lastSenderId,
                currentUserId,
                membersById: {},
            }),
            showSenderPrefix: false,
            senderLabel: "",
        };
    }

    const normalizedContent = (lastMessage.lastMessageContent || "").trim();
    if (!normalizedContent) {
        return {
            text: DEFAULT_PREVIEW_TEXT,
            showSenderPrefix: false,
            senderLabel: "",
        };
    }

    const showSenderPrefix =
        conversation.type === "GROUP" ||
        lastMessage.lastSenderId === currentUserId;
    const senderLabel =
        lastMessage.lastSenderId === currentUserId
            ? "Bạn"
            : lastMessage.lastSenderName?.trim() || "Người dùng";

    return {
        text: normalizedContent,
        showSenderPrefix,
        senderLabel,
    };
}
