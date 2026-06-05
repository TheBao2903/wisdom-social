import {
    CHAT_PAGE_SIZE,
    DEFAULT_CHAT_USER_ID,
    RECALLED_REPLY_TEXT,
} from "@/constants/chat";
import chatRuntimeStore, {
    type MembersByUserId,
} from "@/stores/chatRuntimeStore";
import chatService from "@/services/chatService";
import {
    createClientMessageId,
    messageOutbox,
    persistOutboxMediaFiles,
    type OutboxMessage,
} from "@/services/messageOutbox";
import chatWebsocketService from "@/services/chatWebsocketService";
import type {
    BulkPresignedRequest,
    Conversation,
    ConversationMember,
    DirectBlockStatusChangedEvent,
    LocalUploadFile,
    MemberStatus,
    Message,
    MessageReactionEvent,
    MessageSeenEvent,
    PinnedMessageDetail,
    PollResponse,
    SendMessageRequest,
    TypingEvent,
} from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { setActiveConversationId, onConversationUnlocked } from "@/hooks/useMessagesController";
import { useAppContext } from "@/context/AppContext";
import { isMessageDeletedForUser } from "@/utils/chatMessageGuards";

const MARK_AS_READ_DEBOUNCE_MS = 1000;
const TYPING_STOP_TIMEOUT_MS = 10000;
const OUTBOX_RETRY_INTERVAL_MS = 3000;
const REALTIME_FALLBACK_POLL_MS = 1500;
const MAX_TEXT_MESSAGE_LENGTH = 3500;
const MAX_FILES_PER_SEND = 20;
const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const JUMP_NOT_FOUND_TOAST = "Khong the tim thay tin nhan";
const JUMP_TOAST_TIMEOUT_MS = 2400;
const GROUP_READ_ONLY_COMPOSER_NOTICE =
    "Ban khong the gui tin nhan vao nhom duoc nua";

const GROUP_SYSTEM_MEMBER_SYNC_TYPES = new Set<Message["type"]>([
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

function buildOptimisticTextMessage(
    request: SendMessageRequest,
    currentUserId: number,
    clientMessageId: string,
    createdAt = new Date().toISOString(),
): Message {
    return {
        id: `local-${clientMessageId}`,
        conversationId: request.conversationId ?? 0,
        clientMessageId,
        content: request.content,
        type: request.type,
        createdAt,
        senderId: currentUserId,
        replyInfo: request.replyToId
            ? {
                  messageId: request.replyToId,
              }
            : undefined,
        attachments: request.attachments,
        deliveryStatus: "sending",
    };
}

function splitLongTextMessage(
    content: string,
    maxLength = MAX_TEXT_MESSAGE_LENGTH,
): string[] {
    const trimmed = content.trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxLength) return [trimmed];

    const parts: string[] = [];
    let remaining = trimmed;

    while (remaining.length > maxLength) {
        const windowText = remaining.slice(0, maxLength + 1);
        const breakAt = Math.max(
            windowText.lastIndexOf("\n"),
            windowText.lastIndexOf(" "),
            windowText.lastIndexOf("\t"),
        );
        const splitAt = breakAt >= Math.floor(maxLength * 0.6) ? breakAt : maxLength;
        const part = remaining.slice(0, splitAt).trim();
        if (part) {
            parts.push(part);
        }
        remaining = remaining.slice(splitAt).trimStart();
    }

    if (remaining.trim()) {
        parts.push(remaining.trim());
    }

    return parts;
}

function buildOptimisticMediaMessage(
    files: LocalUploadFile[],
    conversationId: number,
    currentUserId: number,
    clientMessageId: string,
    replyToId?: string,
): Message {
    const now = new Date().toISOString();
    const hasImage = files.some(isImageFile);
    const firstFile = files[0];
    const type: Message["type"] = hasImage
        ? "IMAGE"
        : firstFile.mimeType.startsWith("video/")
          ? "VIDEO"
          : firstFile.mimeType.startsWith("audio/")
            ? "AUDIO"
            : "FILE";

    return {
        id: `local-${clientMessageId}`,
        conversationId,
        clientMessageId,
        content: "",
        type,
        createdAt: now,
        senderId: currentUserId,
        replyInfo: replyToId ? { messageId: replyToId } : undefined,
        attachments: files
            .filter((file) => (hasImage ? isImageFile(file) : true))
            .map((file) => ({
                url: file.uri,
                type: file.mimeType || "application/octet-stream",
                fileName: file.fileName,
                fileSize: file.fileSize,
            })),
        deliveryStatus: "sending",
    };
}

function resolveUploadedMediaUrl(presignedUrl: string, objectKey: string): string {
    try {
        const url = new URL(presignedUrl);
        return `${url.origin}${url.pathname}`;
    } catch {
        return objectKey;
    }
}

function dedupeMessagesByIdentity(messages: Message[]): Message[] {
    const seenIds = new Set<string>();
    const seenClientIds = new Set<string>();
    const deduped: Message[] = [];

    for (const message of messages) {
        const messageId = String(message.id);
        if (messageId && !messageId.startsWith("local-")) {
            if (seenIds.has(messageId)) continue;
            seenIds.add(messageId);
        }

        if (message.clientMessageId) {
            if (seenClientIds.has(message.clientMessageId)) continue;
            seenClientIds.add(message.clientMessageId);
        }

        deduped.push(message);
    }

    return deduped;
}

function isLikelyNetworkSendError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as {
        code?: string;
        message?: string;
        response?: {
            status?: number;
            data?: unknown;
        };
    };
    const message = candidate.message?.toLowerCase() ?? "";
    const status = candidate.response?.status;
    const responseData = candidate.response?.data;
    const responseText =
        typeof responseData === "string" ? responseData.toLowerCase() : "";

    return (
        ((status === 401 || status === 403) &&
            (responseData == null ||
                responseData === "" ||
                (typeof responseData === "object" &&
                    Object.keys(responseData as Record<string, unknown>).length === 0))) ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        (status === 500 &&
            (responseData == null ||
                responseData === "" ||
                responseText.includes("econnrefused") ||
                responseText.includes("network"))) ||
        (!candidate.response &&
            (candidate.code === "ERR_NETWORK" ||
                candidate.code === "ECONNABORTED" ||
                message.includes("network") ||
                message.includes("failed to fetch")))
    );
}

export interface ReadReceipt {
    userId: number;
    lastMessageId: string;
    seenAt: string;
}

function toMembersByUserId(
    members:
        | ConversationMember[]
        | Record<string, ConversationMember>
        | null
        | undefined,
): MembersByUserId {
    const normalized: MembersByUserId = {};
    if (!members) return normalized;

    if (Array.isArray(members)) {
        for (const member of members) {
            normalized[member.userId] = member;
        }
        return normalized;
    }

    for (const [rawUserId, member] of Object.entries(members)) {
        if (!member || typeof member !== "object") continue;

        const valueUserId = (member as { userId?: unknown }).userId;
        const userId =
            typeof valueUserId === "number" ? valueUserId : Number(rawUserId);

        if (!Number.isFinite(userId)) continue;

        normalized[userId] = {
            ...(member as ConversationMember),
            userId,
            nickname: (member as ConversationMember).nickname || "Unknown",
            username: (member as ConversationMember).username || "",
        };
    }

    return normalized;
}

function hasUsefulMemberIdentity(member: ConversationMember | undefined): boolean {
    if (!member) return false;
    const nickname = member.nickname?.trim();
    const username = member.username?.trim();
    return Boolean(
        (nickname && nickname !== "Unknown") ||
            (username && username !== "Unknown") ||
            member.avatar?.trim(),
    );
}

function mergeMembersByIdentity(
    ...sources: Array<MembersByUserId | null | undefined>
): MembersByUserId {
    const merged: MembersByUserId = {};

    for (const source of sources) {
        if (!source) continue;

        for (const member of Object.values(source)) {
            const userId = Number(member.userId);
            if (!Number.isFinite(userId)) continue;

            const existing = merged[userId];
            if (!existing) {
                merged[userId] = {
                    ...member,
                    userId,
                    nickname: member.nickname || "Unknown",
                    username: member.username || "",
                };
                continue;
            }

            const incomingHasIdentity = hasUsefulMemberIdentity(member);
            const existingHasIdentity = hasUsefulMemberIdentity(existing);
            const hasIncomingLockFlag = Object.prototype.hasOwnProperty.call(
                member,
                "accountLocked",
            );

            merged[userId] = {
                ...existing,
                ...member,
                userId,
                nickname:
                    incomingHasIdentity || !existingHasIdentity
                        ? member.nickname || existing.nickname || "Unknown"
                        : existing.nickname || member.nickname || "Unknown",
                username:
                    incomingHasIdentity || !existingHasIdentity
                        ? member.username || existing.username || ""
                        : existing.username || member.username || "",
                avatar:
                    incomingHasIdentity || !existingHasIdentity
                        ? member.avatar || existing.avatar
                        : existing.avatar || member.avatar,
                accountLocked: hasIncomingLockFlag
                    ? Boolean(member.accountLocked)
                    : Boolean(existing.accountLocked),
            };
        }
    }

    return merged;
}

function normalizeReplyPreviewContent(message: Message): Message {
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

function normalizeMessagesForUi(messages: Message[]): Message[] {
    return messages.map(normalizeReplyPreviewContent);
}

function incrementMessageReaction(
    message: Message,
    emoji: string,
    userId: number,
): Message {
    const reactions = message.iconName ?? [];
    const reactionIndex = reactions.findIndex((reaction) => reaction.name === emoji);

    if (reactionIndex < 0) {
        return {
            ...message,
            iconName: [
                ...reactions,
                {
                    name: emoji,
                    user: [{ userId, quantity: 1 }],
                },
            ],
        };
    }

    const nextReactions = reactions.map((reaction, index) => {
        if (index !== reactionIndex) return reaction;

        const users = reaction.user ?? [];
        const userIndex = users.findIndex(
            (reactionUser) => Number(reactionUser.userId) === Number(userId),
        );

        if (userIndex < 0) {
            return {
                ...reaction,
                user: [...users, { userId, quantity: 1 }],
            };
        }

        return {
            ...reaction,
            user: users.map((reactionUser, reactionUserIndex) =>
                reactionUserIndex === userIndex
                    ? {
                          ...reactionUser,
                          quantity: reactionUser.quantity + 1,
                      }
                    : reactionUser,
            ),
        };
    });

    return {
        ...message,
        iconName: nextReactions,
    };
}

function isImageFile(file: LocalUploadFile): boolean {
    return file.mimeType.startsWith("image/");
}

function toAttachmentCategory(
    file: LocalUploadFile,
): BulkPresignedRequest["files"][number]["type"] {
    if (file.mimeType.startsWith("image/")) return "IMAGE";
    if (file.mimeType.startsWith("video/")) return "VIDEO";
    if (file.mimeType.startsWith("audio/")) return "AUDIO";
    return "FILE";
}

function getValidationErrorForFiles(files: LocalUploadFile[]): string | null {
    if (files.length === 0) return null;

    if (files.length > MAX_FILES_PER_SEND) {
        return `Moi lan gui toi da ${MAX_FILES_PER_SEND} tep`;
    }

    for (const file of files) {
        const maxAllowed = isImageFile(file)
            ? MAX_IMAGE_SIZE_BYTES
            : MAX_FILE_SIZE_BYTES;
        if (file.fileSize > maxAllowed) {
            const maxMb = isImageFile(file) ? 25 : 100;
            return `Tep ${file.fileName} vuot qua ${maxMb}MB`;
        }
    }

    return null;
}

function getFileClientKey(file: LocalUploadFile): string {
    return `${file.fileName}-${file.fileSize}-${file.uri}`;
}

function buildLastMessagePreview(message: Message): string {
    if (message.isRecalled) return "Tin nhan da duoc thu hoi";
    if (message.type === "IMAGE") return "[Hinh anh]";
    if (message.type === "VIDEO") return "[Video]";
    if (message.type === "AUDIO") return "[Tin nhan thoai]";
    if (message.type === "FILE") return "[Tep dinh kem]";

    return message.content || "Tin nhan";
}

function safeParseMemberIds(content: string): number[] {
    if (!content) return [];

    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((value: any) => {
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

function resolveReadOnlyReasonFromApiMessage(message: string): string | null {
    const normalized = message.toLowerCase();

    if (
        normalized.includes("xoa khoi nhom") ||
        normalized.includes("bi duoi") ||
        normalized.includes("bi kick") ||
        normalized.includes("kicked") ||
        normalized.includes("xóa khỏi nhóm")
    ) {
        return "Bạn đã bị xóa khỏi nhóm.";
    }
    if (
        normalized.includes("chan khoi nhom") 
    ) {
        return "Bạn đã bị chặn khỏi nhóm";
    }

    if (
        normalized.includes("roi nhom") ||
        normalized.includes("roi khoi nhom") ||
        normalized.includes("rời khỏi nhóm")
    ) {
        return "Bạn đã rời khỏi nhóm.";
    }

    if (normalized.includes("giai tan") || normalized.includes("giải tán")) {
        return "Nhóm đã bị giải tán.";
    }

    if (
        normalized.includes("khong phai thanh vien") ||
        normalized.includes("khong co quyen") ||
        normalized.includes("access denied") ||
        normalized.includes("forbidden") ||
        normalized.includes("không có quyền")
    ) {
        return "Bạn không có quyền truy cập hội thoại này.";
    }

    return null;
}

function extractApiErrorMessage(error: unknown): string | null {
    if (
        error &&
        typeof error === "object" &&
        "response" in (error as Record<string, unknown>)
    ) {
        const response = (
            error as {
                response?: {
                    status?: number;
                    data?: {
                        message?: string;
                        error?: string;
                        data?: { message?: string };
                    };
                };
            }
        ).response;

        const status = response?.status;
        const payload = response?.data;
        const direct = payload?.message;
        const nested = payload?.data?.message;
        const spring = payload?.error;

        const candidate = direct || nested || spring;
        if (candidate && candidate.trim()) {
            return candidate;
        }

        if (status === 403) {
            return "Bạn không có quyền truy cập hội thoại này.";
        }
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return null;
}

function resolveReadOnlyReasonFromConversation(
    conversation: Conversation | null,
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

    if (conversation.isMessageRestricted) {
        if (currentMember.role === "MEMBER") {
            return "Chỉ trưởng/phó nhóm mới có thể gửi tin nhắn";
        }
    }

    return null;
}

function resolveReadOnlyReasonFromSystemMessage(
    message: Message,
    currentUserId: number,
): string | null {
    if (message.type === "SYSTEM_DISBAND_GROUP") {
        return "Nhom da bi giai tan.";
    }

    if (message.type === "SYSTEM_LEAVE_GROUP") {
        if (Number(message.senderId) === Number(currentUserId)) {
            return "Ban da roi khoi nhom.";
        }
        return null;
    }

    if (message.type === "SYSTEM_KICK_MEMBER") {
        const targetIds = safeParseMemberIds(message.content);
        if (targetIds.some((id) => Number(id) === Number(currentUserId))) {
            return "Ban da bi xoa khoi nhom.";
        }
    }
     if (message.type === "SYSTEM_BLOCK_MEMBER") {
        const targetIds = safeParseMemberIds(message.content);
        if (targetIds.some((id) => Number(id) === Number(currentUserId))) {
            return "Ban da bi chan khoi nhom.";
        }
    }

    if (message.type === "SYSTEM_UPDATE_SETTING") {
        if (message.content.includes("isMessageRestricted:true")) {
            // Check current role. Since we don't have full conversation here easily, 
            // the main useEffect will handle syncing the full conversation state.
            // But we return a generic string here if we want immediate notice.
            return "Cai dat nhom da thay doi.";
        }
    }

    return null;
}

function resolveReadOnlyReasonFromCachedConversation(
    conversation: Conversation | null,
    currentUserId: number,
): string | null {
    if (!conversation || conversation.type !== "GROUP") return null;

    const conversationReason = resolveReadOnlyReasonFromConversation(
        conversation,
        currentUserId,
    );
    if (conversationReason) return conversationReason;

    const members = conversation.members;
    if (members && members.length > 0) {
        const currentMember = members.find(
            (member) => Number(member.userId) === Number(currentUserId),
        );
        if (!currentMember) {
            return "Ban da bi xoa khoi nhom.";
        }
    }

    const lastMessage = conversation.lastMessage;
    if (!lastMessage) return null;

    if (lastMessage.lastMessageType === "SYSTEM_DISBAND_GROUP") {
        return "Nhom da bi giai tan.";
    }

    if (
        lastMessage.lastMessageType === "SYSTEM_LEAVE_GROUP" &&
        Number(lastMessage.lastSenderId) === Number(currentUserId)
    ) {
        return "Ban da roi khoi nhom.";
    }

    if (lastMessage.lastMessageType === "SYSTEM_KICK_MEMBER" || lastMessage.lastMessageType === "SYSTEM_BLOCK_MEMBER") {
        const targetIds = safeParseMemberIds(
            lastMessage.lastMessageContent ?? "",
        );
        if (targetIds.some((id) => Number(id) === Number(currentUserId))) {
            if (lastMessage.lastMessageType === "SYSTEM_BLOCK_MEMBER") {
                return "Ban da bi chan khoi nhom.";
            }
            return "Ban da bi xoa khoi nhom.";
        }
    }

    return null;
}

export function useChatWindowController(args: {
    conversationId: number;
    onMarkAsRead?: (conversationId: number) => void;
    onAccessBlocked?: () => void;
}) {
    const { conversationId, onMarkAsRead, onAccessBlocked } = args;

    const { currentUser } = useAppContext();
    const currentUserId = Number(currentUser?.id ?? 0);
    const isScreenFocusedRef = useRef(false);
    const isScreenFocused = useIsFocused();
    isScreenFocusedRef.current = isScreenFocused;

    // Thông báo cho useMessagesController biết conversation nào đang mở.
    // Điều này cho phép sidebar không tăng unreadCount khi user đang xem conversation.
    useEffect(() => {
        if (isScreenFocused) {
            setActiveConversationId(conversationId);
        } else {
            setActiveConversationId(null);
        }
        return () => {
            setActiveConversationId(null);
        };
    }, [conversationId, isScreenFocused]);

    const [messageText, setMessageText] = useState("");
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [membersById, setMembersById] = useState<MembersByUserId>({});
    const [messages, setMessages] = useState<Message[]>([]);
    const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageDetail[]>(
        [],
    );
    const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);
    const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgressPercent, setUploadProgressPercent] = useState<
        number | null
    >(null);
    const [uploadProgressLabel, setUploadProgressLabel] = useState("");
    const [uploadFileProgressMap, setUploadFileProgressMap] = useState<
        Record<string, number>
    >({});
    const [uploadFailedFileNames, setUploadFailedFileNames] = useState<
        string[]
    >([]);
    const [readOnlyNotice, setReadOnlyNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const currentUserMember = membersById[currentUserId];
    const isRestrictedMember =
        conversation?.isMessageRestricted && currentUserMember?.role === "MEMBER";
    const canRecallOwnMessages = !isRestrictedMember;
    const [jumpToast, setJumpToast] = useState<string | null>(null);
    const onAccessBlockedRef = useRef(onAccessBlocked);
    const [olderCursor, setOlderCursor] = useState<string | null>(null);
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [hasMoreNewer, setHasMoreNewer] = useState(false);
    const [isHistoricalMode, setIsHistoricalMode] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadingNewer, setLoadingNewer] = useState(false);

    const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const pendingMarkAsReadIdRef = useRef<string | null>(null);
    const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const realtimePollLockRef = useRef(false);
    const isTypingSentRef = useRef(false);
    const loadInitialDataRunCountRef = useRef(0);
    const loadTokenRef = useRef<number>(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadInitialDataRef = useRef<(token: number) => Promise<void>>(
        null as any,
    );
    const jumpToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const typingTimeoutsRef = useRef<
        Map<number, ReturnType<typeof setTimeout>>
    >(new Map());
    const readReceiptCatchupTimeoutsRef = useRef<
        ReturnType<typeof setTimeout>[]
    >([]);

    const showJumpToast = useCallback(
        (message: string = JUMP_NOT_FOUND_TOAST) => {
            setJumpToast(message);
        },
        [],
    );

    useEffect(() => {
        onAccessBlockedRef.current = onAccessBlocked;
    }, [onAccessBlocked]);

    const clearUnreadLocally = useCallback(() => {
        setConversation((prev) =>
            prev
                ? {
                      ...prev,
                      unreadCount: 0,
                  }
                : prev,
        );

        chatRuntimeStore.patchConversation(conversationId, {
            unreadCount: 0,
        });
    }, [conversationId]);

    const executeMarkAsRead = useCallback(
        async (lastMessageId?: string, options?: { force?: boolean }) => {
            if (!options?.force && !isScreenFocused) {
                return;
            }

            clearUnreadLocally();

            try {
                await chatService.markAsRead(
                    conversationId,
                    currentUserId,
                    lastMessageId,
                );
                onMarkAsRead?.(conversationId);
            } catch {
                // no-op
            }
        },
        [
            clearUnreadLocally,
            conversationId,
            currentUserId,
            isScreenFocused,
            onMarkAsRead,
        ],
    );

    const markAsRead = useCallback(
        (lastMessageId: string, options?: { force?: boolean }) => {
            if (!isScreenFocused) return;
            if (!options?.force && isHistoricalMode) return;

            clearUnreadLocally();
            pendingMarkAsReadIdRef.current = lastMessageId;

            if (markAsReadTimeoutRef.current) {
                clearTimeout(markAsReadTimeoutRef.current);
            }

            markAsReadTimeoutRef.current = setTimeout(() => {
                const pendingLastMessageId = pendingMarkAsReadIdRef.current;
                markAsReadTimeoutRef.current = null;
                pendingMarkAsReadIdRef.current = null;

                if (!pendingLastMessageId) return;
                void executeMarkAsRead(pendingLastMessageId);
            }, MARK_AS_READ_DEBOUNCE_MS);
        },
        [
            clearUnreadLocally,
            executeMarkAsRead,
            isHistoricalMode,
            isScreenFocused,
        ],
    );

    const mergeReferenceUsers = useCallback(
        (
            baseMembers: MembersByUserId,
            referenceUsers: Record<
                string,
                { nickname: string; avatar?: string }
            >,
        ): MembersByUserId => {
            if (Object.keys(referenceUsers).length === 0) return baseMembers;

            const nextMembers = { ...baseMembers };
            for (const [rawUserId, reference] of Object.entries(
                referenceUsers,
            )) {
                const refUserId = Number(rawUserId);
                if (!Number.isFinite(refUserId)) continue;

                nextMembers[refUserId] = {
                    ...(nextMembers[refUserId] ?? {
                        userId: refUserId,
                        username: "",
                        nickname: reference.nickname || "Unknown",
                        avatar: reference.avatar,
                    }),
                    userId: refUserId,
                    nickname:
                        nextMembers[refUserId]?.nickname ||
                        reference.nickname ||
                        "Unknown",
                    avatar: nextMembers[refUserId]?.avatar || reference.avatar,
                };
            }

            return nextMembers;
        },
        [],
    );

    const loadInitialData = useCallback(
        async (token: number) => {
            loadInitialDataRunCountRef.current += 1;
            console.log("[JUMP_DEBUG][controller] loadInitialData:start", {
                conversationId,
                run: loadInitialDataRunCountRef.current,
                isScreenFocused: isScreenFocusedRef.current,
            });

            try {
                setLoading(true);
                setError(null);
                setReadOnlyNotice(null);

                // Align with web UX: entering a conversation should clear unread immediately.
                if (isScreenFocusedRef.current) {
                    clearUnreadLocally();
                }

                const cachedConversation =
                    chatRuntimeStore.getConversation(conversationId);
                const cachedMembers =
                    chatRuntimeStore.getMembers(conversationId);
                const cachedMessages =
                    chatRuntimeStore.getMessages(conversationId);
                const cachedPins = chatRuntimeStore.getPins(conversationId);

                if (cachedConversation) {
                    const cachedVisibleMembers = mergeMembersByIdentity(
                        toMembersByUserId(cachedConversation.members),
                        cachedMembers,
                    );
                    const cachedConversationWithMembers: Conversation = {
                        ...cachedConversation,
                        members: Object.values(cachedVisibleMembers),
                    };
                    const cachedReadOnlyReason =
                        resolveReadOnlyReasonFromCachedConversation(
                            cachedConversationWithMembers,
                            currentUserId,
                        );

                    setConversation(cachedConversationWithMembers);
                    setMembersById(cachedVisibleMembers);
                    if (cachedReadOnlyReason) {
                        setReadOnlyNotice(cachedReadOnlyReason);
                        setMessages([]);
                        setPinnedMessages([]);
                    } else {
                        setMessages(cachedMessages);
                        setPinnedMessages(cachedPins);
                    }
                } else {
                    setConversation(null);
                    setMembersById({});
                    setMessages([]);
                    setPinnedMessages([]);
                }

                const convResponse = await chatService.getConversation(
                    conversationId,
                    currentUserId,
                );

                // Nếu người dùng đã chuyển sang conversation khác thì bỏ qua kết quả này.
                if (token !== loadTokenRef.current) return;

                if (!convResponse.success || !convResponse.data) {
                    const apiMessage =
                        convResponse.message || "Khong the tai cuoc tro chuyen";
                    setReadOnlyNotice(
                        resolveReadOnlyReasonFromApiMessage(apiMessage),
                    );
                    setError(apiMessage);
                    return;
                }

               let membersResponse = null;
let messagesResponse = null;

try {
    membersResponse = await chatService.getConversationMembers(conversationId);
} catch (e) {
    membersResponse = null;
}

try {
    messagesResponse = await chatService.getMessages(
        conversationId,
        currentUserId,
        null,
        CHAT_PAGE_SIZE,
    );
} catch (e) {
    messagesResponse = null;
}

if (token !== loadTokenRef.current) return;

                const cursorData = messagesResponse?.success
                    ? messagesResponse.data
                    : null;
                const normalizedMessages = Array.isArray(cursorData?.data)
                    ? normalizeMessagesForUi(cursorData.data)
                    : [];

                const membersFromDetail = toMembersByUserId(
                    convResponse.data.members,
                );
                const membersFromApi = toMembersByUserId(membersResponse);
                const baseMembers = mergeMembersByIdentity(
                    toMembersByUserId(cachedConversation?.members),
                    cachedMembers,
                    membersFromDetail,
                    membersFromApi,
                );
                const mergedMembers = mergeReferenceUsers(
                    baseMembers,
                    cursorData?.referenceUsers ?? {},
                );

                const normalizedConversation: Conversation = {
                    ...convResponse.data,
                    members: Object.values(mergedMembers),
                };

                setReadOnlyNotice(
                    resolveReadOnlyReasonFromConversation(
                        normalizedConversation,
                        currentUserId,
                    ),
                );

                const initialPins = normalizedConversation.pinnedMessages ?? [];

                const runtimeConversation = chatRuntimeStore.setConversation(
                    conversationId,
                    normalizedConversation,
                );
                const runtimeMembers = chatRuntimeStore.setMembers(
                    conversationId,
                    mergedMembers,
                );
                chatRuntimeStore.setMessages(
                    conversationId,
                    normalizedMessages,
                );
                chatRuntimeStore.setPins(conversationId, initialPins);
                chatRuntimeStore.setPaging(conversationId, {
                    hasMoreOlder: Boolean(cursorData?.hasMoreOlder),
                    hasMoreNewer: Boolean(cursorData?.hasMoreNewer),
                    isHistoricalMode: false,
                    olderCursor: cursorData?.nextCursor ?? null,
                });

                const visibleMembers =
                    Object.keys(runtimeMembers).length > 0
                        ? runtimeMembers
                        : toMembersByUserId(runtimeConversation.members);
                const visibleConversation: Conversation = {
                    ...runtimeConversation,
                    members:
                        Object.keys(visibleMembers).length > 0
                            ? Object.values(visibleMembers)
                            : runtimeConversation.members,
                };

                setConversation(visibleConversation);
                setMembersById(visibleMembers);
                setMessages(normalizedMessages);
                setPinnedMessages(initialPins);
                setReadReceipts(
                    Object.values(visibleMembers)
                        .filter(
                            (member) =>
                                member.userId !== currentUserId &&
                                Boolean(member.lastReadMessageId),
                        )
                        .map((member) => ({
                            userId: member.userId,
                            lastMessageId: member.lastReadMessageId!,
                            seenAt: new Date().toISOString(),
                        })),
                );
                setHasMoreOlder(Boolean(cursorData?.hasMoreOlder));
                setHasMoreNewer(Boolean(cursorData?.hasMoreNewer));
                setIsHistoricalMode(false);
                setOlderCursor(cursorData?.nextCursor ?? null);

                const lastMessage = normalizedMessages.at(-1);
                if (lastMessage && isScreenFocusedRef.current) {
                    void executeMarkAsRead(lastMessage.id, { force: true });
                }

                console.log("[JUMP_DEBUG][controller] loadInitialData:done", {
                    conversationId,
                    run: loadInitialDataRunCountRef.current,
                    messageCount: normalizedMessages.length,
                    hasMoreOlder: Boolean(cursorData?.hasMoreOlder),
                    hasMoreNewer: Boolean(cursorData?.hasMoreNewer),
                });
            } catch (err) {
                // Nếu người dùng đã chuyển sang conversation khác thì bỏ qua lỗi này.
                if (token !== loadTokenRef.current) return;

                const apiMessage = extractApiErrorMessage(err);
                const fallbackReason = resolveReadOnlyReasonFromApiMessage(
                    apiMessage || "",
                );

                // Nếu lỗi là 403 hoặc thông báo lỗi liên quan đến quyền truy cập/kick:
                if (fallbackReason) {
                    setReadOnlyNotice(fallbackReason);
                    // ĐỪNG XÓA conversation/membersById ở đây!
                    // Nếu xóa, component MessagesConversation sẽ không render được header (vì conversation null).
                    // Chỉ cần block việc nhập text (do readOnlyNotice) là đủ.
                } else {
                    setError(apiMessage || "Khong the tai du lieu chat");
                }
            } finally {
                if (token === loadTokenRef.current) {
                    setLoading(false);
                }
            }
        },
        [
            clearUnreadLocally,
            conversationId,
            currentUserId,
            executeMarkAsRead,
            mergeReferenceUsers,
        ],
    );

    // Giữ ref luôn trỏ đến phiên bản mới nhất của loadInitialData
    // để useEffect chỉ cần phụ thuộc vào conversationId, tránh double-fire.
    loadInitialDataRef.current = loadInitialData;

    useEffect(() => {
        // RESET STATE TỨC THÌ KHI ĐỔI CONVERSATION
        setConversation(null);
        setMembersById({});
        setMessages([]);
        setPinnedMessages([]);
        setReadOnlyNotice(null);
        setError(null);

        const token = Date.now();
        loadTokenRef.current = token;

        console.log("[JUMP_DEBUG][controller] effect->loadInitialData", {
            conversationId,
            token,
        });
        void loadInitialDataRef.current(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    // Lắng nghe tín hiệu unlock từ useMessagesController
    useEffect(() => {
        if (!conversationId) return;

        const handleUnlock = (unlockedConversationId: number) => {
            if (unlockedConversationId === conversationId && isScreenFocused) {
                console.log(
                    "[JUMP_DEBUG][controller] conversation unlocked, reloading",
                    { conversationId }
                );
                
                // Clear state lỗi và reload
                setReadOnlyNotice(null);
                setError(null);
                setLoading(true);
                
                const token = Date.now();
                loadTokenRef.current = token;
                void loadInitialDataRef.current(token);
            }
        };

        const unsubscribe = onConversationUnlocked(handleUnlock);
        return () => unsubscribe();
    }, [conversationId, isScreenFocused]);

    useEffect(() => {
        if (!jumpToast) return;

        if (jumpToastTimerRef.current) {
            clearTimeout(jumpToastTimerRef.current);
        }

        jumpToastTimerRef.current = setTimeout(() => {
            setJumpToast(null);
            jumpToastTimerRef.current = null;
        }, JUMP_TOAST_TIMEOUT_MS);

        return () => {
            if (!jumpToastTimerRef.current) return;
            clearTimeout(jumpToastTimerRef.current);
            jumpToastTimerRef.current = null;
        };
    }, [jumpToast]);

    const applyRecallDomino = useCallback(
        (messageId: string) => {
            console.log(
                "[RECALL_DEBUG][mobile][useChatWindowController] applyRecallDomino",
                {
                    conversationId,
                    messageId,
                },
            );

            const mapper = (message: Message): Message => {
                if (message.id === messageId) {
                    return {
                        ...message,
                        isRecalled: true,
                        content: "",
                        attachments: [],
                    };
                }

                if (message.replyInfo?.messageId === messageId) {
                    return {
                        ...message,
                        replyInfo: {
                            ...message.replyInfo,
                            content: RECALLED_REPLY_TEXT,
                        },
                    };
                }

                return message;
            };

            setMessages((prev) => {
                const next = prev.map(mapper);
                chatRuntimeStore.setMessages(conversationId, next);
                return next;
            });
        },
        [conversationId],
    );

    const handleMessageReactionEvent = useCallback(
        (updatedMessage: Message) => {
            setMessages((prev) => {
                const nextMessages = prev.map((message) =>
                    message.id === updatedMessage.id ? updatedMessage : message,
                );
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
            });
        },
        [conversationId],
    );

    const handlePollUpdatedEvent = useCallback(
        (poll: PollResponse) => {
            setMessages((prev) => {
                const nextMessages = prev.map((message) =>
                    message.id === poll.messageId || message.pollId === poll.id
                        ? {
                              ...message,
                              pollId: poll.id,
                              poll: {
                                  ...poll,
                                  currentUserOptionIds:
                                      message.poll?.currentUserOptionIds ??
                                      poll.currentUserOptionIds ??
                                      [],
                              },
                          }
                        : message,
                );
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
            });
        },
        [conversationId],
    );

    const handleNewMessage = useCallback(
        (incomingMessage: Message) => {
            const normalizedIncoming =
                normalizeReplyPreviewContent(incomingMessage);
            const incomingClientMessageId = normalizedIncoming.clientMessageId;

            if (incomingClientMessageId) {
                let replacedOptimistic = false;
                setMessages((prev) => {
                    const existingIndex = prev.findIndex(
                        (item) => item.clientMessageId === incomingClientMessageId,
                    );
                    if (existingIndex < 0) return prev;

                    replacedOptimistic = true;
                    const next = [...prev];
                    next[existingIndex] = {
                        ...normalizedIncoming,
                        deliveryStatus: "sent",
                    };
                    const deduped = dedupeMessagesByIdentity(next);
                    chatRuntimeStore.setMessages(conversationId, deduped);
                    return deduped;
                });

                if (replacedOptimistic) {
                    void messageOutbox.remove(incomingClientMessageId);
                }
            }

            setMessages((prev) => {
                if (prev.some((item) => item.id === normalizedIncoming.id)) {
                    return prev;
                }
                if (
                    normalizedIncoming.clientMessageId &&
                    prev.some(
                        (item) =>
                            item.clientMessageId ===
                            normalizedIncoming.clientMessageId,
                    )
                ) {
                    const next = prev.map((item) =>
                        item.clientMessageId === normalizedIncoming.clientMessageId
                            ? { ...normalizedIncoming, deliveryStatus: "sent" as const }
                            : item,
                    );
                    const deduped = dedupeMessagesByIdentity(next);
                    chatRuntimeStore.setMessages(conversationId, deduped);
                    return deduped;
                }

                const next = [
                    ...prev,
                    normalizedIncoming.senderId === currentUserId
                        ? { ...normalizedIncoming, deliveryStatus: "sent" as const }
                        : normalizedIncoming,
                ];
                const deduped = dedupeMessagesByIdentity(next);
                chatRuntimeStore.setMessages(conversationId, deduped);
                return deduped;
            });

            setConversation((prev) => {
                if (!prev) return prev;

                const senderMember = (prev.members ?? []).find(
                    (member) =>
                        Number(member.userId) ===
                        Number(normalizedIncoming.senderId),
                );
                const resolvedSenderName =
                    normalizedIncoming.senderName?.trim() ||
                    senderMember?.nickname?.trim() ||
                    senderMember?.username?.trim() ||
                    "";
                const nextLastMessage = {
                    lastMessageContent:
                        buildLastMessagePreview(normalizedIncoming),
                    lastMessageType: normalizedIncoming.type,
                    lastSenderId: normalizedIncoming.senderId,
                    lastSenderName: resolvedSenderName,
                    lastMessageAt: normalizedIncoming.createdAt,
                    read: normalizedIncoming.senderId === currentUserId,
                };
                const next: Conversation = {
                    ...prev,
                    updatedAt: normalizedIncoming.createdAt,
                    unreadCount: 0,
                    lastMessage: nextLastMessage,
                };

                chatRuntimeStore.patchConversation(conversationId, {
                    updatedAt: normalizedIncoming.createdAt,
                    unreadCount: 0,
                    lastMessage: nextLastMessage,
                }) ??
                    chatRuntimeStore.setConversation(conversationId, {
                        ...next,
                        members: undefined,
                    });
                return next;
            });

            if (normalizedIncoming.type === "SYSTEM_ADD_MEMBER") {
                const addedMemberIds = safeParseMemberIds(
                    normalizedIncoming.content,
                );
                if (
                    addedMemberIds.some(
                        (memberId) =>
                            Number(memberId) === Number(currentUserId),
                    )
                ) {
                    setReadOnlyNotice(null);
                    setError(null);

                    const token = Date.now();
                    loadTokenRef.current = token;
                    void loadInitialDataRef.current(token);
                }
            }

            const readOnlyReason = resolveReadOnlyReasonFromSystemMessage(
                normalizedIncoming,
                currentUserId,
            );
            if (readOnlyReason) {
                setReadOnlyNotice(readOnlyReason);
                
                // Chỉ dọn dẹp state nếu là các lỗi nghiêm trọng (bị đuổi, rời nhóm, giải tán)
                // để UI chuyển sang 'Error View'. Nếu chỉ là chặn tin nhắn thì vẫn để user xem được chat.
                const isAccessBlocked = 
                    normalizedIncoming.type === "SYSTEM_DISBAND_GROUP" ||
                    normalizedIncoming.type === "SYSTEM_KICK_MEMBER" ||
                    normalizedIncoming.type === "SYSTEM_LEAVE_GROUP";

                if (isAccessBlocked) {
                    setConversation((prev) => {
                        if (!prev) return prev;

                        const blockedStatus: MemberStatus =
                            normalizedIncoming.type === "SYSTEM_LEAVE_GROUP"
                                ? "LEFT"
                                : normalizedIncoming.type ===
                                    "SYSTEM_DISBAND_GROUP"
                                  ? "GROUP_DISBANDED"
                                  : "KICKED";
                        const nextMembers = (prev.members ?? []).map(
                            (member) =>
                                Number(member.userId) === Number(currentUserId)
                                    ? {
                                          ...member,
                                          status: blockedStatus,
                                      }
                                    : member,
                        );

                        const next = {
                            ...prev,
                            members: nextMembers,
                        };

                        chatRuntimeStore.setConversation(conversationId, next);
                        return next;
                    });
                    onAccessBlockedRef.current?.();
                }
                return;
            }

            if (GROUP_SYSTEM_MEMBER_SYNC_TYPES.has(normalizedIncoming.type)) {
                const memberSnapshotVersion =
                    chatRuntimeStore.markMembersChanging(conversationId);
                void Promise.all([
                    chatService.getConversation(conversationId, currentUserId),
                    chatService.getConversationMembers(conversationId),
                ])
                    .then(([convResponse, membersResponse]) => {
                        if (!convResponse.success || !convResponse.data) {
                            return;
                        }

                        const normalizedMembers =
                            toMembersByUserId(membersResponse);
                        const fetchedConversation: Conversation = {
                            ...convResponse.data,
                            members: Object.values(normalizedMembers),
                        };
                        const runtimeMembers = chatRuntimeStore.setMembers(
                            conversationId,
                            normalizedMembers,
                            { memberSnapshotVersion },
                        );
                        const runtimeConversation =
                            chatRuntimeStore.setConversation(
                                conversationId,
                                fetchedConversation,
                                { memberSnapshotVersion },
                            );
                        const visibleMembers =
                            Object.keys(runtimeMembers).length > 0
                                ? runtimeMembers
                                : toMembersByUserId(runtimeConversation.members);
                        const nextConversation: Conversation = {
                            ...runtimeConversation,
                            members:
                                Object.keys(visibleMembers).length > 0
                                    ? Object.values(visibleMembers)
                                    : runtimeConversation.members,
                        };

                        setConversation(nextConversation);
                        setMembersById(visibleMembers);

                        setReadOnlyNotice(
                            resolveReadOnlyReasonFromConversation(
                                nextConversation,
                                currentUserId,
                            ),
                        );
                    })
                    .catch(() => undefined);
            }

            if (normalizedIncoming.senderId !== currentUserId) {
                markAsRead(normalizedIncoming.id);
            }
        },
        [conversationId, currentUserId, markAsRead],
    );

    const handleMessageSeen = useCallback(
        (event: MessageSeenEvent) => {
            const payload = event.messageSeenResponse;
            if (Number(payload.userId) === Number(currentUserId)) return;

            setReadReceipts((prev) => {
                const index = prev.findIndex(
                    (item) => item.userId === Number(payload.userId),
                );

                const nextReceipt: ReadReceipt = {
                    userId: Number(payload.userId),
                    lastMessageId: payload.lastMessageId,
                    seenAt: payload.seenAt,
                };

                if (index >= 0) {
                    const next = [...prev];
                    next[index] = nextReceipt;
                    return next;
                }

                return [...prev, nextReceipt];
            });
        },
        [currentUserId],
    );

    const syncReadReceiptsFromMembers = useCallback(async () => {
        try {
            const memberPayload =
                await chatService.getConversationMembers(conversationId);
            const normalizedMembers = toMembersByUserId(memberPayload);
            const receipts = Object.values(normalizedMembers)
                .filter(
                    (member) =>
                        Number(member.userId) !== Number(currentUserId) &&
                        Boolean(member.lastReadMessageId),
                )
                .map((member) => ({
                    userId: Number(member.userId),
                    lastMessageId: member.lastReadMessageId!,
                    seenAt: new Date().toISOString(),
                }));

            setMembersById((prev) => {
                const merged = {
                    ...prev,
                    ...normalizedMembers,
                };
                chatRuntimeStore.setMembers(conversationId, merged);
                return merged;
            });

            if (receipts.length === 0) return;

            setReadReceipts((prev) => {
                const byUserId = new Map(
                    prev.map((receipt) => [receipt.userId, receipt]),
                );

                for (const receipt of receipts) {
                    byUserId.set(receipt.userId, {
                        ...byUserId.get(receipt.userId),
                        ...receipt,
                    });
                }

                return Array.from(byUserId.values());
            });
        } catch {
            // Best-effort fallback for missed MESSAGE_SEEN events after reconnect.
        }
    }, [conversationId, currentUserId]);

    const scheduleReadReceiptCatchup = useCallback(() => {
        void syncReadReceiptsFromMembers();

        [1200, 3000, 6000].forEach((delayMs) => {
            const timeoutId = setTimeout(() => {
                readReceiptCatchupTimeoutsRef.current =
                    readReceiptCatchupTimeoutsRef.current.filter(
                        (item) => item !== timeoutId,
                    );
                void syncReadReceiptsFromMembers();
            }, delayMs);

            readReceiptCatchupTimeoutsRef.current.push(timeoutId);
        });
    }, [syncReadReceiptsFromMembers]);

    useEffect(
        () => () => {
            readReceiptCatchupTimeoutsRef.current.forEach((timeoutId) =>
                clearTimeout(timeoutId),
            );
            readReceiptCatchupTimeoutsRef.current = [];
        },
        [],
    );

    const handleTyping = useCallback(
        (event: TypingEvent) => {
            const { userId, isTyping } = event.typingResponse;
            if (userId === currentUserId) return;

            if (isTyping) {
                const existing = typingTimeoutsRef.current.get(userId);
                if (existing) clearTimeout(existing);

                setTypingUsers((prev) => new Set(prev).add(userId));

                const timeoutId = setTimeout(() => {
                    setTypingUsers((prev) => {
                        const next = new Set(prev);
                        next.delete(userId);
                        return next;
                    });
                    typingTimeoutsRef.current.delete(userId);
                }, 10000);

                typingTimeoutsRef.current.set(userId, timeoutId);
                return;
            }

            const existing = typingTimeoutsRef.current.get(userId);
            if (existing) {
                clearTimeout(existing);
                typingTimeoutsRef.current.delete(userId);
            }

            setTypingUsers((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        },
        [currentUserId],
    );

    useEffect(() => {
        if (!isScreenFocused) {
            console.log(
                "[RECALL_DEBUG][mobile][useChatWindowController] skip ws setup because screen not focused",
                { conversationId },
            );
            return;
        }

        let disposed = false;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;
        let handleUserConversationUpdate:
            | ((updatedConversationId: number) => void)
            | null = null;

        const setup = async () => {
            try {
                console.log(
                    "[RECALL_DEBUG][mobile][useChatWindowController] ws setup begin",
                    {
                        conversationId,
                        isConnected: chatWebsocketService.isConnected(),
                    },
                );

                if (!chatWebsocketService.isConnected()) {
                    await chatWebsocketService.connect();
                }

                if (disposed) return;

                chatWebsocketService.subscribeToConversation(
                    conversationId,
                    handleNewMessage,
                    applyRecallDomino,
                    handleMessageSeen,
                    handleTyping,
                    handleMessageReactionEvent,
                    handlePollUpdatedEvent,
                );

                chatWebsocketService.subscribeToConversationPins(
                    conversationId,
                    (event) => {
                        const nextPins = Array.isArray(event.currentPins)
                            ? event.currentPins
                            : [];
                        chatRuntimeStore.setPins(conversationId, nextPins);
                        setPinnedMessages(nextPins);
                    },
                );

                chatWebsocketService.subscribeToConversationMembers(
                    conversationId,
                    (event) => {
                        setMembersById((prev) => {
                            const next = {
                                ...prev,
                                [event.userId]: {
                                    ...(prev[event.userId] ?? {
                                        userId: event.userId,
                                        username: "",
                                        nickname:
                                            event.newNickname || "Unknown",
                                    }),
                                    userId: event.userId,
                                    nickname:
                                        event.newNickname ||
                                        prev[event.userId]?.nickname ||
                                        "Unknown",
                                    avatar:
                                        event.newAvatar ||
                                        prev[event.userId]?.avatar,
                                },
                            };

                            chatRuntimeStore.setMembers(conversationId, next);
                            return next;
                        });
                    },
                    // Khóa/mở khóa tài khoản 1 thành viên -> cập nhật cờ accountLocked
                    // realtime để mask/bỏ mask tên + avatar ở hội thoại đang mở.
                    (event) => {
                        const cachedMember =
                            chatRuntimeStore.getMembers(conversationId)[
                                event.userId
                            ];
                        const shouldRefreshIdentity =
                            !event.accountLocked &&
                            (!cachedMember ||
                                !cachedMember.nickname ||
                                cachedMember.nickname === "Unknown");

                        setMembersById((prev) => {
                            const existing = prev[event.userId];
                            const next = {
                                ...prev,
                                [event.userId]: {
                                    ...(existing ?? {
                                        userId: event.userId,
                                        username: "",
                                        nickname: "Unknown",
                                    }),
                                    userId: event.userId,
                                    accountLocked: event.accountLocked,
                                },
                            };
                            chatRuntimeStore.setMembers(conversationId, next);
                            return next;
                        });
                        setConversation((prev) => {
                            if (!prev) return prev;
                            const nextConversation = {
                                ...prev,
                                members: (prev.members ?? []).map((member) =>
                                    Number(member.userId) ===
                                    Number(event.userId)
                                        ? {
                                              ...member,
                                              accountLocked:
                                                  event.accountLocked,
                                          }
                                        : member,
                                ),
                                directPartnerLocked:
                                    prev.type === "DIRECT" &&
                                    Number(event.userId) !== Number(currentUserId)
                                        ? event.accountLocked
                                        : prev.directPartnerLocked,
                            };
                            chatRuntimeStore.setConversation(
                                conversationId,
                                nextConversation,
                            );
                            return nextConversation;
                        });
                        if (shouldRefreshIdentity) {
                            const token = ++loadTokenRef.current;
                            void loadInitialDataRef.current(token);
                        }
                    },
                    (event: DirectBlockStatusChangedEvent) => {
                        setConversation((prev) => {
                            if (!prev || prev.type !== "DIRECT") return prev;

                            const nextConversation = {
                                ...prev,
                                directBlockedByMe:
                                    Number(event.blockerId) === Number(currentUserId)
                                        ? event.blocked
                                        : prev.directBlockedByMe,
                                directBlockedMe:
                                    Number(event.blockedId) === Number(currentUserId)
                                        ? event.blocked
                                        : prev.directBlockedMe,
                            };
                            chatRuntimeStore.setConversation(
                                conversationId,
                                nextConversation,
                            );
                            setReadOnlyNotice(
                                resolveReadOnlyReasonFromConversation(
                                    nextConversation,
                                    currentUserId,
                                ),
                            );
                            return nextConversation;
                        });
                    },
                );

                // Lắng nghe GROUP_DISBANDED để cập nhật UI ngay khi trưởng nhóm
                // giải tán nhóm mà không cần reload.
                chatWebsocketService.subscribeToGroupDisbanded(
                    currentUserId,
                    conversationId,
                    () => {
                        setReadOnlyNotice("Nhóm đã bị giải tán.");
                    },
                );

                handleUserConversationUpdate = (
                    updatedConversationId: number,
                ) => {
                    if (Number(updatedConversationId) !== Number(conversationId)) {
                        return;
                    }
                    const token = ++loadTokenRef.current;
                    void loadInitialDataRef.current(token);
                };

                chatWebsocketService.subscribeToUserConversations(
                    currentUserId,
                    handleUserConversationUpdate,
                );

                console.log(
                    "[RECALL_DEBUG][mobile][useChatWindowController] ws setup subscribed",
                    { conversationId },
                );
            } catch (error) {
                console.log(
                    "[RECALL_DEBUG][mobile][useChatWindowController] ws setup failed",
                    { conversationId, error },
                );

                if (!disposed) {
                    retryTimeout = setTimeout(() => {
                        void setup();
                    }, 2000);
                }
            }
        };

        void setup();

        return () => {
            disposed = true;

            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }

            if (markAsReadTimeoutRef.current) {
                clearTimeout(markAsReadTimeoutRef.current);
                markAsReadTimeoutRef.current = null;

                const pendingLastMessageId = pendingMarkAsReadIdRef.current;
                pendingMarkAsReadIdRef.current = null;
                if (pendingLastMessageId) {
                    void executeMarkAsRead(pendingLastMessageId, {
                        force: true,
                    });
                }
            }

            if (typingStopTimeoutRef.current) {
                clearTimeout(typingStopTimeoutRef.current);
                typingStopTimeoutRef.current = null;
            }

            if (isTypingSentRef.current) {
                chatWebsocketService.sendTypingSignal(
                    conversationId,
                    currentUserId,
                    false,
                );
            }

            isTypingSentRef.current = false;

            typingTimeoutsRef.current.forEach((timeoutId) =>
                clearTimeout(timeoutId),
            );
            typingTimeoutsRef.current.clear();

            chatWebsocketService.unsubscribeFromConversation(conversationId);
            chatWebsocketService.unsubscribeFromConversationPins(
                conversationId,
            );
            chatWebsocketService.unsubscribeFromConversationMembers(
                conversationId,
            );
            chatWebsocketService.unsubscribeFromGroupDisbanded(
                currentUserId,
                conversationId,
            );
            if (handleUserConversationUpdate) {
                chatWebsocketService.unsubscribeFromUserConversations(
                    currentUserId,
                    handleUserConversationUpdate,
                );
            }
        };
    }, [
        applyRecallDomino,
        conversationId,
        currentUserId,
        executeMarkAsRead,
        handleMessageSeen,
        handleMessageReactionEvent,
        handlePollUpdatedEvent,
        handleNewMessage,
        handleTyping,
        isScreenFocused,
    ]);

    const replaceLocalMessage = useCallback(
        (clientMessageId: string, message: Message) => {
            setMessages((prev) => {
                const next = prev.map((item) =>
                    item.clientMessageId === clientMessageId
                        ? { ...message, deliveryStatus: "sent" as const }
                        : item,
                );
                const deduped = dedupeMessagesByIdentity(next);
                chatRuntimeStore.setMessages(conversationId, deduped);
                return deduped;
            });
        },
        [conversationId],
    );

    const setLocalMessageDeliveryStatus = useCallback(
        (
            clientMessageId: string,
            deliveryStatus: NonNullable<Message["deliveryStatus"]>,
        ) => {
            setMessages((prev) => {
                const next = prev.map((item) =>
                    item.clientMessageId === clientMessageId
                        ? { ...item, deliveryStatus }
                        : item,
                );
                chatRuntimeStore.setMessages(conversationId, next);
                return next;
            });
        },
        [conversationId],
    );

    const appendCreatedMessagesFromOutbox = useCallback(
        (clientMessageId: string, createdMessages: Message[]) => {
            if (createdMessages.length === 0) return;

            setMessages((prev) => {
                let replaced = false;
                const next = prev.map((item) => {
                    if (item.clientMessageId !== clientMessageId) return item;

                    replaced = true;
                    return {
                        ...createdMessages[0],
                        deliveryStatus: "sent" as const,
                    };
                });
                const existingIds = new Set(next.map((item) => item.id));
                const rest = createdMessages
                    .slice(replaced ? 1 : 0)
                    .filter((message) => !existingIds.has(message.id))
                    .map((message) => ({
                        ...message,
                        deliveryStatus: "sent" as const,
                    }));
                const merged = dedupeMessagesByIdentity([...next, ...rest]);
                chatRuntimeStore.setMessages(conversationId, merged);
                return merged;
            });
        },
        [conversationId],
    );

    const uploadAndSendOutboxMedia = useCallback(
        async (item: OutboxMessage): Promise<Message[]> => {
            const files = item.mediaFiles ?? [];
            if (files.length === 0) {
                const createdMessage = await chatService.sendMessage(
                    item.request,
                    item.userId,
                );
                return [createdMessage];
            }

            const presignedPayload: BulkPresignedRequest = {
                module: "CONVERSATION",
                targetId: String(item.conversationId),
                files: files.map((file) => ({
                    type: toAttachmentCategory(file),
                    fileName: file.fileName,
                    contentType: file.mimeType || "application/octet-stream",
                })),
            };

            let presignedList = await chatService
                .getBulkPresignedUrls(presignedPayload)
                .catch(() => []);

            if (presignedList.length !== files.length) {
                presignedList = await Promise.all(
                    files.map((file) =>
                        chatService.getPresignedUrl(
                            "CONVERSATION",
                            String(item.conversationId),
                            toAttachmentCategory(file),
                            file.fileName,
                            file.mimeType || "application/octet-stream",
                        ),
                    ),
                );
            }

            await Promise.all(
                files.map((file, index) =>
                    chatService.uploadToS3(
                        presignedList[index].presignedUrl,
                        file,
                    ),
                ),
            );

            const uploaded = files.map((file, index) => ({
                file,
                objectKey: resolveUploadedMediaUrl(
                    presignedList[index].presignedUrl,
                    presignedList[index].objectKey,
                ),
            }));
            const imageAttachments = uploaded
                .filter((entry) => isImageFile(entry.file))
                .map((entry) => ({
                    url: entry.objectKey,
                    type: entry.file.mimeType || "application/octet-stream",
                    fileName: entry.file.fileName,
                    fileSize: entry.file.fileSize,
                }));
            const audioAttachments = uploaded
                .filter((entry) => entry.file.mimeType.startsWith("audio/"))
                .map((entry) => ({
                    url: entry.objectKey,
                    type: entry.file.mimeType || "application/octet-stream",
                    fileName: entry.file.fileName,
                    fileSize: entry.file.fileSize,
                }));
            const videoAttachments = uploaded
                .filter((entry) => entry.file.mimeType.startsWith("video/"))
                .map((entry) => ({
                    url: entry.objectKey,
                    type: entry.file.mimeType || "application/octet-stream",
                    fileName: entry.file.fileName,
                    fileSize: entry.file.fileSize,
                }));
            const fileAttachments = uploaded
                .filter(
                    (entry) =>
                        !isImageFile(entry.file) &&
                        !entry.file.mimeType.startsWith("audio/") &&
                        !entry.file.mimeType.startsWith("video/"),
                )
                .map((entry) => ({
                    url: entry.objectKey,
                    type: entry.file.mimeType || "application/octet-stream",
                    fileName: entry.file.fileName,
                    fileSize: entry.file.fileSize,
                }));

            const createdMessages: Message[] = [];
            if (imageAttachments.length > 0) {
                createdMessages.push(
                    await chatService.sendMessage(
                        {
                            content: "",
                            type: "IMAGE",
                            conversationId: item.conversationId,
                            attachments: imageAttachments,
                            clientMessageId: `${item.clientMessageId}-image`,
                            ...(item.replyToId ? { replyToId: item.replyToId } : {}),
                        },
                        item.userId,
                    ),
                );
            }
            for (const [index, attachment] of audioAttachments.entries()) {
                createdMessages.push(
                    await chatService.sendMessage(
                        {
                            content: "",
                            type: "AUDIO",
                            conversationId: item.conversationId,
                            attachments: [attachment],
                            clientMessageId: `${item.clientMessageId}-audio-${index}`,
                            ...(item.replyToId ? { replyToId: item.replyToId } : {}),
                        },
                        item.userId,
                    ),
                );
            }
            for (const [index, attachment] of videoAttachments.entries()) {
                createdMessages.push(
                    await chatService.sendMessage(
                        {
                            content: "",
                            type: "VIDEO",
                            conversationId: item.conversationId,
                            attachments: [attachment],
                            clientMessageId: `${item.clientMessageId}-video-${index}`,
                            ...(item.replyToId ? { replyToId: item.replyToId } : {}),
                        },
                        item.userId,
                    ),
                );
            }
            for (const [index, attachment] of fileAttachments.entries()) {
                createdMessages.push(
                    await chatService.sendMessage(
                        {
                            content: "",
                            type: "FILE",
                            conversationId: item.conversationId,
                            attachments: [attachment],
                            clientMessageId: `${item.clientMessageId}-file-${index}`,
                            ...(item.replyToId ? { replyToId: item.replyToId } : {}),
                        },
                        item.userId,
                    ),
                );
            }

            const textContent = item.textContent?.trim();
            if (textContent) {
                createdMessages.push(
                    await chatService.sendMessage(
                        {
                            content: textContent,
                            type: "TEXT",
                            conversationId: item.conversationId,
                            clientMessageId: `${item.clientMessageId}-text`,
                            ...(item.replyToId ? { replyToId: item.replyToId } : {}),
                        },
                        item.userId,
                    ),
                );
            }

            return createdMessages;
        },
        [],
    );

    const sendOutboxItem = useCallback(
        async (item: OutboxMessage) => {
            await messageOutbox.updateStatus(item.clientMessageId, "sending");
            setLocalMessageDeliveryStatus(item.clientMessageId, "sending");

            try {
                const createdMessages = await uploadAndSendOutboxMedia(item);
                if (item.mediaFiles?.length) {
                    appendCreatedMessagesFromOutbox(
                        item.clientMessageId,
                        createdMessages,
                    );
                } else {
                    replaceLocalMessage(item.clientMessageId, createdMessages[0]);
                }
                await messageOutbox.remove(item.clientMessageId);
                createdMessages.forEach(handleNewMessage);
                scheduleReadReceiptCatchup();
                setError(null);
            } catch (error) {
                if (isLikelyNetworkSendError(error)) {
                    setLocalMessageDeliveryStatus(item.clientMessageId, "sending");
                    await messageOutbox.updateStatus(item.clientMessageId, "pending");
                } else {
                    setLocalMessageDeliveryStatus(item.clientMessageId, "failed");
                    await messageOutbox.updateStatus(item.clientMessageId, "failed");
                }
                throw new Error("SEND_OUTBOX_FAILED");
            }
        },
        [
            appendCreatedMessagesFromOutbox,
            handleNewMessage,
            replaceLocalMessage,
            scheduleReadReceiptCatchup,
            setLocalMessageDeliveryStatus,
            uploadAndSendOutboxMedia,
        ],
    );

    useEffect(() => {
        let disposed = false;

        void messageOutbox
            .listByConversation(conversationId)
            .then((items) => {
                if (disposed || items.length === 0) return;
                setMessages((prev) => {
                    const missing = items
                        .map((item) => ({
                            ...item.preview,
                            deliveryStatus:
                                item.status === "failed"
                                    ? ("failed" as const)
                                    : ("sending" as const),
                        }))
                        .filter(
                            (message) =>
                                !prev.some(
                                    (existing) =>
                                        existing.clientMessageId ===
                                        message.clientMessageId,
                                ),
                        );
                    if (missing.length === 0) return prev;
                    const next = dedupeMessagesByIdentity([...prev, ...missing]);
                    chatRuntimeStore.setMessages(conversationId, next);
                    return next;
                });
            })
            .catch(() => undefined);

        return () => {
            disposed = true;
        };
    }, [conversationId]);

    useEffect(() => {
        if (!isScreenFocused) return;
        let flushing = false;

        const flush = async () => {
            if (flushing) return;
            flushing = true;
            try {
                const items = await messageOutbox.listPending();
                for (const item of items) {
                    await sendOutboxItem(item).catch(() => undefined);
                }
            } catch {
                // Retry stays quiet; the next focus/interval pass will try again.
            } finally {
                flushing = false;
            }
        };

        void flush();
        const intervalId = setInterval(flush, OUTBOX_RETRY_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [isScreenFocused, sendOutboxItem]);

    const handleSend = useCallback(
        async (replyToId?: string) => {
            const trimmed = messageText.trim();
            if (!trimmed) return false;

            if (readOnlyNotice) {
                setError(readOnlyNotice || GROUP_READ_ONLY_COMPOSER_NOTICE);
                return false;
            }

            try {
                setSending(true);
                setError(null);

                const textParts = splitLongTextMessage(trimmed);
                const baseClientMessageId = createClientMessageId();
                const baseCreatedAt = Date.now();
                const outboxItems: OutboxMessage[] = textParts.map(
                    (content, partIndex) => {
                        const clientMessageId =
                            textParts.length === 1
                                ? baseClientMessageId
                                : `${baseClientMessageId}-part-${partIndex}`;
                        const request: SendMessageRequest = {
                            content,
                            type: "TEXT",
                            conversationId,
                            clientMessageId,
                            ...(replyToId && partIndex === 0
                                ? { replyToId }
                                : {}),
                        };
                        const createdAt = new Date(
                            baseCreatedAt + partIndex,
                        ).toISOString();
                        const optimisticMessage = buildOptimisticTextMessage(
                            request,
                            currentUserId,
                            clientMessageId,
                            createdAt,
                        );
                        return {
                            clientMessageId,
                            conversationId,
                            userId: currentUserId,
                            request,
                            preview: optimisticMessage,
                            status: "pending",
                            retryCount: 0,
                            createdAt: optimisticMessage.createdAt,
                            updatedAt: optimisticMessage.createdAt,
                        };
                    },
                );

                setMessages((prev) => {
                    const next = dedupeMessagesByIdentity([
                        ...prev,
                        ...outboxItems.map((item) => item.preview),
                    ]);
                    chatRuntimeStore.setMessages(conversationId, next);
                    return next;
                });

                for (const outboxItem of outboxItems) {
                    await messageOutbox.save(outboxItem);
                }
                setMessageText("");

                if (typingStopTimeoutRef.current) {
                    clearTimeout(typingStopTimeoutRef.current);
                    typingStopTimeoutRef.current = null;
                }

                if (isTypingSentRef.current) {
                    chatWebsocketService.sendTypingSignal(
                        conversationId,
                        currentUserId,
                        false,
                    );
                    isTypingSentRef.current = false;
                }

                for (const outboxItem of outboxItems) {
                    await sendOutboxItem(outboxItem).catch(() => undefined);
                }
                return true;
            } catch (error) {
                const apiMessage = extractApiErrorMessage(error);
                const readOnlyReason = apiMessage
                    ? resolveReadOnlyReasonFromApiMessage(apiMessage)
                    : null;

                if (readOnlyReason) {
                    setReadOnlyNotice(readOnlyReason);
                    setError(readOnlyReason);
                } else {
                    setError(apiMessage || "Tin nhan se duoc gui lai khi co mang");
                }
                return false;
            } finally {
                setSending(false);
            }
        },
        [
            conversationId,
            currentUserId,
            handleNewMessage,
            messageText,
            readOnlyNotice,
            sendOutboxItem,
        ],
    );

    const handleRecall = useCallback(
        async (messageId: string) => {
            if (!canRecallOwnMessages) {
                setError(
                    "Chi truong/pho nhom moi duoc thu hoi tin nhan trong che do nay",
                );
                return;
            }

            try {
                await chatService.recallMessage(messageId, currentUserId);
                applyRecallDomino(messageId);
            } catch {
                setError("Khong the thu hoi tin nhan");
            }
        },
        [applyRecallDomino, canRecallOwnMessages, currentUserId],
    );

    const handleSendMixedMedia = useCallback(
        async (
            files: LocalUploadFile[],
            textOverride?: string,
            replyToId?: string,
        ): Promise<boolean> => {
            if (readOnlyNotice) {
                setError(readOnlyNotice || GROUP_READ_ONLY_COMPOSER_NOTICE);
                return false;
            }

            if (files.length === 0) return false;

            const validationError = getValidationErrorForFiles(files);
            if (validationError) {
                setError(validationError);
                return false;
            }

            const trimmed = (textOverride ?? messageText).trim();

            try {
                setError(null);

                const clientMessageId = createClientMessageId("mobile-media");
                const persistedFiles = await persistOutboxMediaFiles(
                    files,
                    clientMessageId,
                );
                const optimisticMessage = buildOptimisticMediaMessage(
                    persistedFiles,
                    conversationId,
                    currentUserId,
                    clientMessageId,
                    replyToId,
                );
                const outboxItem: OutboxMessage = {
                    clientMessageId,
                    conversationId,
                    userId: currentUserId,
                    request: {
                        content: trimmed,
                        type: optimisticMessage.type,
                        conversationId,
                        clientMessageId,
                        ...(replyToId ? { replyToId } : {}),
                    },
                    preview: optimisticMessage,
                    mediaFiles: persistedFiles,
                    textContent: trimmed,
                    replyToId,
                    status: "pending",
                    retryCount: 0,
                    createdAt: optimisticMessage.createdAt,
                    updatedAt: optimisticMessage.createdAt,
                };

                setMessages((prev) => {
                    const next = dedupeMessagesByIdentity([
                        ...prev,
                        optimisticMessage,
                    ]);
                    chatRuntimeStore.setMessages(conversationId, next);
                    return next;
                });

                await messageOutbox.save(outboxItem);
                setMessageText("");
                await sendOutboxItem(outboxItem).catch(() => undefined);
                return true;
            } catch (error) {
                const apiMessage = extractApiErrorMessage(error);
                const readOnlyReason = apiMessage
                    ? resolveReadOnlyReasonFromApiMessage(apiMessage)
                    : null;

                if (readOnlyReason) {
                    setReadOnlyNotice(readOnlyReason);
                    setError(readOnlyReason);
                } else if (isLikelyNetworkSendError(error)) {
                    setError("Tep se duoc gui lai khi co mang");
                } else {
                    setError("Khong the luu tep de gui lai");
                }
                return false;
            }
        },
        [
            conversationId,
            currentUserId,
            messageText,
            readOnlyNotice,
            sendOutboxItem,
        ],
    );

    const handleDeleteForMe = useCallback(
        async (messageId: string) => {
            try {
                await chatService.deleteMessageForMe(messageId, currentUserId);
                setMessages((prev) => {
                    const next = prev.filter((item) => item.id !== messageId);
                    chatRuntimeStore.setMessages(conversationId, next);
                    return next;
                });
            } catch {
                setError("Khong the xoa tin nhan");
            }
        },
        [conversationId, currentUserId],
    );

    const handlePinMessage = useCallback(
        async (messageId: string) => {
            try {
                await chatService.pinMessage(messageId, currentUserId);
            } catch {
                setError("Khong the ghim tin nhan");
            }
        },
        [currentUserId],
    );

    const handleUnpinMessage = useCallback(
        async (messageId: string) => {
            try {
                await chatService.unpinMessage(messageId, currentUserId);
            } catch {
                setError("Khong the bo ghim tin nhan");
            }
        },
        [currentUserId],
    );

    const addReaction = useCallback(
        async (messageId: string, emoji: string) => {
            let previousMessages: Message[] = [];

            setMessages((prev) => {
                previousMessages = prev;
                const next = prev.map((message) =>
                    message.id === messageId
                        ? incrementMessageReaction(message, emoji, currentUserId)
                        : message,
                );
                chatRuntimeStore.setMessages(conversationId, next);
                return next;
            });

            try {
                const updatedMessage = await chatService.addReaction(messageId, emoji);
                setMessages((prev) => {
                    const next = prev.map((message) =>
                        message.id === messageId ? updatedMessage : message,
                    );
                    chatRuntimeStore.setMessages(conversationId, next);
                    return next;
                });
            } catch {
                setMessages(previousMessages);
                chatRuntimeStore.setMessages(conversationId, previousMessages);
                setError("Khong the tha reaction");
            }
        },
        [conversationId, currentUserId],
    );

    const sendTypingSignal = useCallback(
        (isTyping: boolean) => {
            if (isTyping) {
                if (!isTypingSentRef.current) {
                    chatWebsocketService.sendTypingSignal(
                        conversationId,
                        currentUserId,
                        true,
                    );
                    isTypingSentRef.current = true;
                }

                if (typingStopTimeoutRef.current) {
                    clearTimeout(typingStopTimeoutRef.current);
                }

                typingStopTimeoutRef.current = setTimeout(() => {
                    chatWebsocketService.sendTypingSignal(
                        conversationId,
                        currentUserId,
                        false,
                    );
                    isTypingSentRef.current = false;
                    typingStopTimeoutRef.current = null;
                }, TYPING_STOP_TIMEOUT_MS);
                return;
            }

            if (typingStopTimeoutRef.current) {
                clearTimeout(typingStopTimeoutRef.current);
                typingStopTimeoutRef.current = null;
            }

            if (isTypingSentRef.current) {
                chatWebsocketService.sendTypingSignal(
                    conversationId,
                    currentUserId,
                    false,
                );
                isTypingSentRef.current = false;
            }
        },
        [conversationId, currentUserId],
    );

    const pollLatestMessages = useCallback(async () => {
        if (isHistoricalMode) return;
        if (loading || loadingMore || loadingNewer) return;
        if (realtimePollLockRef.current) return;

        const afterCursor = messages.at(-1)?.createdAt;
        if (!afterCursor) return;

        realtimePollLockRef.current = true;

        try {
            const response = await chatService.getNewerMessages(
                conversationId,
                currentUserId,
                afterCursor,
                CHAT_PAGE_SIZE,
            );

            const cursorData = response.success ? response.data : null;
            const newer = Array.isArray(cursorData?.data)
                ? normalizeMessagesForUi(cursorData.data)
                : [];

            if (newer.length === 0) return;

            setMembersById((prev) => {
                const merged = mergeReferenceUsers(
                    prev,
                    cursorData?.referenceUsers ?? {},
                );
                chatRuntimeStore.setMembers(conversationId, merged);
                return merged;
            });

            const existingIds = new Set(messages.map((item) => item.id));
            const uniqueNewer = newer.filter(
                (item) => !existingIds.has(item.id),
            );
            if (uniqueNewer.length === 0) return;

            const newestMessage = uniqueNewer.at(-1);

            setMessages((prev) => {
                const seenIds = new Set(prev.map((item) => item.id));
                const trulyUnique = uniqueNewer.filter(
                    (item) => !seenIds.has(item.id),
                );

                if (trulyUnique.length === 0) return prev;

                const next = [...prev, ...trulyUnique];
                chatRuntimeStore.setMessages(conversationId, next);
                return next;
            });

            if (newestMessage) {
                setConversation((prev) => {
                    if (!prev) return prev;

                    const senderMember = (prev.members ?? []).find(
                        (member) =>
                            Number(member.userId) ===
                            Number(newestMessage.senderId),
                    );
                    const resolvedSenderName =
                        newestMessage.senderName?.trim() ||
                        senderMember?.nickname?.trim() ||
                        senderMember?.username?.trim() ||
                        "";
                    const nextLastMessage = {
                        lastMessageContent:
                            buildLastMessagePreview(newestMessage),
                        lastMessageType: newestMessage.type,
                        lastSenderId: newestMessage.senderId,
                        lastSenderName: resolvedSenderName,
                        lastMessageAt: newestMessage.createdAt,
                        read: newestMessage.senderId === currentUserId,
                    };
                    const next: Conversation = {
                        ...prev,
                        updatedAt: newestMessage.createdAt,
                        unreadCount: 0,
                        lastMessage: nextLastMessage,
                    };

                    chatRuntimeStore.patchConversation(conversationId, {
                        updatedAt: newestMessage.createdAt,
                        unreadCount: 0,
                        lastMessage: nextLastMessage,
                    }) ??
                        chatRuntimeStore.setConversation(conversationId, {
                            ...next,
                            members: undefined,
                        });
                    return next;
                });

                if (newestMessage.senderId !== currentUserId) {
                    markAsRead(newestMessage.id);
                }
            }
        } catch {
            // no-op: polling is a realtime fallback path
        } finally {
            realtimePollLockRef.current = false;
        }
    }, [
        conversationId,
        currentUserId,
        isHistoricalMode,
        loading,
        loadingMore,
        loadingNewer,
        markAsRead,
        mergeReferenceUsers,
        messages,
    ]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            void pollLatestMessages();
        }, REALTIME_FALLBACK_POLL_MS);

        return () => {
            clearInterval(intervalId);
        };
    }, [pollLatestMessages]);

    const loadOlderMessages = useCallback(async () => {
        if (!hasMoreOlder || !olderCursor || loadingMore) return;

        try {
            setLoadingMore(true);
            const response = await chatService.getMessages(
                conversationId,
                currentUserId,
                olderCursor,
                CHAT_PAGE_SIZE,
            );

            const cursorData = response.success ? response.data : null;
            const older = Array.isArray(cursorData?.data)
                ? normalizeMessagesForUi(cursorData.data)
                : [];

            setMembersById((prev) => {
                const merged = mergeReferenceUsers(
                    prev,
                    cursorData?.referenceUsers ?? {},
                );
                chatRuntimeStore.setMembers(conversationId, merged);
                return merged;
            });

            setMessages((prev) => {
                const seenIds = new Set(prev.map((item) => item.id));
                const uniqueOlder = older.filter(
                    (item) => !seenIds.has(item.id),
                );
                const next = [...uniqueOlder, ...prev];
                chatRuntimeStore.setMessages(conversationId, next);
                return next;
            });

            const nextHasMoreOlder = Boolean(cursorData?.hasMoreOlder);
            const nextHasMoreNewer =
                Boolean(cursorData?.hasMoreNewer) ||
                hasMoreNewer ||
                isHistoricalMode;
            const nextHistorical = nextHasMoreNewer;

            setOlderCursor(cursorData?.nextCursor ?? null);
            setHasMoreOlder(nextHasMoreOlder);
            setHasMoreNewer(nextHasMoreNewer);
            setIsHistoricalMode(nextHistorical);
            chatRuntimeStore.patchPaging(conversationId, {
                hasMoreOlder: nextHasMoreOlder,
                hasMoreNewer: nextHasMoreNewer,
                isHistoricalMode: nextHistorical,
                olderCursor: cursorData?.nextCursor ?? null,
            });

            console.log("[JUMP_DEBUG][controller] loadOlderMessages:done", {
                conversationId,
                loadedCount: older.length,
                nextCursor: cursorData?.nextCursor ?? null,
                nextHasMoreOlder,
                nextHasMoreNewer,
            });
        } catch {
            setError("Khong the tai them tin nhan cu");
        } finally {
            setLoadingMore(false);
        }
    }, [
        conversationId,
        currentUserId,
        hasMoreOlder,
        hasMoreNewer,
        isHistoricalMode,
        loadingMore,
        loadingNewer,
        mergeReferenceUsers,
        olderCursor,
    ]);

    const loadNewerMessages = useCallback(async () => {
        if (!hasMoreNewer || loadingMore || loadingNewer) return;

        const afterCursor = messages.at(-1)?.createdAt;
        if (!afterCursor) return;

        try {
            setLoadingNewer(true);

            const response = await chatService.getNewerMessages(
                conversationId,
                currentUserId,
                afterCursor,
                CHAT_PAGE_SIZE,
            );

            const cursorData = response.success ? response.data : null;
            const newer = Array.isArray(cursorData?.data)
                ? normalizeMessagesForUi(cursorData.data)
                : [];

            setMembersById((prev) => {
                const merged = mergeReferenceUsers(
                    prev,
                    cursorData?.referenceUsers ?? {},
                );
                chatRuntimeStore.setMembers(conversationId, merged);
                return merged;
            });

            let newestMessageId = "";

            setMessages((prev) => {
                const seenIds = new Set(prev.map((item) => item.id));
                const uniqueNewer = newer.filter(
                    (item) => !seenIds.has(item.id),
                );

                const next = [...prev, ...uniqueNewer];
                chatRuntimeStore.setMessages(conversationId, next);
                newestMessageId = uniqueNewer.at(-1)?.id ?? "";
                return next;
            });

            const nextHasMoreOlder = Boolean(cursorData?.hasMoreOlder);
            const nextHasMoreNewer = Boolean(cursorData?.hasMoreNewer);
            const nextHistorical = nextHasMoreNewer;

            setHasMoreOlder(nextHasMoreOlder);
            setHasMoreNewer(nextHasMoreNewer);
            setIsHistoricalMode(nextHistorical);
            chatRuntimeStore.patchPaging(conversationId, {
                hasMoreOlder: nextHasMoreOlder,
                hasMoreNewer: nextHasMoreNewer,
                isHistoricalMode: nextHistorical,
            });

            if (newestMessageId) {
                markAsRead(newestMessageId);
            }

            console.log("[JUMP_DEBUG][controller] loadNewerMessages:done", {
                conversationId,
                loadedCount: newer.length,
                newestMessageId,
                nextHasMoreOlder,
                nextHasMoreNewer,
            });
        } catch {
            setError("Khong the tai them tin nhan moi");
        } finally {
            setLoadingNewer(false);
        }
    }, [
        conversationId,
        currentUserId,
        hasMoreNewer,
        loadingMore,
        loadingNewer,
        markAsRead,
        mergeReferenceUsers,
        messages,
    ]);

    const handleJumpToMessage = useCallback(
        async (targetMessageId: string): Promise<boolean> => {
            if (!targetMessageId.trim()) return false;

            console.log("[JUMP_DEBUG][controller] handleJumpToMessage:start", {
                conversationId,
                targetMessageId,
                messageCount: messages.length,
            });

            const messageFromState = messages.find(
                (message) => message.id === targetMessageId,
            );
            const messageFromStore = messageFromState
                ? null
                : chatRuntimeStore
                      .getMessages(conversationId)
                      .find((message) => message.id === targetMessageId);
            const localMessage = messageFromState ?? messageFromStore;

            if (localMessage) {
                if (isMessageDeletedForUser(localMessage, currentUserId)) {
                    showJumpToast();
                    return false;
                }
                return true;
            }

            try {
                setLoadingMore(true);

                const response = await chatService.jumpToMessage(
                    conversationId,
                    targetMessageId,
                    currentUserId,
                );

                if (!response.success || !response.data) {
                    showJumpToast();
                    return false;
                }

                const cursorData = response.data;
                const jumped = Array.isArray(cursorData.data)
                    ? normalizeMessagesForUi(cursorData.data)
                    : [];

                setMembersById((prev) => {
                    const merged = mergeReferenceUsers(
                        prev,
                        cursorData.referenceUsers ?? {},
                    );
                    chatRuntimeStore.setMembers(conversationId, merged);
                    return merged;
                });

                setMessages(jumped);
                chatRuntimeStore.setMessages(conversationId, jumped);

                const nextHasMoreOlder = Boolean(cursorData.hasMoreOlder);
                const nextHasMoreNewer = Boolean(cursorData.hasMoreNewer);
                const nextHistorical = nextHasMoreNewer;
                const fallbackOlderCursor = jumped[0]?.createdAt ?? null;
                const resolvedOlderCursor =
                    cursorData.nextCursor ?? fallbackOlderCursor;

                setOlderCursor(resolvedOlderCursor);
                setHasMoreOlder(nextHasMoreOlder);
                setHasMoreNewer(nextHasMoreNewer);
                setIsHistoricalMode(nextHistorical);
                chatRuntimeStore.setPaging(conversationId, {
                    hasMoreOlder: nextHasMoreOlder,
                    hasMoreNewer: nextHasMoreNewer,
                    isHistoricalMode: nextHistorical,
                    olderCursor: resolvedOlderCursor,
                });

                console.log(
                    "[JUMP_DEBUG][controller] handleJumpToMessage:done",
                    {
                        conversationId,
                        targetMessageId,
                        jumpedCount: jumped.length,
                        nextHasMoreOlder,
                        nextHasMoreNewer,
                        resolvedOlderCursor,
                    },
                );

                return true;
            } catch {
                showJumpToast();
                // setError("Khong the nhay toi tin nhan");
                console.log(
                    "[JUMP_DEBUG][controller] handleJumpToMessage:failed",
                    {
                        conversationId,
                        targetMessageId,
                    },
                );
                return false;
            } finally {
                setLoadingMore(false);
            }
        },
        [
            conversationId,
            currentUserId,
            mergeReferenceUsers,
            messages,
            showJumpToast,
        ],
    );

    const resetToPresent = useCallback(async () => {
        console.log("[JUMP_DEBUG][controller] resetToPresent:start", {
            conversationId,
        });
        const token = Date.now();
        loadTokenRef.current = token;
        await loadInitialData(token);
        console.log("[JUMP_DEBUG][controller] resetToPresent:done", {
            conversationId,
        });
    }, [loadInitialData]);

    return {
        currentUserId,
        messageText,
        setMessageText,
        conversation,
        membersById,
        messages,
        pinnedMessages,
        readReceipts,
        typingUsers,
        loading,
        loadingMore,
        loadingNewer,
        hasMoreOlder,
        hasMoreNewer,
        isHistoricalMode,
        sending,
        uploading,
        uploadProgressPercent,
        uploadProgressLabel,
        uploadFileProgressMap,
        uploadFailedFileNames,
        readOnlyNotice,
        error,
        jumpToast,
        handleSend,
        handleSendMixedMedia,
        handleRecall,
        canRecallOwnMessages,
        handleDeleteForMe,
        handlePinMessage,
        handleUnpinMessage,
        addReaction,
        sendTypingSignal,
        loadOlderMessages,
        loadNewerMessages,
        handleJumpToMessage,
        resetToPresent,
        appendRealtimeMessage: handleNewMessage,
    };
}
