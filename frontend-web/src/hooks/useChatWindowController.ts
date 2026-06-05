import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import chatService, {
    type BulkPresignedRequest,
    type Conversation,
    type ConversationMember,
    type Message,
    type MessageType,
    type PollResponse,
    type SendMessageRequest,
} from "../services/chatService";
import {
    createClientMessageId,
    messageOutbox,
    type OutboxMessage,
} from "../services/messageOutbox";
import websocketService, {
    type DirectBlockStatusChangedEvent,
    type MemberAccountLockChangedEvent,
    type MemberUpdatedEvent,
    type MessageSeenEvent,
    type PinUpdatedEvent,
    type TypingEvent,
} from "../services/websocket";
import { DEFAULT_AVATAR_SMALL_URL, DEFAULT_AVATAR_URL } from "../constants/ui";
import chatRuntimeStore, {
    type MembersByUserId,
    type PinnedMessageDetail,
} from "../stores/chatRuntimeStore";
import { useAuth } from "../contexts/AuthContext";
import { isMessageDeletedForUser } from "../utils/chatMessageGuards";
import {
    GROUP_READ_ONLY_COMPOSER_NOTICE,
    GROUP_SYSTEM_MEMBER_SYNC_TYPES,
    getConversationDisplayInfo,
    getFileClientKey,
    getValidationErrorForFiles,
    isImageFile,
    JUMP_NOT_FOUND_TOAST,
    JUMP_TOAST_TIMEOUT_MS,
    LOAD_MORE_TRIGGER_PX,
    MARK_AS_READ_DEBOUNCE_MS,
    MESSAGE_TRIM_BATCH,
    MESSAGE_WINDOW_LIMIT,
    NEAR_BOTTOM_THRESHOLD_PX,
    normalizeReplyPreviewContent,
    normalizeMessagesForUi,
    PAGE_SIZE,
    RECALLED_REPLY_TEXT,
    resolveApiErrorMessage,
    resolveReadOnlyReasonFromApiMessage,
    resolveReadOnlyReasonFromSystemMessage,
    SCROLLABLE_EPSILON_PX,
    toAttachmentCategory,
    toMembersByUserId,
    type LoadOlderOptions,
    type ReadReceipt,
    type VisibleAnchorSnapshot,
} from "../utils/chatWindowControllerUtils";

export type { ReadReceipt } from "../utils/chatWindowControllerUtils";

const OUTBOX_RETRY_INTERVAL_MS = 3000;
const MAX_TEXT_MESSAGE_LENGTH = 3500;

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

function buildOptimisticTextMessage(
    request: SendMessageRequest,
    userId: number,
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
        senderId: userId,
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
    files: File[],
    conversationId: number,
    userId: number,
    clientMessageId: string,
    replyToId?: string,
): Message {
    const now = new Date().toISOString();
    const hasImage = files.some(isImageFile);
    const firstFile = files[0];
    const type: MessageType = hasImage
        ? "IMAGE"
        : firstFile.type.startsWith("video/")
          ? "VIDEO"
          : firstFile.type.startsWith("audio/")
            ? "AUDIO"
            : "FILE";

    return {
        id: `local-${clientMessageId}`,
        conversationId,
        clientMessageId,
        content: "",
        type,
        createdAt: now,
        senderId: userId,
        replyInfo: replyToId ? { messageId: replyToId } : undefined,
        attachments: files
            .filter((file) => (hasImage ? isImageFile(file) : true))
            .map((file) => ({
                url: URL.createObjectURL(file),
                type: file.type || "application/octet-stream",
                fileName: file.name,
                fileSize: file.size,
            })),
        deliveryStatus: "sending",
    };
}

function isAudioUploadFile(file: File): boolean {
    return file.type.startsWith("audio/");
}

function isVideoUploadFile(file: File): boolean {
    return file.type.startsWith("video/");
}

function buildMixedMediaOptimisticMessages(
    files: File[],
    conversationId: number,
    userId: number,
    clientMessageId: string,
    textContent?: string,
    replyToId?: string,
): Message[] {
    const imageFiles = files.filter(isImageFile);
    const audioFiles = files.filter(isAudioUploadFile);
    const videoFiles = files.filter(isVideoUploadFile);
    const otherFiles = files.filter(
        (file) =>
            !isImageFile(file) &&
            !isAudioUploadFile(file) &&
            !isVideoUploadFile(file),
    );
    const messages: Message[] = [];

    if (imageFiles.length > 0) {
        messages.push(
            buildOptimisticMediaMessage(
                imageFiles,
                conversationId,
                userId,
                `${clientMessageId}-image`,
                replyToId,
            ),
        );
    }

    audioFiles.forEach((file, index) => {
        messages.push(
            buildOptimisticMediaMessage(
                [file],
                conversationId,
                userId,
                `${clientMessageId}-audio-${index}`,
                replyToId,
            ),
        );
    });

    videoFiles.forEach((file, index) => {
        messages.push(
            buildOptimisticMediaMessage(
                [file],
                conversationId,
                userId,
                `${clientMessageId}-video-${index}`,
                replyToId,
            ),
        );
    });

    otherFiles.forEach((file, index) => {
        messages.push(
            buildOptimisticMediaMessage(
                [file],
                conversationId,
                userId,
                `${clientMessageId}-file-${index}`,
                replyToId,
            ),
        );
    });

    const trimmed = textContent?.trim();
    if (!trimmed) return messages;

    const lastCreatedAt = messages.at(-1)?.createdAt ?? new Date().toISOString();

    const textCreatedAt = new Date(
        new Date(lastCreatedAt).getTime() + 1,
    ).toISOString();

    return [
        ...messages,
        {
            id: `local-${clientMessageId}-text`,
            conversationId,
            clientMessageId: `${clientMessageId}-text`,
            content: trimmed,
            type: "TEXT",
            createdAt: textCreatedAt,
            senderId: userId,
            replyInfo: replyToId ? { messageId: replyToId } : undefined,
            deliveryStatus: "sending",
        },
    ];
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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        return true;
    }

    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as {
        code?: string;
        message?: string;
        request?: unknown;
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
        (status === 401 || status === 403) &&
        (responseData == null ||
            responseData === "" ||
            (typeof responseData === "object" &&
                Object.keys(responseData as Record<string, unknown>).length === 0))
    ) || (
        (status === 502 || status === 503 || status === 504) &&
        true
    ) || (
        status === 500 &&
        (responseData == null ||
            responseData === "" ||
            responseText.includes("econnrefused") ||
            responseText.includes("proxy") ||
            responseText.includes("network"))
    ) || (
        !candidate.response &&
        (candidate.code === "ERR_NETWORK" ||
            candidate.code === "ECONNABORTED" ||
            message.includes("network") ||
            message.includes("failed to fetch"))
    );
}

/**
 * useChatWindowController
 * - Controller hook cho ChatWindow: fetch conversation/messages (cursor), websocket realtime.
 * - Quản lý UX scroll: mở chat xuống cuối, load thêm khi kéo lên, auto-scroll có điều kiện.
 * - Có chống race/stale-closure (token/ref) để tránh bug khi đổi hội thoại nhanh.
 *
 * Gợi ý đọc nhanh: xem các comment ngay cạnh từng section/handler (scroll, paging, ws).
 */
export function useChatWindowController(args: {
    conversationId: number;
    onMarkAsRead?: (conversationId: number) => void;
    forcedReadOnlyNotice?: string | null;
    onForbidden?: () => void;
}) {
    const { conversationId, onMarkAsRead, forcedReadOnlyNotice, onForbidden } =
        args;

    // userId: lấy từ AuthContext (security integration - không nhận qua prop nữa)
    const { currentUser } = useAuth();
    const userId = currentUser?.id ?? 0;

    // ====== UI State (render) ======
    const [messageText, setMessageText] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [membersById, setMembersById] = useState<MembersByUserId>({});
    const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageDetail[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgressPercent, setUploadProgressPercent] = useState<
        number | null
    >(null);
    const [uploadProgressLabel, setUploadProgressLabel] = useState<string>("");
    const [uploadFileProgressMap, setUploadFileProgressMap] = useState<
        Record<string, number>
    >({});
    const [uploadFailedFileNames, setUploadFailedFileNames] = useState<
        string[]
    >([]);
    const [localReadOnlyNotice, setReadOnlyNotice] = useState<string | null>(
        null,
    );
    const currentUserMember = membersById[userId];
    const isRestrictedMember =
        conversation?.isMessageRestricted && currentUserMember?.role === "MEMBER";
    const canRecallOwnMessages = !isRestrictedMember;

    const readOnlyNotice = useMemo(() => {
        const isRestrictedForMe = conversation?.isMessageRestricted && currentUserMember?.role === "MEMBER";

        if (isRestrictedForMe) {
            return "Chỉ Trưởng/Phó nhóm mới được gửi tin nhắn";
        }

        if (conversation?.type === "DIRECT") {
            if (conversation.directBlockedByMe) {
                return "Bạn đã chặn người này.";
            }
            if (conversation.directBlockedMe) {
                return "Bạn không thể nhắn tin với người này.";
            }
        }

        const notice = forcedReadOnlyNotice || localReadOnlyNotice;
        console.log("[DEBUG_READD] readOnlyNotice evaluated:", {
            forcedReadOnlyNotice,
            localReadOnlyNotice,
            result: notice,
        });
        return notice;
    }, [
        forcedReadOnlyNotice,
        localReadOnlyNotice,
        conversation?.isMessageRestricted,
        conversation?.type,
        conversation?.directBlockedByMe,
        conversation?.directBlockedMe,
        currentUserMember?.role,
    ]);

    const prevForcedNoticeRef = useRef<string | null | undefined>(
        forcedReadOnlyNotice,
    );
    const onForbiddenRef = useRef(onForbidden);

    useEffect(() => {
        onForbiddenRef.current = onForbidden;
    }, [onForbidden]);

    // ====== Ghi âm tin nhắn thoại (Voice recording) ======
    // isRecording: true nếu đang ghi âm, dùng để hiện overlay ghi âm trong UI
    const [isRecording, setIsRecording] = useState(false);
    // recordingDuration: thời lượng ghi âm tính bằng giây, hiện dạng MM:SS
    const [recordingDuration, setRecordingDuration] = useState(0);
    // mediaRecorderRef: ref đến MediaRecorder instance đang hoạt động
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    // audioChunksRef: mảng các Blob chứa dữ liệu audio từ ondataavailable
    const audioChunksRef = useRef<Blob[]>([]);
    // recordingTimerRef: interval timer để tăng recordingDuration mỗi giây
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );

    // ====== Read Receipt (Đánh dấu đã đọc) ======
    // readReceipts: danh sách thông tin "đã xem" của các members (trừ user hiện tại)
    const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);
    // markAsReadTimeoutRef: debounce timer cho API markAsRead
    const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    // ====== Typing Indicator (Đang soạn tin nhắn) ======
    // typingUsers: Map<userId, timeoutId> - Track users đang gõ và timeout để auto-clear
    const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
    // typingTimeouts: Map để lưu timeout ID cho mỗi user, tự động xóa sau 10s nếu không có update
    const typingTimeoutsRef = useRef<
        Map<number, ReturnType<typeof setTimeout>>
    >(new Map());
    // isTypingSent: Track xem đã gửi signal isTyping=true chưa (tránh spam)
    const isTypingSentRef = useRef(false);
    // typingTimeoutRef: Timeout để gửi isTyping=false sau 10s không gõ
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // scrollPositionBeforeTypingRef: Lưu vị trí scroll trước khi scroll vì typing indicator
    const scrollPositionBeforeTypingRef = useRef<number | null>(null);
    // messagesLengthWhenTypingRef: Số tin nhắn khi typing indicator xuất hiện (để detect tin mới)
    const messagesLengthWhenTypingRef = useRef<number>(0);
    // shouldScrollOnMediaLoadRef: Flag để force scroll khi media của tin nhắn mới load xong
    // Set true khi nhận tin nhắn mới (của mình hoặc khi đang ở cuối), reset sau 2s
    const shouldScrollOnMediaLoadRef = useRef(false);
    // shouldScrollOnMediaLoadTimerRef: Timer để reset shouldScrollOnMediaLoadRef
    const shouldScrollOnMediaLoadTimerRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);

    const [error, setError] = useState<string | null>(null);

    // Toast ngắn cho lỗi thu hồi (tự biến mất sau 2 giây)
    const [recallToast, setRecallToast] = useState<string | null>(null);
    const [jumpToast, setJumpToast] = useState<string | null>(null);
    const recallToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const jumpToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    const showJumpToast = useCallback(
        (message: string = JUMP_NOT_FOUND_TOAST) => {
            setJumpToast(message);
        },
        [],
    );

    // Tự động xoá toast sau 2s, dọn timer cũ nếu toast xuất hiện lại sớm
    useEffect(() => {
        if (!recallToast) return;
        if (recallToastTimerRef.current)
            clearTimeout(recallToastTimerRef.current);
        recallToastTimerRef.current = setTimeout(() => {
            setRecallToast(null);
            recallToastTimerRef.current = null;
        }, 2000);
        return () => {
            if (recallToastTimerRef.current)
                clearTimeout(recallToastTimerRef.current);
        };
    }, [recallToast]);

    useEffect(() => {
        if (!jumpToast) return;

        if (jumpToastTimerRef.current) clearTimeout(jumpToastTimerRef.current);
        jumpToastTimerRef.current = setTimeout(() => {
            setJumpToast(null);
            jumpToastTimerRef.current = null;
        }, JUMP_TOAST_TIMEOUT_MS);

        return () => {
            if (jumpToastTimerRef.current)
                clearTimeout(jumpToastTimerRef.current);
        };
    }, [jumpToast]);

    // UX: nút xuống cuối + số tin mới chưa xem khi user không ở near-bottom.
    const [showScrollToBottomButton, setShowScrollToBottomButton] =
        useState(false);
    const [pendingNewMessages, setPendingNewMessages] = useState(0);

    // ====== Cursor pagination (2 chiều) ======
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [hasMoreNewer, setHasMoreNewer] = useState(false);
    const [isHistoricalMode, setIsHistoricalMode] = useState(false);
    const isHistoricalModeRef = useRef(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [olderCursor, setOlderCursor] = useState<string | null>(null);

    // Refs: DOM anchors cho scroll.
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<Message[]>([]);
    const activeConversationCatchupRef = useRef({
        inFlight: false,
        lastRunAt: 0,
        needsCatchup: false,
        retryTimerId: null as number | null,
        retryAttempts: 0,
    });

    // userIdRef dùng cho websocket callback (tránh stale closure nếu userId thay đổi).
    const userIdRef = useRef(userId);

    // autoFillPendingRef: chặn việc auto-fill gọi liên tiếp (tránh spam loadMore).
    const autoFillPendingRef = useRef(false);
    // skipAutoFillOnceRef: bỏ qua đúng 1 vòng auto-fill (dùng cho nút trở về hiện tại).
    const skipAutoFillOnceRef = useRef(false);
    // suppressPagingLoadRef: chặn auto-fill và load-on-scroll ngay sau jump.
    const suppressPagingLoadRef = useRef(false);
    const suppressPagingLoadTimerRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const jumpPagingLockRef = useRef(false);
    const jumpPagingLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const pendingOlderPrefetchAfterJumpRef = useRef(false);

    // loadTokenRef: token tăng dần để bỏ qua kết quả API của request "cũ".
    const loadTokenRef = useRef(0);

    // scrollOnNextRenderRef: cờ yêu cầu scroll xuống cuối sau khi render xong.
    const scrollOnNextRenderRef = useRef<ScrollBehavior | null>(null);
    const forceAutoScrollUntilRef = useRef(0);

    const armForceAutoScroll = useCallback((durationMs = 2500) => {
        forceAutoScrollUntilRef.current = Date.now() + durationMs;
    }, []);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const shouldForceAutoScroll = useCallback(
        () => Date.now() < forceAutoScrollUntilRef.current,
        [],
    );

    // initialLoadRef: cờ đánh dấu đang trong giai đoạn load ban đầu (F5/mở chat).
    // Trong giai đoạn này, luôn scroll xuống cuối khi media load (bất kể vị trí hiện tại).
    // Reset khi user scroll lên.
    const initialLoadRef = useRef(true);

    // lastScrollTopRef: track scroll position để phát hiện user scroll lên
    const lastScrollTopRef = useRef(0);

    // loadMoreRequestedRef: ngăn gọi API duplicate khi scroll
    const loadMoreRequestedRef = useRef(false);
    const olderMessagesAbortRef = useRef<AbortController | null>(null);
    const returningToPresentRef = useRef(false);
    const membersSyncInFlightRef = useRef(false);
    const sendingOutboxIdsRef = useRef<Set<string>>(new Set());
    const readReceiptCatchupTimeoutsRef = useRef<ReturnType<
        typeof setTimeout
    >[]>([]);
    const mediaLoadStabilizerRef = useRef<{
        activeUntil: number;
        lastScrollHeight: number;
        anchorMessageId: string | null;
        anchorTopOffset: number;
    }>({
        activeUntil: 0,
        lastScrollHeight: 0,
        anchorMessageId: null,
        anchorTopOffset: 0,
    });

    const resetMediaLoadStabilizer = useCallback(() => {
        mediaLoadStabilizerRef.current = {
            activeUntil: 0,
            lastScrollHeight: 0,
            anchorMessageId: null,
            anchorTopOffset: 0,
        };
    }, []);

    useEffect(() => {
        // Đồng bộ ref mỗi khi userId thay đổi.
        userIdRef.current = userId;
    }, [userId]);

    useEffect(() => {
        isHistoricalModeRef.current = isHistoricalMode;
    }, [isHistoricalMode]);

    const isNearBottom = useCallback(
        (thresholdPx = NEAR_BOTTOM_THRESHOLD_PX) => {
            const container = messagesContainerRef.current;
            if (!container) return true;
            // distanceFromBottom càng nhỏ => càng gần đáy.
            const distanceFromBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight;
            return distanceFromBottom < thresholdPx;
        },
        [],
    );

    const scrollToBottom = useCallback(
        (behavior: ScrollBehavior = "smooth") => {
            const container = messagesContainerRef.current;
            if (container) {
                // Ưu tiên scroll container (ổn định hơn scrollIntoView nếu layout phức tạp).
                container.scrollTo({ top: container.scrollHeight, behavior });
                return;
            }
            messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
        },
        [],
    );

    const captureVisibleAnchor =
        useCallback((): VisibleAnchorSnapshot | null => {
            const container = messagesContainerRef.current;
            if (!container) return null;

            const containerRect = container.getBoundingClientRect();
            const nodes =
                container.querySelectorAll<HTMLElement>("[data-message-id]");

            for (const node of nodes) {
                const rect = node.getBoundingClientRect();
                if (rect.bottom <= containerRect.top + 1) continue;

                const messageId = node.dataset.messageId;
                if (!messageId) continue;

                return {
                    messageId,
                    topOffset: rect.top - containerRect.top,
                };
            }

            return null;
        }, []);

    const restoreVisibleAnchor = useCallback(
        (
            snapshot: VisibleAnchorSnapshot | null,
            prevScrollTop: number,
            prevScrollHeight: number,
        ) => {
            const applyFallback = () => {
                const container = messagesContainerRef.current;
                if (!container) return;

                const deltaHeight = container.scrollHeight - prevScrollHeight;
                if (deltaHeight > 0) {
                    container.scrollTop = prevScrollTop + deltaHeight;
                    lastScrollTopRef.current = container.scrollTop;
                }
            };

            requestAnimationFrame(() => {
                const container = messagesContainerRef.current;
                if (!container) return;

                if (!snapshot) {
                    applyFallback();
                    return;
                }

                const nodes =
                    container.querySelectorAll<HTMLElement>(
                        "[data-message-id]",
                    );
                const anchorNode = Array.from(nodes).find(
                    (node) => node.dataset.messageId === snapshot.messageId,
                );

                if (!anchorNode) {
                    // Virtualized list có thể chưa render anchor kịp, fallback theo delta chiều cao.
                    applyFallback();
                    return;
                }

                const containerRect = container.getBoundingClientRect();
                const currentOffset =
                    anchorNode.getBoundingClientRect().top - containerRect.top;
                const delta = currentOffset - snapshot.topOffset;
                if (Math.abs(delta) > 0.5) {
                    container.scrollTop += delta;
                    lastScrollTopRef.current = container.scrollTop;
                }
            });
        },
        [],
    );

    const armMediaLoadStabilizer = useCallback(
        (anchorSnapshot: VisibleAnchorSnapshot | null, durationMs = 8000) => {
            const container = messagesContainerRef.current;
            if (!container) return;

            const activeUntil = Date.now() + durationMs;
            mediaLoadStabilizerRef.current = {
                activeUntil,
                lastScrollHeight: container.scrollHeight,
                anchorMessageId: anchorSnapshot?.messageId ?? null,
                anchorTopOffset: anchorSnapshot?.topOffset ?? 0,
            };

            // Cập nhật baseline thêm vài nhịp sau render để bắt đúng chiều cao
            // trước khi ảnh/video trong batch cũ bắt đầu load dần.
            requestAnimationFrame(() => {
                const current = messagesContainerRef.current;
                if (!current) return;
                if (Date.now() > mediaLoadStabilizerRef.current.activeUntil)
                    return;
                mediaLoadStabilizerRef.current.lastScrollHeight =
                    current.scrollHeight;
            });

            setTimeout(() => {
                const current = messagesContainerRef.current;
                if (!current) return;
                if (Date.now() > mediaLoadStabilizerRef.current.activeUntil)
                    return;
                mediaLoadStabilizerRef.current.lastScrollHeight =
                    current.scrollHeight;
            }, 120);
        },
        [],
    );

    const stabilizeMediaLayoutOnMediaLoad = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const stabilizer = mediaLoadStabilizerRef.current;
        if (Date.now() > stabilizer.activeUntil) return;
        if (!isHistoricalModeRef.current) {
            stabilizer.lastScrollHeight = container.scrollHeight;
            return;
        }

        const nextScrollHeight = container.scrollHeight;
        const delta = nextScrollHeight - stabilizer.lastScrollHeight;

        const anchorId = stabilizer.anchorMessageId;
        if (anchorId) {
            const containerRect = container.getBoundingClientRect();
            const anchorNode = container.querySelector<HTMLElement>(
                `[data-message-id="${anchorId}"]`,
            );
            if (anchorNode) {
                const currentOffset =
                    anchorNode.getBoundingClientRect().top - containerRect.top;
                const anchorDelta = currentOffset - stabilizer.anchorTopOffset;

                if (Math.abs(anchorDelta) > 0.5 && !isNearBottom()) {
                    container.scrollTop += anchorDelta;
                    lastScrollTopRef.current = container.scrollTop;
                    stabilizer.activeUntil = Date.now() + 1500;
                }

                stabilizer.lastScrollHeight = nextScrollHeight;
                return;
            }
        }

        if (delta > 0.5 && !isNearBottom()) {
            container.scrollTop += delta;
            lastScrollTopRef.current = container.scrollTop;
            // Gia hạn nhẹ khi còn ảnh đang load nối tiếp để tránh đợt 2 bị trôi.
            stabilizer.activeUntil = Date.now() + 1500;
        }

        stabilizer.lastScrollHeight = nextScrollHeight;
    }, [isNearBottom]);

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

    const mergeDetailMembers = useCallback(
        (
            baseMembers: MembersByUserId,
            detailMembers?: ConversationMember[] | null,
        ): MembersByUserId => {
            if (!Array.isArray(detailMembers) || detailMembers.length === 0) {
                return baseMembers;
            }

            const nextMembers = { ...baseMembers };
            for (const detailMember of detailMembers) {
                const detailMemberId = Number(detailMember.userId);
                if (!Number.isFinite(detailMemberId)) continue;

                const existing = nextMembers[detailMemberId];
                nextMembers[detailMemberId] = {
                    ...detailMember,
                    ...existing,
                    userId: detailMemberId,
                    nickname:
                        existing?.nickname &&
                        existing.nickname !== "Unknown"
                            ? existing.nickname
                            : detailMember.nickname || "Unknown",
                    username: existing?.username || detailMember.username || "",
                    avatar: existing?.avatar || detailMember.avatar,
                    accountLocked: Boolean(detailMember.accountLocked),
                };
            }

            return nextMembers;
        },
        [],
    );

    const applyReadReceiptsFromMembers = useCallback(
        (members: MembersByUserId) => {
            const receipts: ReadReceipt[] = Object.values(members)
                .filter(
                    (member) =>
                        Number(member.userId) !== Number(userIdRef.current) &&
                        member.lastReadMessageId,
                )
                .map((member) => ({
                    userId: Number(member.userId),
                    lastMessageId: member.lastReadMessageId!,
                    seenAt: new Date().toISOString(),
                }));

            setReadReceipts(receipts);
        },
        [],
    );

    const syncReadReceiptsFromMembers = useCallback(async () => {
        try {
            const membersResponse =
                await chatService.getConversationMembers(conversationId);
            const normalizedMembers = toMembersByUserId(membersResponse);

            setMembersById((prev) => {
                const merged = {
                    ...prev,
                    ...normalizedMembers,
                };
                chatRuntimeStore.setMembers(conversationId, merged);
                return merged;
            });
            setConversation((previousConversation) => {
                if (!previousConversation) return previousConversation;
                const nextConversation = {
                    ...previousConversation,
                    members: Object.values({
                        ...toMembersByUserId(previousConversation.members ?? []),
                        ...normalizedMembers,
                    }),
                };
                chatRuntimeStore.setConversation(conversationId, nextConversation);
                return nextConversation;
            });
            applyReadReceiptsFromMembers(normalizedMembers);
        } catch {
            // Best-effort catch-up only. Realtime websocket/F5 still covers this.
        }
    }, [applyReadReceiptsFromMembers, conversationId]);

    const scheduleReadReceiptCatchup = useCallback(() => {
        readReceiptCatchupTimeoutsRef.current.forEach((timerId) =>
            clearTimeout(timerId),
        );
        readReceiptCatchupTimeoutsRef.current = [0, 1200, 3000, 6000].map(
            (delay) =>
                setTimeout(() => {
                    void syncReadReceiptsFromMembers();
                }, delay),
        );
    }, [syncReadReceiptsFromMembers]);

    const syncConversationData = useCallback(async () => {
        if (membersSyncInFlightRef.current) return;
        membersSyncInFlightRef.current = true;

        try {
            const [membersResponse, convResponse] = await Promise.all([
                chatService.getConversationMembers(conversationId),
                chatService.getConversation(conversationId, userIdRef.current),
            ]);

            const normalizedMembers = toMembersByUserId(membersResponse);
            const completeMembers = mergeDetailMembers(
                normalizedMembers,
                convResponse.data?.members,
            );

            if (convResponse.success && convResponse.data) {
                const nextConversation = {
                    ...convResponse.data,
                    members: Object.values(completeMembers),
                };

                setConversation(nextConversation);
                chatRuntimeStore.setConversation(conversationId, nextConversation);
            }

            setMembersById((prev) => {
                const merged = {
                    ...prev,
                    ...completeMembers,
                };
                chatRuntimeStore.setMembers(conversationId, merged);
                return merged;
            });
            applyReadReceiptsFromMembers(completeMembers);
        } catch (err) {
            console.error("Failed to sync conversation data:", err);
        } finally {
            membersSyncInFlightRef.current = false;
        }
    }, [applyReadReceiptsFromMembers, conversationId, mergeDetailMembers]);

    const applyWindowForOlder = useCallback((nextMessages: Message[]) => {
        if (nextMessages.length <= MESSAGE_WINDOW_LIMIT) {
            return { messages: nextMessages, trimmedTail: false };
        }
        const trimmed = nextMessages.slice(0, MESSAGE_WINDOW_LIMIT);
        return { messages: trimmed, trimmedTail: true };
    }, []);

    const applyWindowForNewer = useCallback((nextMessages: Message[]) => {
        if (nextMessages.length <= MESSAGE_WINDOW_LIMIT) {
            return nextMessages;
        }
        return nextMessages.slice(MESSAGE_TRIM_BATCH);
    }, []);

    // Thực thi scroll *sau render* để tránh trường hợp:
    // - setMessages vừa chạy nhưng DOM chưa update scrollHeight
    // - hoặc đang prepend (loadingMore) gây nhảy position.
    useLayoutEffect(() => {
        const behavior = scrollOnNextRenderRef.current;
        if (!behavior) return;
        if (loadingMore) return;

        scrollOnNextRenderRef.current = null;
        requestAnimationFrame(() => {
            scrollToBottom(behavior);
            setTimeout(
                () => scrollToBottom(behavior === "auto" ? "auto" : "smooth"),
                80,
            );
        });
    }, [loadingMore, messages, scrollToBottom]);

    const loadInitialData = useCallback(
        async (
            token: number,
            markAsReadFn?: (lastMessageId: string) => void,
        ) => {
            try {
                setError(null);
                setReadOnlyNotice(null);

                const convResponse = await chatService.getConversation(
                    conversationId,
                    userId,
                );

                if (token !== loadTokenRef.current) return;

                if (!convResponse.success || !convResponse.data) {
                    const apiMessage =
                        convResponse.message || "Không thể tải cuộc trò chuyện";
                    const readOnlyReason =
                        resolveReadOnlyReasonFromApiMessage(apiMessage);
                    if (readOnlyReason) {
                        setReadOnlyNotice(GROUP_READ_ONLY_COMPOSER_NOTICE);
                        setError(readOnlyReason);
                        websocketService.unsubscribeFromConversation(
                            conversationId,
                        );
                        websocketService.unsubscribeFromConversationMembers(
                            conversationId,
                        );
                        websocketService.unsubscribeFromConversationPins(
                            conversationId,
                        );
                        onForbiddenRef.current?.();
                        return;
                    }

                    setConversation(null);
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
        userId,
        null,
        PAGE_SIZE,
    );
} catch (e) {
    messagesResponse = null;
}

if (token !== loadTokenRef.current) return;

const cursorData = messagesResponse?.success
    ? messagesResponse.data
    : null;

const list = Array.isArray(cursorData?.data)
    ? normalizeMessagesForUi(cursorData.data)
    : [];


                const membersFromApi = toMembersByUserId(membersResponse);
                const sideLoadedRefs = cursorData?.referenceUsers ?? {};
                let mergedMembers = mergeReferenceUsers(
                    membersFromApi,
                    sideLoadedRefs,
                );

                // Đồng bộ cờ accountLocked từ response CHI TIẾT (nguồn DB tươi qua
                // conversationMapper) đè lên members lấy từ API getConversationMembers
                // (vốn đi qua Redis cache, có thể cũ). Tránh việc tài khoản đã bị khóa
                // nhưng cache cũ vẫn báo false làm UI hiển thị sai.
                const detailMembers = Array.isArray(convResponse.data.members)
                    ? convResponse.data.members
                    : [];
                mergedMembers = mergeDetailMembers(
                    mergedMembers,
                    detailMembers,
                );
                // Direct: bảo đảm đối phương bám theo directPartnerLocked (DB tươi),
                // kể cả khi member tương ứng chưa có trong map.
                const directPartnerId = convResponse.data.directPartnerId;
                if (
                    convResponse.data.type === "DIRECT" &&
                    convResponse.data.directPartnerLocked &&
                    directPartnerId != null &&
                    mergedMembers[Number(directPartnerId)]
                ) {
                    mergedMembers[Number(directPartnerId)] = {
                        ...mergedMembers[Number(directPartnerId)],
                        accountLocked: true,
                    };
                }

                const normalizedConversation: Conversation = {
                    ...convResponse.data,
                    members: Object.values(mergedMembers),
                };

                // Pin cần tồn tại sau F5 nên phải lấy từ dữ liệu conversation trả về,
                // không chỉ dựa vào websocket/runtime store.
                const initialPins = Array.isArray(
                    normalizedConversation.pinnedMessages,
                )
                    ? normalizedConversation.pinnedMessages
                    : [];

                chatRuntimeStore.setConversation(
                    conversationId,
                    normalizedConversation,
                );
                chatRuntimeStore.setMembers(conversationId, mergedMembers);
                chatRuntimeStore.setMessages(conversationId, list);
                // Ghi pin vào runtime store để đổi room qua lại không cần chờ fetch lại.
                chatRuntimeStore.setPins(conversationId, initialPins);
                chatRuntimeStore.setPaging(conversationId, {
                    hasMoreOlder: Boolean(cursorData?.hasMoreOlder),
                    hasMoreNewer: Boolean(cursorData?.hasMoreNewer),
                    isHistoricalMode: false,
                    olderCursor: cursorData?.nextCursor ?? null,
                });

                setMembersById(mergedMembers);
                setConversation(normalizedConversation);
                setMessages(list);
                // Đồng bộ state pin cho UI banner ghim ngay sau initial load.
                setPinnedMessages(initialPins);
                setOlderCursor(cursorData?.nextCursor ?? null);
                setHasMoreOlder(Boolean(cursorData?.hasMoreOlder));
                setHasMoreNewer(Boolean(cursorData?.hasMoreNewer));
                setIsHistoricalMode(false);
                suppressPagingLoadRef.current = false;
                if (suppressPagingLoadTimerRef.current) {
                    clearTimeout(suppressPagingLoadTimerRef.current);
                    suppressPagingLoadTimerRef.current = null;
                }

                const initialReceipts: ReadReceipt[] = Object.values(
                    mergedMembers,
                )
                    .filter(
                        (m) =>
                            Number(m.userId) !== Number(userIdRef.current) &&
                            m.lastReadMessageId,
                    )
                    .map((m) => ({
                        userId: Number(m.userId),
                        lastMessageId: m.lastReadMessageId!,
                        seenAt: new Date().toISOString(),
                    }));

                setReadReceipts(initialReceipts);
                scrollOnNextRenderRef.current = "auto";

                const lastMessage = list.at(-1);
                if (lastMessage && markAsReadFn) {
                    markAsReadFn(lastMessage.id);
                }
            } catch (error) {
                if (token !== loadTokenRef.current) return;

                const apiMessage = resolveApiErrorMessage(
                    error,
                    "Không thể tải dữ liệu cuộc trò chuyện",
                );
                const readOnlyReason =
                    resolveReadOnlyReasonFromApiMessage(apiMessage);

                // Dọn dẹp state để trigger giao diện báo lỗi (Red Cross)
                setMessages([]);
                setConversation(null);
                setMembersById({});

                if (readOnlyReason) {
                    setReadOnlyNotice(GROUP_READ_ONLY_COMPOSER_NOTICE);
                    setError(readOnlyReason);

                    websocketService.unsubscribeFromConversation(
                        conversationId,
                    );
                    websocketService.unsubscribeFromConversationMembers(
                        conversationId,
                    );
                    websocketService.unsubscribeFromConversationPins(
                        conversationId,
                    );
                    onForbiddenRef.current?.();
                } else {
                    setError(apiMessage);
                }
            } finally {
                if (token === loadTokenRef.current) {
                    returningToPresentRef.current = false;
                    setLoading(false);
                }
            }
        },
        [conversationId, mergeDetailMembers, mergeReferenceUsers, userId],
    );

    useEffect(() => {
        if (!forcedReadOnlyNotice) return;

        setReadOnlyNotice(GROUP_READ_ONLY_COMPOSER_NOTICE);
        setError(forcedReadOnlyNotice);
        setSending(false);
        setUploading(false);
        websocketService.unsubscribeFromConversation(conversationId);
        websocketService.unsubscribeFromConversationMembers(conversationId);
        websocketService.unsubscribeFromConversationPins(conversationId);
        onForbiddenRef.current?.();
    }, [conversationId, forcedReadOnlyNotice]);

    const loadOlderMessages = useCallback(
        async (options?: LoadOlderOptions) => {
            if (returningToPresentRef.current) return;
            if (!hasMoreOlder || loadingMore || !olderCursor) return;
            if (jumpPagingLockRef.current) return;
            if (loadMoreRequestedRef.current) return;

            loadMoreRequestedRef.current = true;
            const keepAtBottom = Boolean(options?.keepAtBottom);
            const token = loadTokenRef.current;
            const controller = new AbortController();
            olderMessagesAbortRef.current = controller;

            try {
                setLoadingMore(true);

                const container = messagesContainerRef.current;
                const prevScrollTop = container?.scrollTop ?? 0;
                const prevScrollHeight = container?.scrollHeight ?? 0;

                const anchorSnapshot = keepAtBottom
                    ? null
                    : captureVisibleAnchor();

                const response = await chatService.getMessages(
                    conversationId,
                    userId,
                    olderCursor,
                    PAGE_SIZE,
                    controller.signal,
                );

                if (token !== loadTokenRef.current) return;

                const cursorData = response?.success ? response.data : null;
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

                let didTrimTail = false;
                setMessages((prev) => {
                    const merged = [...older, ...prev];
                    const trimmedResult = applyWindowForOlder(merged);
                    didTrimTail = trimmedResult.trimmedTail;
                    chatRuntimeStore.setMessages(
                        conversationId,
                        trimmedResult.messages,
                    );
                    return trimmedResult.messages;
                });

                const nextHasMoreOlder = Boolean(cursorData?.hasMoreOlder);
                // API older đôi khi trả hasMoreNewer=false dù phía dưới vẫn còn dữ liệu.
                // Giữ cờ true nếu trước đó đã ở historical mode hoặc đã biết còn newer.
                const nextHasMoreNewer =
                    Boolean(cursorData?.hasMoreNewer) ||
                    isHistoricalMode ||
                    hasMoreNewer;
                const nextHistorical = didTrimTail
                    ? true
                    : isHistoricalMode || nextHasMoreNewer;

                setOlderCursor(cursorData?.nextCursor ?? null);
                setHasMoreOlder(nextHasMoreOlder);
                setHasMoreNewer(nextHasMoreNewer);
                setIsHistoricalMode(nextHistorical);
                setShowScrollToBottomButton(nextHistorical);
                setPendingNewMessages(0);
                suppressPagingLoadRef.current = false;
                chatRuntimeStore.setPaging(conversationId, {
                    hasMoreOlder: nextHasMoreOlder,
                    hasMoreNewer: nextHasMoreNewer,
                    isHistoricalMode: nextHistorical,
                    olderCursor: cursorData?.nextCursor ?? null,
                });

                if (keepAtBottom) {
                    scrollOnNextRenderRef.current = "auto";
                    setShowScrollToBottomButton(false);
                    setPendingNewMessages(0);
                } else {
                    restoreVisibleAnchor(
                        anchorSnapshot,
                        prevScrollTop,
                        prevScrollHeight,
                    );
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            armMediaLoadStabilizer(captureVisibleAnchor());
                        });
                    });
                }
            } catch (error) {
                const isAbort =
                    (error as { code?: string; name?: string })?.code ===
                        "ERR_CANCELED" ||
                    (error as { code?: string; name?: string })?.name ===
                        "CanceledError";
                if (isAbort) return;
                setError("Không thể tải thêm tin nhắn cũ");
            } finally {
                if (olderMessagesAbortRef.current === controller) {
                    olderMessagesAbortRef.current = null;
                }
                if (token === loadTokenRef.current) {
                    setLoadingMore(false);
                }
                setTimeout(() => {
                    loadMoreRequestedRef.current = false;
                }, 500);
            }
        },
        [
            applyWindowForOlder,
            conversationId,
            hasMoreOlder,
            hasMoreNewer,
            isHistoricalMode,
            loadingMore,
            mergeReferenceUsers,
            olderCursor,
            captureVisibleAnchor,
            restoreVisibleAnchor,
            armMediaLoadStabilizer,
            userId,
        ],
    );

    const loadNewerMessages = useCallback(async () => {
        if (returningToPresentRef.current) return;
        if (!isHistoricalMode || !hasMoreNewer || loadingMore) return;
        if (jumpPagingLockRef.current) return;
        if (loadMoreRequestedRef.current) return;

        // User đang đi về phía tin mới hơn, không cần giữ anchor của nhánh load older nữa.
        resetMediaLoadStabilizer();

        const newest = messages.at(-1);
        const after = newest?.createdAt;
        if (!after) return;

        loadMoreRequestedRef.current = true;
        const token = loadTokenRef.current;

        try {
            setLoadingMore(true);

            const response = await chatService.getNewerMessages(
                conversationId,
                userId,
                after,
                PAGE_SIZE,
            );

            if (token !== loadTokenRef.current) return;

            const cursorData = response?.success ? response.data : null;
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

            setMessages((prev) => {
                const merged = [...prev, ...newer];
                const trimmed = applyWindowForNewer(merged);
                chatRuntimeStore.setMessages(conversationId, trimmed);
                return trimmed;
            });

            const nextHasMoreOlder = Boolean(cursorData?.hasMoreOlder);
            const nextHasMoreNewer = Boolean(cursorData?.hasMoreNewer);
            const nextHistorical = nextHasMoreNewer;

            setHasMoreOlder(nextHasMoreOlder);
            setHasMoreNewer(nextHasMoreNewer);
            setIsHistoricalMode(nextHistorical);
            suppressPagingLoadRef.current = true;
            if (suppressPagingLoadTimerRef.current) {
                clearTimeout(suppressPagingLoadTimerRef.current);
            }
            suppressPagingLoadTimerRef.current = setTimeout(() => {
                suppressPagingLoadRef.current = false;
                suppressPagingLoadTimerRef.current = null;
            }, 400);
            chatRuntimeStore.patchPaging(conversationId, {
                hasMoreOlder: nextHasMoreOlder,
                hasMoreNewer: nextHasMoreNewer,
                isHistoricalMode: nextHistorical,
            });
        } catch {
            setError("Không thể tải tin nhắn mới hơn");
        } finally {
            if (token === loadTokenRef.current) {
                setLoadingMore(false);
            }
            setTimeout(() => {
                loadMoreRequestedRef.current = false;
            }, 500);
        }
    }, [
        applyWindowForNewer,
        conversationId,
        hasMoreNewer,
        isHistoricalMode,
        loadingMore,
        mergeReferenceUsers,
        messages,
        resetMediaLoadStabilizer,
        userId,
    ]);

    const jumpToMessage = useCallback(
        async (targetMessageId: string): Promise<boolean> => {
            const token = loadTokenRef.current;
            resetMediaLoadStabilizer();
            jumpPagingLockRef.current = true;
            if (jumpPagingLockTimerRef.current) {
                clearTimeout(jumpPagingLockTimerRef.current);
                jumpPagingLockTimerRef.current = null;
            }
            if (olderMessagesAbortRef.current) {
                olderMessagesAbortRef.current.abort();
                olderMessagesAbortRef.current = null;
            }

            try {
                setLoadingMore(true);
                const response = await chatService.jumpToMessage(
                    conversationId,
                    targetMessageId,
                    userId,
                );

                if (token !== loadTokenRef.current) return false;

                const cursorData = response?.success ? response.data : null;
                const jumped = Array.isArray(cursorData?.data)
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

                setMessages(jumped);
                chatRuntimeStore.setMessages(conversationId, jumped);

                const nextHasMoreOlder = Boolean(cursorData?.hasMoreOlder);
                const nextHasMoreNewer = Boolean(cursorData?.hasMoreNewer);
                const nextHistorical = nextHasMoreNewer;
                const fallbackOlderCursor = jumped[0]?.createdAt ?? null;
                const resolvedOlderCursor =
                    cursorData?.nextCursor ?? fallbackOlderCursor;
                pendingOlderPrefetchAfterJumpRef.current = nextHasMoreOlder;

                setOlderCursor(resolvedOlderCursor);
                setHasMoreOlder(nextHasMoreOlder);
                setHasMoreNewer(nextHasMoreNewer);
                setIsHistoricalMode(nextHistorical);
                suppressPagingLoadRef.current = true;
                if (suppressPagingLoadTimerRef.current) {
                    clearTimeout(suppressPagingLoadTimerRef.current);
                }
                suppressPagingLoadTimerRef.current = setTimeout(() => {
                    suppressPagingLoadRef.current = false;
                    suppressPagingLoadTimerRef.current = null;
                }, 600);
                chatRuntimeStore.setPaging(conversationId, {
                    hasMoreOlder: nextHasMoreOlder,
                    hasMoreNewer: nextHasMoreNewer,
                    isHistoricalMode: nextHistorical,
                    olderCursor: resolvedOlderCursor,
                });

                return true;
            } catch {
                showJumpToast();
                return false;
            } finally {
                if (token === loadTokenRef.current) {
                    setLoadingMore(false);
                }
                jumpPagingLockTimerRef.current = setTimeout(() => {
                    jumpPagingLockRef.current = false;
                    jumpPagingLockTimerRef.current = null;
                }, 1200);
            }
        },
        [
            conversationId,
            mergeReferenceUsers,
            resetMediaLoadStabilizer,
            showJumpToast,
            userId,
        ],
    );

    const handleJumpToMessage = useCallback(
        async (targetMessageId: string): Promise<boolean> => {
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
                if (isMessageDeletedForUser(localMessage, userId)) {
                    showJumpToast();
                    return false;
                }
                return true;
            }

            return jumpToMessage(targetMessageId);
        },
        [conversationId, jumpToMessage, messages, showJumpToast, userId],
    );

    useEffect(() => {
        // Auto-fill chỉ chạy khi:
        // - đã load xong initial (loading=false)
        // - backend nói còn hasMoreOlder
        // - container chưa scrollable (ít tin quá)
        // Mục tiêu: tránh tình trạng UI không scroll được nhưng user vẫn muốn xem "gần đây".
        if (loading) return;
        if (!isHistoricalMode) return;
        if (skipAutoFillOnceRef.current) {
            skipAutoFillOnceRef.current = false;
            return;
        }
        if (jumpPagingLockRef.current) return;
        if (suppressPagingLoadRef.current) return;
        if (!hasMoreOlder || loadingMore || !olderCursor) return;
        if (autoFillPendingRef.current) return;

        const container = messagesContainerRef.current;
        if (!container) return;

        const canScroll =
            container.scrollHeight >
            container.clientHeight + SCROLLABLE_EPSILON_PX;
        if (canScroll) return;

        autoFillPendingRef.current = true;
        loadOlderMessages({ keepAtBottom: true }).finally(() => {
            autoFillPendingRef.current = false;
        });
    }, [
        hasMoreOlder,
        isHistoricalMode,
        loadOlderMessages,
        loading,
        loadingMore,
        messages.length,
        olderCursor,
    ]);

    useEffect(() => {
        if (!pendingOlderPrefetchAfterJumpRef.current) return;
        if (loadingMore) return;
        if (jumpPagingLockRef.current) return;

        const container = messagesContainerRef.current;
        if (!container) return;

        if (!hasMoreOlder || !olderCursor) {
            pendingOlderPrefetchAfterJumpRef.current = false;
            return;
        }

        // Chỉ prefetch khi sau jump bị dính gần đỉnh.
        if (container.scrollTop > LOAD_MORE_TRIGGER_PX) {
            pendingOlderPrefetchAfterJumpRef.current = false;
            return;
        }

        pendingOlderPrefetchAfterJumpRef.current = false;
        void loadOlderMessages();
    }, [
        hasMoreOlder,
        jumpPagingLockRef,
        loadOlderMessages,
        loadingMore,
        olderCursor,
        messages.length,
    ]);

    const handleNewMessage = useCallback(
        (
            newMessage: Message,
            markAsReadFn?: (lastMessageId: string) => void,
        ) => {
            const normalizedIncoming = normalizeReplyPreviewContent(newMessage);
            const readOnlyReason = resolveReadOnlyReasonFromSystemMessage(
                normalizedIncoming,
                userIdRef.current,
            );
            if (readOnlyReason) {
                setReadOnlyNotice(GROUP_READ_ONLY_COMPOSER_NOTICE);
                setError(readOnlyReason);

                // Khi bị cấm quyền truy cập (giải tán/đuổi/rời), dọn dẹp state
                // để UI chuyển sang 'Error View' ngay lập tức (giống như sau khi F5)
                setMessages([]);
                setConversation(null);
                setMembersById({});

                // Giải đăng ký socket của hội thoại cũ
                websocketService.unsubscribeFromConversation(conversationId);
                websocketService.unsubscribeFromConversationMembers(
                    conversationId,
                );
                websocketService.unsubscribeFromConversationPins(
                    conversationId,
                );
                onForbiddenRef.current?.();
            }

            if (GROUP_SYSTEM_MEMBER_SYNC_TYPES.has(normalizedIncoming.type)) {
                void syncConversationData();
            }

            const isMyMessage =
                Number(normalizedIncoming.senderId) ===
                Number(userIdRef.current);
            const currentlyNearBottom = isNearBottom();
            const incomingClientMessageId = normalizedIncoming.clientMessageId;

            if (incomingClientMessageId) {
                let replacedOptimistic = false;
                setMessages((prev) => {
                    const existingIndex = prev.findIndex(
                        (m) => m.clientMessageId === incomingClientMessageId,
                    );
                    if (existingIndex < 0) return prev;

                    replacedOptimistic = true;
                    const nextMessages = [...prev];
                    nextMessages[existingIndex] = {
                        ...normalizedIncoming,
                        deliveryStatus: "sent",
                    };
                    const dedupedMessages =
                        dedupeMessagesByIdentity(nextMessages);
                    chatRuntimeStore.setMessages(
                        conversationId,
                        dedupedMessages,
                    );
                    return dedupedMessages;
                });

                if (replacedOptimistic) {
                    void messageOutbox.remove(incomingClientMessageId);
                    scrollOnNextRenderRef.current = "smooth";
                }
            }

            if (isHistoricalModeRef.current) {
                setShowScrollToBottomButton(true);
                setPendingNewMessages((count) => count + 1);
                return;
            }

            setMessages((prev) => {
                if (prev.some((m) => m.id === normalizedIncoming.id)) {
                    return prev;
                }
                if (
                    normalizedIncoming.clientMessageId &&
                    prev.some(
                        (m) =>
                            m.clientMessageId ===
                            normalizedIncoming.clientMessageId,
                    )
                ) {
                    const nextMessages = prev.map((m) =>
                        m.clientMessageId === normalizedIncoming.clientMessageId
                            ? { ...normalizedIncoming, deliveryStatus: "sent" as const }
                            : m,
                    );
                    const dedupedMessages =
                        dedupeMessagesByIdentity(nextMessages);
                    chatRuntimeStore.setMessages(
                        conversationId,
                        dedupedMessages,
                    );
                    return dedupedMessages;
                }
                const nextMessages = applyWindowForNewer([
                    ...prev,
                    isMyMessage
                        ? { ...normalizedIncoming, deliveryStatus: "sent" as const }
                        : normalizedIncoming,
                ]);
                const dedupedMessages = dedupeMessagesByIdentity(nextMessages);
                chatRuntimeStore.setMessages(conversationId, dedupedMessages);
                return dedupedMessages;
            });

            if (isMyMessage || currentlyNearBottom) {
                // Người gửi: luôn cuộn xuống cuối bất kể đang ở đâu
                // Người nhận: cuộn nếu đang ở gần cuối
                scrollOnNextRenderRef.current = "smooth";
                setShowScrollToBottomButton(false);
                setPendingNewMessages(0);

                // Set flag để force scroll khi media load xong (cho IMAGE/VIDEO)
                // Cần làm này vì khi scroll xuống cuối, media chưa load → chiều cao chưa đúng
                // Sau khi media load xong, chiều cao tăng → scroll position bị đẩy lên
                // isNearBottom() sẽ trả về false → không scroll
                if (
                    normalizedIncoming.type === "IMAGE" ||
                    normalizedIncoming.type === "VIDEO"
                ) {
                    // Clear timer cũ nếu có
                    if (shouldScrollOnMediaLoadTimerRef.current) {
                        clearTimeout(shouldScrollOnMediaLoadTimerRef.current);
                    }
                    shouldScrollOnMediaLoadRef.current = true;
                    // Reset flag sau 3s (đủ thời gian cho media load)
                    shouldScrollOnMediaLoadTimerRef.current = setTimeout(() => {
                        shouldScrollOnMediaLoadRef.current = false;
                    }, 3000);
                }

                // Đánh dấu đã đọc tin nhắn mới nếu user đang ở gần cuối (đang đọc)
                // Không đánh dấu nếu là tin nhắn của chính mình (đã được backend xử lý)
                if (!isMyMessage && markAsReadFn) {
                    markAsReadFn(normalizedIncoming.id);
                }
            } else {
                // Người nhận không ở cuối: chỉ hiện nút + đếm tin chưa xem
                setShowScrollToBottomButton(true);
                setPendingNewMessages((c) => c + 1);
            }
        },
        [
            applyWindowForNewer,
            conversationId,
            isNearBottom,
            syncConversationData,
        ],
    );
    // Nhận socket MESSAGE_RECALLED: set isRecalled=true cho tin nhắn đó
    const handleMessageRecalled = useCallback(
        (messageId: string) => {
            const applyRecallDomino = (message: Message): Message => {
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

            setMessages((prev) => prev.map(applyRecallDomino));
            const cachedMessages = chatRuntimeStore
                .getMessages(conversationId)
                .map(applyRecallDomino);
            chatRuntimeStore.setMessages(conversationId, cachedMessages);
        },
        [conversationId],
    );

    // Gọi API thu hồi tin nhắn (chỉ người gửi, trong 24h)
    const handleRecall = useCallback(
        async (messageId: string) => {
            if (!canRecallOwnMessages) {
                setRecallToast(
                    "Chỉ Trưởng/Phó nhóm mới được thu hồi tin nhắn trong chế độ này",
                );
                return;
            }

            // Kiểm tra 24h ở FE trước để tránh round-trip không cần thiết
            const msg = messages.find((m) => m.id === messageId);
            if (msg) {
                const elapsed = Date.now() - new Date(msg.createdAt).getTime();
                if (elapsed > 24 * 60 * 60 * 1000) {
                    setRecallToast(
                        "Chỉ có thể thu hồi tin nhắn trong vòng 24 giờ",
                    );
                    return;
                }
            }
            try {
                await chatService.recallMessage(messageId, userId);
            } catch {
                setRecallToast("Không thể thu hồi tin nhắn");
            }
        },
        [canRecallOwnMessages, messages, userId],
    );

    // Xóa tin nhắn ở phía tôi (chỉ local, không ảnh hưởng người khác)
    const handleDeleteMessageForMe = useCallback(
        async (messageId: string) => {
            try {
                await chatService.deleteMessageForMe(messageId, userId);
                // API 200 OK → xóa tin nhắn khỏi local state
                setMessages((prev) => {
                    const nextMessages = prev.filter((m) => m.id !== messageId);
                    chatRuntimeStore.setMessages(conversationId, nextMessages);
                    return nextMessages;
                });
            } catch {
                setRecallToast("Không thể xóa tin nhắn");
            }
        },
        [conversationId, userId],
    );

    // Xóa cuộc trò chuyện ở phía tôi (xóa lịch sử chat)
    const handleDeleteConversationForMe = useCallback(async () => {
        try {
            await chatService.deleteConversationForMe(conversationId, userId);
            // API 200 OK → xóa toàn bộ tin nhắn khỏi local state
            setMessages([]);
            chatRuntimeStore.setMessages(conversationId, []);
            chatRuntimeStore.setMembers(conversationId, {});
            chatRuntimeStore.setPins(conversationId, []);
            setHasMoreOlder(false);
            setHasMoreNewer(false);
            setIsHistoricalMode(false);
            setOlderCursor(null);
            jumpPagingLockRef.current = false;
            if (jumpPagingLockTimerRef.current) {
                clearTimeout(jumpPagingLockTimerRef.current);
                jumpPagingLockTimerRef.current = null;
            }
            chatRuntimeStore.setPaging(conversationId, {
                hasMoreOlder: false,
                hasMoreNewer: false,
                isHistoricalMode: false,
                olderCursor: null,
            });
        } catch {
            setRecallToast("Không thể xóa cuộc trò chuyện");
        }
    }, [conversationId, userId]);

    /**
     * markAsRead - Đánh dấu đã đọc tin nhắn (với debounce)
     *
     * @param lastMessageId - ID của tin nhắn mới nhất mà user đang nhìn thấy
     *
     * Flow:
     * 1. Debounce 1 giây để tránh spam API khi nhiều tin nhắn liên tiếp
     * 2. Gọi API PUT /conversations/{id}/read?lastMessageId=xxx
     * 3. Nếu thành công, gọi callback onMarkAsRead để clear unreadCount ở sidebar
     */
    const markAsRead = useCallback(
        (lastMessageId: string) => {
            console.log("📖 markAsRead called with messageId:", lastMessageId);

            // Clear timeout cũ nếu có
            if (markAsReadTimeoutRef.current) {
                clearTimeout(markAsReadTimeoutRef.current);
                console.log("⏱️  Cleared previous debounce timer");
            }

            // Debounce: chỉ gọi API sau khoảng thời gian delay
            markAsReadTimeoutRef.current = setTimeout(async () => {
                console.log("🚀 Calling markAsRead API...", {
                    conversationId,
                    userId,
                    lastMessageId,
                });

                try {
                    await chatService.markAsRead(
                        conversationId,
                        userId,
                        lastMessageId,
                    );
                    console.log("✅ markAsRead API success");
                    // Gọi callback để clear unreadCount ở sidebar
                    onMarkAsRead?.(conversationId);
                } catch (err) {
                    console.error("❌ Failed to mark as read:", err);
                }
            }, MARK_AS_READ_DEBOUNCE_MS);
        },
        [conversationId, userId, onMarkAsRead],
    );

    const catchUpActiveConversationMessages = useCallback(async () => {
        const now = Date.now();
        if (activeConversationCatchupRef.current.inFlight) return;
        if (now - activeConversationCatchupRef.current.lastRunAt < 2500) {
            return;
        }

        activeConversationCatchupRef.current.inFlight = true;
        activeConversationCatchupRef.current.lastRunAt = now;

        try {
            if (isHistoricalModeRef.current) {
                await syncConversationData();
                activeConversationCatchupRef.current.needsCatchup = false;
                return;
            }

            const wasNearBottom = isNearBottom();
            const response = await chatService.getMessages(
                conversationId,
                userIdRef.current,
                null,
                PAGE_SIZE,
            );
            const cursorData = response?.success ? response.data : null;
            const latest = Array.isArray(cursorData?.data)
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

            const currentMessages = messagesRef.current;
            const currentIds = new Set(
                currentMessages.map((message) => message.id),
            );
            const currentClientIds = new Set(
                currentMessages
                    .map((message) => message.clientMessageId)
                    .filter(Boolean),
            );
            const missingLatest = latest.filter(
                (message) =>
                    !currentIds.has(message.id) &&
                    (!message.clientMessageId ||
                        !currentClientIds.has(message.clientMessageId)),
            );
            const lastReadableIncomingId =
                [...missingLatest]
                    .reverse()
                    .find(
                        (message) =>
                            Number(message.senderId) !==
                            Number(userIdRef.current),
                    )?.id ?? null;
            const missingMessageCount = missingLatest.length;

            setMessages((prev) => {
                const existingIds = new Set(prev.map((message) => message.id));
                const existingClientIds = new Set(
                    prev
                        .map((message) => message.clientMessageId)
                        .filter(Boolean),
                );
                const missing = missingLatest.filter(
                    (message) =>
                        !existingIds.has(message.id) &&
                        (!message.clientMessageId ||
                            !existingClientIds.has(message.clientMessageId)),
                );

                if (missing.length === 0) return prev;

                const nextMessages = applyWindowForNewer(
                    dedupeMessagesByIdentity([
                        ...prev,
                        ...missing.map((message) =>
                            Number(message.senderId) === Number(userIdRef.current)
                                ? { ...message, deliveryStatus: "sent" as const }
                                : message,
                        ),
                    ]).sort((a, b) => {
                        const timeA = Date.parse(a.createdAt ?? "");
                        const timeB = Date.parse(b.createdAt ?? "");
                        const safeTimeA = Number.isFinite(timeA) ? timeA : 0;
                        const safeTimeB = Number.isFinite(timeB) ? timeB : 0;
                        if (safeTimeA !== safeTimeB) return safeTimeA - safeTimeB;
                        return String(a.id).localeCompare(String(b.id));
                    }),
                );
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
            });

            if (lastReadableIncomingId && wasNearBottom) {
                markAsRead(lastReadableIncomingId);
            }

            if (missingMessageCount > 0) {
                if (wasNearBottom) {
                    scrollOnNextRenderRef.current = "smooth";
                    setShowScrollToBottomButton(false);
                    setPendingNewMessages(0);
                } else {
                    setShowScrollToBottomButton(true);
                    setPendingNewMessages((count) => count + missingMessageCount);
                }
            }

            await syncConversationData();
            activeConversationCatchupRef.current.needsCatchup = false;
        } catch {
            activeConversationCatchupRef.current.needsCatchup = true;
            // Best-effort catch-up. WebSocket hoặc lần focus/online tiếp theo sẽ thử lại.
        } finally {
            activeConversationCatchupRef.current.inFlight = false;
        }
    }, [
        applyWindowForNewer,
        conversationId,
        isNearBottom,
        markAsRead,
        mergeReferenceUsers,
        syncConversationData,
    ]);

    useEffect(() => {
        if (!userId) return;
        const catchupTimers: number[] = [];
        const clearRetryTimer = () => {
            const timerId = activeConversationCatchupRef.current.retryTimerId;
            if (timerId !== null) {
                window.clearTimeout(timerId);
                activeConversationCatchupRef.current.retryTimerId = null;
            }
        };

        const scheduleRetryLoop = () => {
            if (activeConversationCatchupRef.current.retryTimerId !== null) return;
            activeConversationCatchupRef.current.retryTimerId = window.setTimeout(() => {
                activeConversationCatchupRef.current.retryTimerId = null;
                if (!activeConversationCatchupRef.current.needsCatchup) {
                    activeConversationCatchupRef.current.retryAttempts = 0;
                    return;
                }
                if (document.visibilityState !== "visible" || !navigator.onLine) {
                    scheduleRetryLoop();
                    return;
                }
                if (activeConversationCatchupRef.current.retryAttempts >= 20) {
                    activeConversationCatchupRef.current.retryAttempts = 0;
                    return;
                }
                activeConversationCatchupRef.current.retryAttempts += 1;
                void catchUpActiveConversationMessages();
                scheduleRetryLoop();
            }, 3000);
        };

        const scheduleCatchup = () => {
            if (!activeConversationCatchupRef.current.needsCatchup) return;
            activeConversationCatchupRef.current.retryAttempts = 0;
            [0, 3000, 8000].forEach((delay) => {
                catchupTimers.push(
                    window.setTimeout(() => {
                        void catchUpActiveConversationMessages();
                    }, delay),
                );
            });
            scheduleRetryLoop();
        };

        const forceCatchup = () => {
            activeConversationCatchupRef.current.needsCatchup = true;
            scheduleCatchup();
        };

        const markNeedsCatchup = () => {
            activeConversationCatchupRef.current.needsCatchup = true;
            activeConversationCatchupRef.current.retryAttempts = 0;
            scheduleRetryLoop();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                scheduleCatchup();
            }
        };

        window.addEventListener("online", forceCatchup);
        window.addEventListener("wisdom-websocket-reconnected", forceCatchup);
        window.addEventListener("offline", markNeedsCatchup);
        window.addEventListener("focus", scheduleCatchup);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            catchupTimers.forEach((timerId) => window.clearTimeout(timerId));
            clearRetryTimer();
            window.removeEventListener("online", forceCatchup);
            window.removeEventListener("wisdom-websocket-reconnected", forceCatchup);
            window.removeEventListener("offline", markNeedsCatchup);
            window.removeEventListener("focus", scheduleCatchup);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [catchUpActiveConversationMessages, userId]);

    useEffect(() => {
        const handleUserBlockStatusChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
                blockerId?: number;
                blockedId?: number;
                blocked?: boolean;
            } | null;
            if (!detail) return;

            setConversation((previousConversation) => {
                if (!previousConversation || previousConversation.type !== "DIRECT") {
                    return previousConversation;
                }

                const partnerId = Number(
                    previousConversation.directPartnerId ??
                        previousConversation.members?.find(
                            (member) => Number(member.userId) !== Number(userId),
                        )?.userId,
                );
                if (!Number.isFinite(partnerId)) return previousConversation;

                const currentUserId = Number(userId);
                const affectsThisConversation =
                    (Number(detail.blockerId) === currentUserId &&
                        Number(detail.blockedId) === partnerId) ||
                    (Number(detail.blockerId) === partnerId &&
                        Number(detail.blockedId) === currentUserId);
                if (!affectsThisConversation) return previousConversation;

                const nextConversation = {
                    ...previousConversation,
                    directBlockedByMe:
                        Number(detail.blockerId) === currentUserId
                            ? Boolean(detail.blocked)
                            : previousConversation.directBlockedByMe,
                    directBlockedMe:
                        Number(detail.blockedId) === currentUserId
                            ? Boolean(detail.blocked)
                            : previousConversation.directBlockedMe,
                };
                chatRuntimeStore.setConversation(conversationId, nextConversation);
                return nextConversation;
            });

            if (!detail.blocked) {
                setReadOnlyNotice(null);
                setError(null);
            }
        };

        window.addEventListener(
            "user-block-status-changed",
            handleUserBlockStatusChanged,
        );
        return () => {
            window.removeEventListener(
                "user-block-status-changed",
                handleUserBlockStatusChanged,
            );
        };
    }, [conversationId, userId]);

    /**
     * handleMessageSeen - Xử lý khi nhận được event "Người khác đã xem"
     *
     * @param event - MessageSeenEvent từ WebSocket
     *
     * Flow:
     * 1. Trích xuất payload từ messageSeenResponse
     * 2. Kiểm tra event có thuộc conversation đang mở không
     * 3. Bỏ qua nếu event là của chính user hiện tại (vì user đã biết mình đã xem)
     * 4. Cập nhật readReceipts: di chuyển avatar của user trong event xuống tin nhắn mới
     */
    const handleMessageSeen = useCallback(
        (event: MessageSeenEvent) => {
            console.log("📨 Received MESSAGE_SEEN event:", event);

            // Trích xuất payload từ messageSeenResponse
            const {
                conversationId: eventConvId,
                userId: eventUserId,
                lastMessageId,
                seenAt,
            } = event.messageSeenResponse;

            console.log("📨 Parsed payload:", {
                eventConvId,
                eventUserId,
                lastMessageId,
                seenAt,
            });
            console.log("📨 Current state:", {
                currentConvId: conversationId,
                currentUserId: userId,
            });

            // Bỏ qua nếu không phải conversation đang mở
            if (Number(eventConvId) !== Number(conversationId)) {
                console.log("❌ Event không thuộc conversation đang mở");
                return;
            }
            // Bỏ qua event của chính mình
            if (Number(eventUserId) === Number(userId)) {
                console.log("❌ Event của chính mình, bỏ qua");
                return;
            }

            console.log("✅ Cập nhật readReceipts cho user:", eventUserId);

            setReadReceipts((prev) => {
                // Tìm xem user này đã có trong readReceipts chưa
                const existingIndex = prev.findIndex(
                    (r) => r.userId === Number(eventUserId),
                );

                const newReceipt: ReadReceipt = {
                    userId: Number(eventUserId),
                    lastMessageId: lastMessageId,
                    seenAt: seenAt,
                };

                if (existingIndex >= 0) {
                    // Update vị trí đã xem
                    const updated = [...prev];
                    updated[existingIndex] = newReceipt;
                    console.log("📝 Updated readReceipts:", updated);
                    return updated;
                } else {
                    // Thêm mới
                    const newList = [...prev, newReceipt];
                    console.log("📝 Added new readReceipt:", newList);
                    return newList;
                }
            });
        },
        [conversationId, userId],
    );

    /**
     * handleTyping - Xử lý khi nhận được event "Đang gõ tin nhắn"
     *
     * @param event - TypingEvent từ WebSocket
     *
     * Flow:
     * 1. Trích xuất payload từ typingResponse
     * 2. Kiểm tra event có thuộc conversation đang mở không
     * 3. Bỏ qua nếu event là của chính user hiện tại
     * 4. Nếu isTyping=true: Thêm userId vào typingUsers Set và set timeout 10s để auto-clear
     * 5. Nếu isTyping=false: Xóa userId khỏi typingUsers Set và clear timeout
     */
    const handleTyping = useCallback(
        (event: TypingEvent) => {
            console.log("⌨️ Received TYPING event from WebSocket:", event);

            const {
                conversationId: eventConvId,
                userId: eventUserId,
                isTyping,
            } = event.typingResponse;

            // Bỏ qua nếu không phải conversation đang mở
            if (Number(eventConvId) !== Number(conversationId)) return;
            // Bỏ qua event của chính mình
            if (Number(eventUserId) === Number(userId)) return;

            console.log("⌨️ TYPING event:", { eventUserId, isTyping });

            if (isTyping) {
                // Clear timeout cũ nếu có
                const existingTimeout = typingTimeoutsRef.current.get(
                    Number(eventUserId),
                );
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                }

                // Thêm user vào Set đang gõ
                setTypingUsers((prev) =>
                    new Set(prev).add(Number(eventUserId)),
                );

                // Set timeout 10s để auto-clear (phòng trường hợp user rớt mạng)
                const timeoutId = setTimeout(() => {
                    setTypingUsers((prev) => {
                        const next = new Set(prev);
                        next.delete(Number(eventUserId));
                        return next;
                    });
                    typingTimeoutsRef.current.delete(Number(eventUserId));
                }, 10000);

                typingTimeoutsRef.current.set(Number(eventUserId), timeoutId);
            } else {
                // Clear timeout
                const existingTimeout = typingTimeoutsRef.current.get(
                    Number(eventUserId),
                );
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                    typingTimeoutsRef.current.delete(Number(eventUserId));
                }

                // Xóa user khỏi Set
                setTypingUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(Number(eventUserId));
                    return next;
                });
            }
        },
        [conversationId, userId],
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
                                  options: poll.options.map((option) => ({
                                      ...option,
                                      selectedByCurrentUser:
                                          message.poll?.currentUserOptionIds?.includes(
                                              option.id,
                                          ) ??
                                          option.selectedByCurrentUser,
                                  })),
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

    /**
     * sendTypingSignal - Gửi signal "đang gõ" lên backend
     *
     * @param isTyping - true nếu đang gõ, false nếu ngừng gõ
     *
     * Logic chống SPAM:
     * - Chỉ gửi isTyping=true MỘT LẦN khi bắt đầu gõ
     * - Không gửi lại khi đang gõ liên tục
     * - Gửi isTyping=false khi: Enter/Input rỗng/Blur/10s không gõ
     */
    const sendTypingSignal = useCallback(
        (isTyping: boolean) => {
            console.log("⌨️ sendTypingSignal called:", {
                conversationId,
                userId,
                isTyping,
                alreadySent: isTypingSentRef.current,
            });

            if (!conversationId || !userId) {
                console.warn(
                    "⌨️ Missing conversationId or userId, skipping typing signal",
                );
                return;
            }

            if (isTyping) {
                // Chỉ gửi nếu chưa gửi trước đó
                if (!isTypingSentRef.current) {
                    websocketService.sendTypingSignal(
                        conversationId,
                        userId,
                        true,
                    );
                    isTypingSentRef.current = true;
                    console.log("⌨️ Sent typing=true");
                }

                // Clear timeout cũ
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }

                // Set timeout 10s để tự động gử false
                typingTimeoutRef.current = setTimeout(() => {
                    websocketService.sendTypingSignal(
                        conversationId,
                        userId,
                        false,
                    );
                    isTypingSentRef.current = false;
                    console.log("⌨️ Sent typing=false (10s timeout)");
                }, 10000);
            } else {
                // Clear timeout
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                }

                // Gửi signal false (chỉ nếu đã gửi true trước đó)
                if (isTypingSentRef.current) {
                    websocketService.sendTypingSignal(
                        conversationId,
                        userId,
                        false,
                    );
                    isTypingSentRef.current = false;
                    console.log("⌨️ Sent typing=false");
                }
            }
        },
        [conversationId, userId],
    );

    /**
     * useEffect: Xử lý scroll khi typing indicator hiện/mất
     *
     * Logic:
     * 1. Khi có người đang gõ (typingUsers.size > 0) và user đang ở cuối (isNearBottom):
     *    - Lưu vị trí scroll hiện tại
     *    - Scroll xuống để thấy typing indicator
     *
     * 2. Khi không còn ai gõ (typingUsers.size = 0):
     *    - Nếu KHÔNG có tin nhắn mới → restore về vị trí cũ
     *    - Nếu CÓ tin nhắn mới → giữ nguyên ở cuối (handleNewMessage đã xử lý)
     */
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        if (typingUsers.size > 0) {
            // Có người đang gõ
            if (
                scrollPositionBeforeTypingRef.current === null &&
                isNearBottom()
            ) {
                // Lần đầu có typing indicator và user ở cuối
                // Lưu vị trí scroll và số messages hiện tại
                scrollPositionBeforeTypingRef.current = container.scrollTop;
                messagesLengthWhenTypingRef.current = messages.length;

                // Scroll xuống để thấy typing indicator (sau khi DOM update)
                requestAnimationFrame(() => {
                    scrollToBottom("smooth");
                });
            }
        } else {
            // Không còn ai gõ
            if (scrollPositionBeforeTypingRef.current !== null) {
                // Kiểm tra có tin nhắn mới không
                const hasNewMessages =
                    messages.length > messagesLengthWhenTypingRef.current;

                if (!hasNewMessages) {
                    // Không có tin mới → restore vị trí scroll cũ
                    container.scrollTop = scrollPositionBeforeTypingRef.current;
                }

                // Reset refs
                scrollPositionBeforeTypingRef.current = null;
                messagesLengthWhenTypingRef.current = 0;
            }
        }
    }, [typingUsers.size, messages.length, isNearBottom, scrollToBottom]);

    useEffect(() => {
        if (!userId) return; // Wait until authenticated

        // Mỗi lần đổi conversationId:
        // - tăng token để invalidate request cũ
        // - reset state liên quan
        // - fetch lại conversation + messages
        // - subscribe websocket theo conversation mới
        loadTokenRef.current += 1;
        const token = loadTokenRef.current;

        const cachedConversation =
            chatRuntimeStore.getConversation(conversationId);
        const cachedMembers = chatRuntimeStore.getMembers(conversationId);
        const cachedPins = chatRuntimeStore.getPins(conversationId);
        if (cachedConversation) {
            setConversation({
                ...cachedConversation,
                members:
                    Object.values(cachedMembers).length > 0
                        ? Object.values(cachedMembers)
                        : cachedConversation.members,
            });
        }
        setMembersById(cachedMembers);
        setPinnedMessages(cachedPins);

        setLoading(true);
        setError(null);
        setReadOnlyNotice(null);
        setSending(false);
        setMessageText("");
        setMessages([]);
        if (!cachedConversation) {
            setConversation(null);
        }
        setShowScrollToBottomButton(false);
        setPendingNewMessages(0);
        setLoadingMore(false);
        setHasMoreOlder(false);
        setHasMoreNewer(false);
        setIsHistoricalMode(false);
        setOlderCursor(null);
        suppressPagingLoadRef.current = false;
        jumpPagingLockRef.current = false;
        if (suppressPagingLoadTimerRef.current) {
            clearTimeout(suppressPagingLoadTimerRef.current);
            suppressPagingLoadTimerRef.current = null;
        }
        if (jumpPagingLockTimerRef.current) {
            clearTimeout(jumpPagingLockTimerRef.current);
            jumpPagingLockTimerRef.current = null;
        }
        setReadReceipts([]); // Reset read receipts khi đổi conversation
        setTypingUsers(new Set()); // Reset typing users khi đổi conversation
        isTypingSentRef.current = false; // Reset typing sent flag khi đổi conversation
        scrollPositionBeforeTypingRef.current = null; // Reset typing scroll position
        messagesLengthWhenTypingRef.current = 0; // Reset messages count for typing
        // Reset media scroll flag và timer khi đổi conversation
        if (shouldScrollOnMediaLoadTimerRef.current) {
            clearTimeout(shouldScrollOnMediaLoadTimerRef.current);
            shouldScrollOnMediaLoadTimerRef.current = null;
        }
        shouldScrollOnMediaLoadRef.current = false;

        // Đánh dấu đang trong giai đoạn initial load để luôn scroll xuống cuối khi media load
        initialLoadRef.current = true;
        // Reset scroll position tracking
        lastScrollTopRef.current = 0;
        // Reset load more guard
        loadMoreRequestedRef.current = false;
        mediaLoadStabilizerRef.current = {
            activeUntil: 0,
            lastScrollHeight: 0,
            anchorMessageId: null,
            anchorTopOffset: 0,
        };
        // Theo đặc tả room switching: luôn bỏ cache messages/paging của room cũ.
        chatRuntimeStore.clearConversationRuntime(conversationId);

        if (cachedMembers[userIdRef.current]) {
            const cachedReceipts: ReadReceipt[] = Object.values(cachedMembers)
                .filter(
                    (m) =>
                        Number(m.userId) !== Number(userIdRef.current) &&
                        m.lastReadMessageId,
                )
                .map((m) => ({
                    userId: Number(m.userId),
                    lastMessageId: m.lastReadMessageId!,
                    seenAt: new Date().toISOString(),
                }));
            setReadReceipts(cachedReceipts);
        }

        void loadInitialData(token, markAsRead);

        const handleMemberUpdated = (event: MemberUpdatedEvent) => {
            if (Number(event.conversationId) !== Number(conversationId)) return;

            // Sự kiện MEMBER_UPDATED dùng để đổi nickname/avatar realtime.
            // Cập nhật cả members map và snapshot conversation để mọi nơi render thống nhất.
            setMembersById((prev) => {
                const next = {
                    ...prev,
                    [event.userId]: {
                        ...(prev[event.userId] ?? {
                            userId: event.userId,
                            username: "",
                            nickname: event.newNickname || "Unknown",
                        }),
                        nickname:
                            event.newNickname ||
                            prev[event.userId]?.nickname ||
                            "Unknown",
                        avatar: event.newAvatar || prev[event.userId]?.avatar,
                    },
                };
                chatRuntimeStore.setMembers(conversationId, next);
                setConversation((previousConversation) => {
                    if (!previousConversation) return previousConversation;
                    const nextConversation = {
                        ...previousConversation,
                        members: Object.values(next),
                    };
                    chatRuntimeStore.setConversation(
                        conversationId,
                        nextConversation,
                    );
                    return nextConversation;
                });
                return next;
            });
        };

        // Tài khoản 1 thành viên bị khóa/mở khóa -> cập nhật cờ accountLocked realtime
        // để mask/bỏ mask tên + avatar ở mọi nơi (header, message, member list, ...).
        const handleMemberAccountLockChanged = (
            event: MemberAccountLockChangedEvent,
        ) => {
            if (Number(event.conversationId) !== Number(conversationId)) return;

            const cachedMember = chatRuntimeStore.getMembers(conversationId)[
                event.userId
            ];
            const shouldRefreshIdentity =
                !event.accountLocked &&
                (!cachedMember ||
                    !cachedMember.nickname ||
                    cachedMember.nickname === "Unknown");

            setMembersById((prev) => {
                const existing = prev[event.userId];
                // Nếu chưa có member trong map (vd: đối phương direct chưa nạp),
                // vẫn tạo entry tối thiểu để giữ cờ khóa.
                const next = {
                    ...prev,
                    [event.userId]: {
                        ...(existing ?? {
                            userId: event.userId,
                            username: "",
                            nickname: "Unknown",
                        }),
                        accountLocked: event.accountLocked,
                    },
                };
                chatRuntimeStore.setMembers(conversationId, next);
                setConversation((previousConversation) => {
                    if (!previousConversation) return previousConversation;
                    const nextConversation = {
                        ...previousConversation,
                        members: Object.values(next),
                        // Với hội thoại DIRECT cập nhật luôn cờ đối phương để
                        // sidebar/header mask đúng kể cả khi members chưa đầy đủ.
                        directPartnerLocked:
                            previousConversation.type === "DIRECT" &&
                            Number(event.userId) !== Number(userId)
                                ? event.accountLocked
                                : previousConversation.directPartnerLocked,
                    };
                    chatRuntimeStore.setConversation(
                        conversationId,
                        nextConversation,
                    );
                    return nextConversation;
                });
                return next;
            });

            if (shouldRefreshIdentity) {
                void syncConversationData();
            }
        };

        const handleDirectBlockStatusChanged = (
            event: DirectBlockStatusChangedEvent,
        ) => {
            if (Number(event.conversationId) !== Number(conversationId)) return;

            setConversation((previousConversation) => {
                if (!previousConversation || previousConversation.type !== "DIRECT") {
                    return previousConversation;
                }

                const nextConversation = {
                    ...previousConversation,
                    directBlockedByMe:
                        Number(event.blockerId) === Number(userId)
                            ? event.blocked
                            : previousConversation.directBlockedByMe,
                    directBlockedMe:
                        Number(event.blockedId) === Number(userId)
                            ? event.blocked
                            : previousConversation.directBlockedMe,
                };
                chatRuntimeStore.setConversation(conversationId, nextConversation);
                return nextConversation;
            });
            if (!event.blocked) {
                setReadOnlyNotice(null);
                setError(null);
            }
        };

        const handlePinUpdated = (event: PinUpdatedEvent) => {
            if (Number(event.conversationId) !== Number(conversationId)) return;

            // Sự kiện PIN_MESSAGE/UPIN_MESSAGE từ websocket là nguồn realtime cho banner ghim.
            // Luôn ghi vào runtime store trước, rồi set state để UI đồng bộ tức thì.
            const nextPins = Array.isArray(event.currentPins)
                ? event.currentPins
                : [];
            chatRuntimeStore.setPins(conversationId, nextPins);
            setPinnedMessages(nextPins);
        };

        const setupWebSocket = async () => {
            try {
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }
                // Sub theo conversationId để nhận message realtime.
                // Wrap callback để truyền markAsRead vào handleNewMessage
                // Truyền handleMessageSeen để nhận MESSAGE_SEEN event
                // Truyền handleTyping để nhận TYPING event
                websocketService.subscribeToConversation(
                    conversationId,
                    (message) => handleNewMessage(message, markAsRead),
                    handleMessageRecalled,
                    handleMessageSeen, // Nhận MESSAGE_SEEN event từ topic conversation
                    handleTyping, // Nhận TYPING event từ topic conversation
                    handleMessageReactionEvent, // Nhận MESSAGE_REACTION event
                    handlePollUpdatedEvent,
                );
                websocketService.subscribeToConversationMembers(
                    conversationId,
                    handleMemberUpdated,
                    handleMemberAccountLockChanged,
                    handleDirectBlockStatusChanged,
                );
                websocketService.subscribeToConversationPins(
                    conversationId,
                    handlePinUpdated,
                );
            } catch {
                // no-op
            }
        };

        void setupWebSocket();

        return () => {
            // Cleanup tránh leak: khi đổi conversation hoặc unmount.
            websocketService.unsubscribeFromConversation(conversationId);
            websocketService.unsubscribeFromConversationMembers(conversationId);
            websocketService.unsubscribeFromConversationPins(conversationId);
            chatRuntimeStore.clearConversationRuntime(conversationId);

            if (suppressPagingLoadTimerRef.current) {
                clearTimeout(suppressPagingLoadTimerRef.current);
                suppressPagingLoadTimerRef.current = null;
            }
            if (jumpPagingLockTimerRef.current) {
                clearTimeout(jumpPagingLockTimerRef.current);
                jumpPagingLockTimerRef.current = null;
            }
            if (olderMessagesAbortRef.current) {
                olderMessagesAbortRef.current.abort();
                olderMessagesAbortRef.current = null;
            }
            jumpPagingLockRef.current = false;

            // Cleanup markAsRead debounce timer
            if (markAsReadTimeoutRef.current) {
                clearTimeout(markAsReadTimeoutRef.current);
                markAsReadTimeoutRef.current = null;
            }

            // Cleanup typing signal timer
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }

            // Cleanup all typing user timeouts
            typingTimeoutsRef.current.forEach((timeoutId) =>
                clearTimeout(timeoutId),
            );
            typingTimeoutsRef.current.clear();
            readReceiptCatchupTimeoutsRef.current.forEach((timeoutId) =>
                clearTimeout(timeoutId),
            );
            readReceiptCatchupTimeoutsRef.current = [];

            // Cleanup recording: dừng MediaRecorder nếu đang ghi, tránh leak stream
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.onstop = null; // Tắt callback để không upload
                mediaRecorderRef.current.stop(); // Dừng recording
                mediaRecorderRef.current = null;
            }

            // Cleanup timer: dừng interval đếm giây ghi âm
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        };
    }, [
        conversationId,
        userId,
        handleNewMessage,
        handleMessageRecalled,
        handleMessageSeen,
        handleTyping,
        handleMessageReactionEvent,
        handlePollUpdatedEvent,
        loadInitialData,
        markAsRead,
        syncConversationData,
    ]);

    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const previousScrollTop = lastScrollTopRef.current;
        const currentScrollTop = container.scrollTop;
        const isScrollingUp = currentScrollTop < previousScrollTop;
        const isScrollingDown = currentScrollTop > previousScrollTop;
        lastScrollTopRef.current = currentScrollTop;

        if ((isScrollingUp || isScrollingDown) && jumpPagingLockRef.current) {
            jumpPagingLockRef.current = false;
            if (jumpPagingLockTimerRef.current) {
                clearTimeout(jumpPagingLockTimerRef.current);
                jumpPagingLockTimerRef.current = null;
            }
        }

        if (isScrollingDown) {
            resetMediaLoadStabilizer();
        }

        // Ngay khi user scroll LÊN → thoát khỏi giai đoạn initial load
        // Đây là cách phát hiện user chủ động muốn xem tin cũ
        if (isScrollingUp && initialLoadRef.current) {
            initialLoadRef.current = false;
        }

        const nearBottom = isNearBottom();

        if (!nearBottom) {
            setShowScrollToBottomButton(true);
        } else {
            setShowScrollToBottomButton(false);
            setPendingNewMessages(0);

            // Khi user scroll xuống gần cuối và có typing indicator đang hiện
            // → scroll xuống cuối để hiện typing indicator
            // Chỉ scroll nếu chưa ở vị trí cuối tuyệt đối (tránh loop)
            if (typingUsers.size > 0) {
                const distanceFromBottom =
                    container.scrollHeight -
                    container.scrollTop -
                    container.clientHeight;
                if (distanceFromBottom > 5) {
                    requestAnimationFrame(() => {
                        scrollToBottom("smooth");
                    });
                }
            }
        }

        if (
            !jumpPagingLockRef.current &&
            !suppressPagingLoadRef.current &&
            isScrollingUp &&
            container.scrollTop < LOAD_MORE_TRIGGER_PX &&
            hasMoreOlder &&
            !loadingMore
        ) {
            // Chạm gần top => load trang tin nhắn cũ.
            void loadOlderMessages();
        }

        const distanceFromBottom =
            container.scrollHeight -
            container.scrollTop -
            container.clientHeight;
        if (
            distanceFromBottom < LOAD_MORE_TRIGGER_PX &&
            isHistoricalMode &&
            hasMoreNewer &&
            !loadingMore
        ) {
            void loadNewerMessages();
        }
    }, [
        hasMoreNewer,
        hasMoreOlder,
        isHistoricalMode,
        isNearBottom,
        loadNewerMessages,
        loadOlderMessages,
        loadingMore,
        resetMediaLoadStabilizer,
        scrollToBottom,
        typingUsers.size,
    ]);

    const handleScrollToBottomClick = useCallback(() => {
        if (isHistoricalMode) {
            returningToPresentRef.current = true;
            resetMediaLoadStabilizer();
            pendingOlderPrefetchAfterJumpRef.current = false;
            if (olderMessagesAbortRef.current) {
                olderMessagesAbortRef.current.abort();
                olderMessagesAbortRef.current = null;
            }
            loadMoreRequestedRef.current = false;
            armForceAutoScroll();
            setMessages([]);
            chatRuntimeStore.setMessages(conversationId, []);
            setPendingNewMessages(0);
            setIsHistoricalMode(false);
            setHasMoreOlder(false);
            setHasMoreNewer(false);
            setOlderCursor(null);
            setLoadingMore(false);
            setShowScrollToBottomButton(false);
            skipAutoFillOnceRef.current = true;
            suppressPagingLoadRef.current = false;
            jumpPagingLockRef.current = false;
            if (suppressPagingLoadTimerRef.current) {
                clearTimeout(suppressPagingLoadTimerRef.current);
                suppressPagingLoadTimerRef.current = null;
            }
            if (jumpPagingLockTimerRef.current) {
                clearTimeout(jumpPagingLockTimerRef.current);
                jumpPagingLockTimerRef.current = null;
            }
            void loadInitialData(loadTokenRef.current, markAsRead).then(() => {
                scrollOnNextRenderRef.current = "auto";
            });
            return;
        }

        resetMediaLoadStabilizer();
        pendingOlderPrefetchAfterJumpRef.current = false;
        scrollToBottom("auto");
        setShowScrollToBottomButton(false);
        setPendingNewMessages(0);
    }, [
        armForceAutoScroll,
        conversationId,
        isHistoricalMode,
        loadInitialData,
        markAsRead,
        resetMediaLoadStabilizer,
        scrollToBottom,
    ]);

    const replaceLocalMessage = useCallback(
        (clientMessageId: string, message: Message) => {
            setMessages((prev) => {
                const nextMessages = prev.map((item) =>
                    item.clientMessageId === clientMessageId
                        ? { ...message, deliveryStatus: "sent" as const }
                        : item,
                );
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
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
                const nextMessages = prev.map((item) =>
                    item.clientMessageId === clientMessageId ||
                    item.clientMessageId?.startsWith(`${clientMessageId}-`)
                        ? { ...item, deliveryStatus }
                        : item,
                );
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
            });
        },
        [conversationId],
    );

    const appendCreatedMessagesFromOutbox = useCallback(
        (clientMessageId: string, createdMessages: Message[]) => {
            if (createdMessages.length === 0) return;
            setMessages((prev) => {
                let replaced = false;
                const createdByClientId = new Map(
                    createdMessages
                        .filter((message) => message.clientMessageId)
                        .map((message) => [message.clientMessageId!, message]),
                );
                const nextMessages = prev.map((item) => {
                    if (!item.clientMessageId) return item;
                    const created = createdByClientId.get(item.clientMessageId);
                    if (created) {
                        replaced = true;
                        return {
                            ...created,
                            deliveryStatus: "sent" as const,
                        };
                    }
                    if (item.clientMessageId === clientMessageId) {
                        replaced = true;
                        return {
                            ...createdMessages[0],
                            deliveryStatus: "sent" as const,
                        };
                    }
                    return item;
                });
                const existingIds = new Set(nextMessages.map((item) => item.id));
                const existingClientIds = new Set(
                    nextMessages
                        .map((item) => item.clientMessageId)
                        .filter(Boolean),
                );
                const rest = createdMessages
                    .slice(replaced ? 1 : 0)
                    .filter(
                        (message) =>
                            !existingIds.has(message.id) &&
                            (!message.clientMessageId ||
                                !existingClientIds.has(message.clientMessageId)),
                    )
                    .map((message) => ({
                        ...message,
                        deliveryStatus: "sent" as const,
                    }));
                const merged = applyWindowForNewer(
                    dedupeMessagesByIdentity([...nextMessages, ...rest]),
                );
                chatRuntimeStore.setMessages(conversationId, merged);
                return merged;
            });
        },
        [applyWindowForNewer, conversationId],
    );

    const uploadAndSendOutboxMedia = useCallback(
        async (item: OutboxMessage): Promise<Message[]> => {
            const mediaFiles = item.mediaFiles ?? [];
            if (mediaFiles.length === 0) {
                const createdMessage = await chatService.sendMessage(
                    item.request,
                    item.userId,
                );
                return [createdMessage];
            }

            const files = mediaFiles.map((mediaFile) => mediaFile.file);
            const presignedPayload: BulkPresignedRequest = {
                module: "CONVERSATION",
                targetId: String(item.conversationId),
                files: files.map((file) => ({
                    type: toAttachmentCategory(file),
                    fileName: file.name,
                    contentType: file.type || "application/octet-stream",
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
                            file.name,
                            file.type || "application/octet-stream",
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
            const toAttachment = (itemFile: (typeof uploaded)[number]) => ({
                url: itemFile.objectKey,
                type: itemFile.file.type || "application/octet-stream",
                fileName: itemFile.file.name,
                fileSize: itemFile.file.size,
            });
            const imageAttachments = uploaded
                .filter((itemFile) => isImageFile(itemFile.file))
                .map(toAttachment);
            const audioAttachments = uploaded
                .filter((itemFile) => isAudioUploadFile(itemFile.file))
                .map(toAttachment);
            const videoAttachments = uploaded
                .filter((itemFile) => isVideoUploadFile(itemFile.file))
                .map(toAttachment);
            const fileAttachments = uploaded
                .filter(
                    (itemFile) =>
                        !isImageFile(itemFile.file) &&
                        !isAudioUploadFile(itemFile.file) &&
                        !isVideoUploadFile(itemFile.file),
                )
                .map(toAttachment);

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
            if (sendingOutboxIdsRef.current.has(item.clientMessageId)) {
                return;
            }
            sendingOutboxIdsRef.current.add(item.clientMessageId);
            scrollOnNextRenderRef.current = "smooth";
            try {
                await messageOutbox.updateStatus(item.clientMessageId, "sending");
                setLocalMessageDeliveryStatus(item.clientMessageId, "sending");
                const createdMessages = await uploadAndSendOutboxMedia(item);
                scrollOnNextRenderRef.current = "smooth";
                if (item.mediaFiles?.length) {
                    appendCreatedMessagesFromOutbox(
                        item.clientMessageId,
                        createdMessages,
                    );
                } else {
                    replaceLocalMessage(item.clientMessageId, createdMessages[0]);
                }
                await messageOutbox.remove(item.clientMessageId);
                setError(null);
                scheduleReadReceiptCatchup();
            } catch (error) {
                if (isLikelyNetworkSendError(error)) {
                    scrollOnNextRenderRef.current = "smooth";
                    setLocalMessageDeliveryStatus(item.clientMessageId, "sending");
                    await messageOutbox.updateStatus(item.clientMessageId, "pending");
                } else {
                    scrollOnNextRenderRef.current = "smooth";
                    setLocalMessageDeliveryStatus(item.clientMessageId, "failed");
                    await messageOutbox.updateStatus(item.clientMessageId, "failed");
                }
                throw new Error("SEND_OUTBOX_FAILED");
            } finally {
                sendingOutboxIdsRef.current.delete(item.clientMessageId);
            }
        },
        [
            appendCreatedMessagesFromOutbox,
            replaceLocalMessage,
            scheduleReadReceiptCatchup,
            setLocalMessageDeliveryStatus,
            uploadAndSendOutboxMedia,
        ],
    );

    useEffect(() => {
        let disposed = false;

        void messageOutbox.listByConversation(conversationId).then((items) => {
            if (disposed || items.length === 0) return;
            setMessages((prev) => {
                const missing = items
                    .flatMap((item) => {
                        const mediaFiles =
                            item.mediaFiles?.map((mediaFile) => mediaFile.file) ??
                            [];
                        return buildMixedMediaOptimisticMessages(
                            mediaFiles,
                            item.conversationId,
                            item.userId,
                            item.clientMessageId,
                            item.textContent,
                            item.replyToId,
                        ).map((message) => ({
                            ...message,
                            deliveryStatus:
                                item.status === "failed"
                                    ? ("failed" as const)
                                    : ("sending" as const),
                        }));
                    })
                    .filter(
                        (message) =>
                            !prev.some(
                                (existing) =>
                                    existing.clientMessageId ===
                                    message.clientMessageId,
                            ),
                    );
                if (missing.length === 0) return prev;
                const nextMessages = applyWindowForNewer([...prev, ...missing]);
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
            });
        }).catch(() => undefined);

        return () => {
            disposed = true;
        };
    }, [applyWindowForNewer, conversationId]);

    useEffect(() => {
        let flushing = false;

        const flush = async () => {
            if (flushing) return;
            flushing = true;
            try {
                const items = await messageOutbox.listPending();
                for (const item of items) {
                    await sendOutboxItem(item).catch(() => undefined);
                }
            } finally {
                flushing = false;
            }
        };

        void flush();
        const intervalId = window.setInterval(flush, OUTBOX_RETRY_INTERVAL_MS);
        window.addEventListener("online", flush);
        document.addEventListener("visibilitychange", flush);
        window.addEventListener("focus", flush);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("online", flush);
            document.removeEventListener("visibilitychange", flush);
            window.removeEventListener("focus", flush);
        };
    }, [sendOutboxItem]);

    const handleSend = useCallback(
        async (textOverride?: string, replyToId?: string) => {
            if (readOnlyNotice) {
                setError((prev) => prev ?? "Bạn không thể gửi tin nhắn");
                return;
            }

            const trimmed = (textOverride ?? messageText).trim();
            if (!trimmed) return;

            try {
                setSending(true);
                setError(null);

                const textParts = splitLongTextMessage(trimmed);
                const baseClientMessageId = createClientMessageId();
                const baseCreatedAt = Date.now();
                const outboxItems = textParts.map((content, partIndex) => {
                    const clientMessageId =
                        textParts.length === 1
                            ? baseClientMessageId
                            : `${baseClientMessageId}-part-${partIndex}`;
                    const request: SendMessageRequest = {
                        content,
                        type: "TEXT",
                        conversationId,
                        clientMessageId,
                    };
                    if (replyToId && partIndex === 0) {
                        // Backend hiện nhận reply theo trường replyToId.
                        // Chỉ part đầu giữ reply preview để chuỗi text dài không bị lặp khung reply.
                        request.replyToId = replyToId;
                    }

                    const createdAt = new Date(
                        baseCreatedAt + partIndex,
                    ).toISOString();
                    const optimisticMessage = buildOptimisticTextMessage(
                        request,
                        userId,
                        clientMessageId,
                        createdAt,
                    );
                    return {
                        clientMessageId,
                        conversationId,
                        userId,
                        request,
                        preview: optimisticMessage,
                        status: "pending" as const,
                        retryCount: 0,
                        createdAt: optimisticMessage.createdAt,
                        updatedAt: optimisticMessage.createdAt,
                    };
                });

                scrollOnNextRenderRef.current = "smooth";
                setMessages((prev) => {
                    const nextMessages = applyWindowForNewer([
                        ...prev,
                        ...outboxItems.map((item) => item.preview),
                    ]);
                    chatRuntimeStore.setMessages(conversationId, nextMessages);
                    return nextMessages;
                });

                for (const outboxItem of outboxItems) {
                    await messageOutbox.save(outboxItem);
                }
                setMessageText("");
                // Sau khi send, thường server sẽ broadcast lại qua WS; dù vậy ta vẫn chủ động scroll.
                scrollOnNextRenderRef.current = "smooth";
                for (const outboxItem of outboxItems) {
                    await sendOutboxItem(outboxItem).catch(() => undefined);
                }
            } catch {
                setError("Không thể gửi tin nhắn");
            } finally {
                setSending(false);
            }
        },
        [
            applyWindowForNewer,
            conversationId,
            messageText,
            readOnlyNotice,
            sendOutboxItem,
            userId,
        ],
    );

    const refreshPinnedMessages = useCallback(async () => {
        const response = await chatService.getConversation(
            conversationId,
            userId,
        );
        const responseData = response.data;
        if (!response.success || !responseData) return;

        const nextPins = Array.isArray(responseData.pinnedMessages)
            ? responseData.pinnedMessages
            : [];

        chatRuntimeStore.setPins(conversationId, nextPins);
        setPinnedMessages(nextPins);
        setConversation((prev) => {
            const nextConversation = {
                ...(prev ?? responseData),
                pinnedMessages: nextPins,
            };
            chatRuntimeStore.setConversation(conversationId, nextConversation);
            return nextConversation;
        });
    }, [conversationId, userId]);

    const handlePinMessage = useCallback(
        async (messageId: string) => {
            try {
                // Kiểm tra: nếu đã có 3 tin ghim rồi, báo cho user
                // (backend sẽ tự động bỏ ghim tin cũ nhất, nhưng frontend cũng nên kiểm tra)

                await chatService.pinMessage(messageId, userId);
                await refreshPinnedMessages();
            } catch (error) {
                const errorMsg =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message || "Không thể ghim tin nhắn";
                setRecallToast(errorMsg);
            }
        },
        [refreshPinnedMessages, userId],
    );

    const handleUnpinMessage = useCallback(
        async (messageId: string) => {
            try {
                await chatService.unpinMessage(messageId, userId);
                await refreshPinnedMessages();
            } catch (error) {
                const errorMsg =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ||
                    "Không thể bỏ ghim tin nhắn";
                setRecallToast(errorMsg);
            }
        },
        [refreshPinnedMessages, userId],
    );

    const addReaction = useCallback(
        async (messageId: string, emoji: string) => {
            let previousMessages: Message[] = [];

            setMessages((prev) => {
                previousMessages = prev;
                const nextMessages = prev.map((message) =>
                    message.id === messageId
                        ? incrementMessageReaction(message, emoji, userId)
                        : message,
                );
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
            });

            try {
                const updatedMessage = await chatService.addReaction(
                    messageId,
                    emoji,
                );
                setMessages((prev) => {
                    const nextMessages = prev.map((message) =>
                        message.id === messageId ? updatedMessage : message,
                    );
                    chatRuntimeStore.setMessages(conversationId, nextMessages);
                    return nextMessages;
                });
            } catch {
                setMessages(previousMessages);
                chatRuntimeStore.setMessages(conversationId, previousMessages);
                setError("Không thể thả reaction");
            }
        },
        [conversationId, userId],
    );

    // Upload file/image/video/audio: presign → S3 PUT → sendMessage với objectKey
    const handleFileUpload = useCallback(
        async (file: File) => {
            if (readOnlyNotice) {
                setError((prev) => prev ?? "Bạn không thể gửi tin nhắn");
                return;
            }

            // Tự động xác định loại từ MIME type của file
            let type: MessageType;
            if (file.type.startsWith("image/")) type = "IMAGE";
            else if (file.type.startsWith("video/")) type = "VIDEO";
            else if (file.type.startsWith("audio/")) type = "AUDIO";
            else type = "FILE";

            setUploading(true);
            setUploadProgressPercent(0);
            setUploadProgressLabel("Đang tải tệp 1/1");
            setUploadFileProgressMap({ [getFileClientKey(file)]: 0 });
            setUploadFailedFileNames([]);
            try {
                // Bước 1: Xin presigned URL
                const { presignedUrl, objectKey } =
                    await chatService.getPresignedUrl(
                        "CONVERSATION",
                        String(conversationId), // Convert number sang string
                        type,
                        file.name,
                        file.type,
                    );
                // Bước 2: Upload thẳng lên S3
                await chatService.uploadToS3(
                    presignedUrl,
                    file,
                    (loaded, total) => {
                        const safeTotal = total > 0 ? total : file.size || 1;
                        const percent = Math.min(
                            99,
                            Math.round((loaded / safeTotal) * 100),
                        );
                        setUploadProgressPercent(percent);
                        setUploadFileProgressMap({
                            [getFileClientKey(file)]: percent,
                        });
                    },
                );
                const attachment = {
                    url: objectKey,
                    type: file.type || "application/octet-stream",
                    fileName: file.name,
                    fileSize: file.size,
                };

                // Bước 3: Gửi tin nhắn với attachments (thống nhất với FILE/IMAGE/AUDIO)
                const request: SendMessageRequest = {
                    content: "",
                    type,
                    conversationId,
                    attachments: [attachment],
                };
                await chatService.sendMessage(request, userId);
                setUploadProgressPercent(100);
                setUploadFileProgressMap({ [getFileClientKey(file)]: 100 });
                scrollOnNextRenderRef.current = "smooth";
            } catch (err) {
                const axiosMsg = (
                    err as { response?: { data?: { message?: string } } }
                )?.response?.data?.message;
                setRecallToast(
                    axiosMsg ?? "Không thể gửi file. Vui lòng thử lại.",
                );
            } finally {
                setUploading(false);
                setUploadProgressPercent(null);
                setUploadProgressLabel("");
                setUploadFileProgressMap({});
            }
        },
        [conversationId, readOnlyNotice, userId],
    );

    const handleSendMixedMedia = useCallback(
        async (files: File[], textOverride?: string, replyToId?: string) => {
            if (readOnlyNotice) {
                setError((prev) => prev ?? "Bạn không thể gửi tin nhắn");
                return false;
            }

            if (files.length === 0) return false;

            const validationError = getValidationErrorForFiles(files);
            if (validationError) {
                setRecallToast(validationError);
                return false;
            }

            const trimmed = (textOverride ?? messageText).trim();

            try {
                const clientMessageId = createClientMessageId("web-media");
                const optimisticMessages = buildMixedMediaOptimisticMessages(
                    files,
                    conversationId,
                    userId,
                    clientMessageId,
                    trimmed,
                    replyToId,
                );
                const optimisticMessage = optimisticMessages[0];
                if (!optimisticMessage) return false;
                const outboxItem: OutboxMessage = {
                    clientMessageId,
                    conversationId,
                    userId,
                    request: {
                        content: "",
                        type: optimisticMessage.type,
                        conversationId,
                        clientMessageId,
                        ...(replyToId ? { replyToId } : {}),
                    },
                    preview: optimisticMessage,
                    mediaFiles: files.map((file) => ({
                        file,
                        fileName: file.name,
                        mimeType: file.type || "application/octet-stream",
                        fileSize: file.size,
                    })),
                    textContent: trimmed,
                    replyToId,
                    status: "pending",
                    retryCount: 0,
                    createdAt: optimisticMessage.createdAt,
                    updatedAt: optimisticMessage.createdAt,
                };

                setMessages((prev) => {
                    const nextMessages = applyWindowForNewer([
                        ...prev,
                        ...optimisticMessages,
                    ]);
                    chatRuntimeStore.setMessages(conversationId, nextMessages);
                    return nextMessages;
                });
                await messageOutbox.save(outboxItem);
                setMessageText("");
                scrollOnNextRenderRef.current = shouldForceAutoScroll()
                    ? "auto"
                    : "smooth";
                void sendOutboxItem(outboxItem).catch(() => undefined);
                return true;
            } catch (error) {
                if (isLikelyNetworkSendError(error)) {
                    setError("Tệp sẽ được gửi lại khi có mạng");
                } else {
                    setError("Không thể lưu tệp để gửi lại");
                }
                return false;
            }

        },
        [
            applyWindowForNewer,
            conversationId,
            messageText,
            readOnlyNotice,
            sendOutboxItem,
            setMessageText,
            shouldForceAutoScroll,
            userId,
        ],
    );

    /**
     * startRecording - Bắt đầu ghi âm tin nhắn thoại
     *
     * Flow:
     * 1. Yêu cầu quyền microphone qua getUserMedia
     * 2. Chọn MIME type audio tốt nhất (ưu tiên: webm+opus → webm → mp4)
     * 3. Tạo MediaRecorder instance, reset audioChunksRef
     * 4. Đăng ký ondataavailable: đẩy Blob vào audioChunksRef
     * 5. Đăng ký onstop: ghép Blob thành File, gọi handleFileUpload (presign → S3 → sendMessage)
     * 6. Start recording + bật timer đếm giây
     * 7. Nếu lỗi microphone → hiện toast cảnh báo
     */
    const startRecording = useCallback(async () => {
        if (readOnlyNotice) {
            setError((prev) => prev ?? "Bạn không thể gửi tin nhắn");
            return;
        }

        if (isRecording) return; // Đang ghi rồi thì bỏ qua
        try {
            // Bước 1: Yêu cầu quyền truy cập microphone
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            // Bước 2: Ưu tiên audio/mp4 để tương thích tốt hơn với mobile,
            // fallback sang webm khi browser không hỗ trợ mp4.
            const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
                ? "audio/mp4"
                : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                  ? "audio/webm;codecs=opus"
                  : "audio/webm";

            // Bước 3: Tạo MediaRecorder và reset mảng chunks
            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            // Bước 4: Đăng ký callback ondataavailable - nhận dữ liệu audio từng đoạn
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            // Bước 5: Đăng ký callback onstop - khi dừng ghi, ghép Blob → File → upload
            recorder.onstop = async () => {
                // Tắt stream (tắt đèn mic trên browser)
                stream.getTracks().forEach((t) => t.stop());

                // Ghép tất cả chunks thành 1 Blob
                const blob = new Blob(audioChunksRef.current, {
                    type: mimeType,
                });
                if (blob.size === 0) return; // Không có dữ liệu thì bỏ qua

                // Chuyển Blob thành File object với tên file và extension phù hợp
                const ext = mimeType.includes("webm") ? "webm" : "m4a";
                const file = new File([blob], `voice-message.${ext}`, {
                    type: mimeType,
                });

                // Upload file lên S3 và gửi tin nhắn qua WebSocket
                await handleFileUpload(file);
            };

            // Bước 6: Lưu ref, start recording, bật UI + timer
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration((d) => d + 1);
            }, 1000);
        } catch {
            // Bước 7: Báo lỗi nếu không truy cập được microphone (user từ chối hoặc thiết bị không có mic)
            setRecallToast("Không thể truy cập microphone");
        }
    }, [isRecording, handleFileUpload, readOnlyNotice]);

    /**
     * stopRecording - Dừng ghi âm và GỬI tin nhắn
     *
     * Khi user bấm nút "Dừng & Gửi":
     * 1. Dừng timer đếm giây
     * 2. Gọi recorder.stop() → trigger callback onstop (đã đăng ký trong startRecording)
     *    → onstop sẽ tự động ghép Blob, tạo File, upload → gửi tin nhắn
     * 3. Reset state UI về trạng thái không ghi
     */
    const stopRecording = useCallback(() => {
        if (!mediaRecorderRef.current) return; // Chưa ghi thì bỏ qua

        // Dừng timer
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        // Dừng recorder → trigger onstop → upload + send
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;

        // Reset UI
        setIsRecording(false);
        setRecordingDuration(0);
    }, []);

    /**
     * cancelRecording - Huỷ ghi âm KHÔNG gửi tin nhắn
     *
     * Khi user bấm nút "Huỷ" (X):
     * 1. Tắt callback onstop để KHÔNG upload/send
     * 2. Xoá dữ liệu audio đã ghi (audioChunksRef)
     * 3. Dừng recorder + timer
     * 4. Reset UI về trạng thái không ghi
     *
     * Khác với stopRecording: cancel sẽ xoá audio, stop sẽ gửi audio.
     */
    const cancelRecording = useCallback(() => {
        if (!mediaRecorderRef.current) return; // Chưa ghi thì bỏ qua

        // Dừng timer
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        // Tắt callback onstop để KHÔNG upload khi stop
        mediaRecorderRef.current.onstop = null;

        // Xoá dữ liệu audio đã ghi
        audioChunksRef.current = [];

        // Dừng recorder
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;

        // Reset UI
        setIsRecording(false);
        setRecordingDuration(0);
    }, []);

    const displayInfo = useMemo(() => {
        if (!conversation) {
            return {
                displayName: "",
                displayAvatar: null as string | null,
                displayCompositeAvatars: [] as string[],
            };
        }
        // Memo hoá để tránh tính lại tên/avatar mỗi render không cần thiết.
        return getConversationDisplayInfo(conversation, userId, membersById);
    }, [conversation, membersById, userId]);

    // ====== Effect đồng bộ trạng thái Read Only (Dành cho Group Kick/Leave) ======
    useEffect(() => {
        const prevForced = prevForcedNoticeRef.current;
        prevForcedNoticeRef.current = forcedReadOnlyNotice;

        console.log(
            "[DEBUG_READD] useChatWindowController forced notice effect:",
            {
                prevForced,
                forcedReadOnlyNotice,
                localReadOnlyNotice,
                conversationId,
            },
        );

        if (!forcedReadOnlyNotice) {
            // Chỉ mở khóa nếu prop thực sự vừa thay đổi từ 'có thông báo' sang 'không có'
            if (prevForced && !forcedReadOnlyNotice) {
                console.log(
                    "🔓 Unlocking chat because forced notice was cleared",
                );
                setReadOnlyNotice(null);
                setError(null);
                setMessages([]);
                setConversation(null);
                setMembersById({});
                setLoading(true);

                loadTokenRef.current += 1;
                const token = loadTokenRef.current;
                void loadInitialData(token, markAsRead);
            }
            return;
        }

        console.log(
            "🔒 Locking chat due to forced notice:",
            forcedReadOnlyNotice,
        );
    }, [forcedReadOnlyNotice, loadInitialData, markAsRead]);

    return {
        conversation,
        membersById,
        messages,
        pinnedMessages,
        loading,
        loadingMore,
        hasMoreOlder,
        hasMoreNewer,
        isHistoricalMode,
        sending,
        uploading,
        uploadProgressPercent,
        uploadProgressLabel,
        uploadFileProgressMap,
        uploadFailedFileNames,
        error,
        readOnlyNotice,

        // userId được expose để component dùng lại (lấy từ useAuth() bên trong hook)
        userId,

        displayName: displayInfo.displayName,
        displayAvatar: displayInfo.displayAvatar,
        displayCompositeAvatars: displayInfo.displayCompositeAvatars,

        messageText,
        setMessageText,

        messagesEndRef,
        messagesContainerRef,

        showScrollToBottomButton,
        pendingNewMessages,

        loadOlderMessages,
        loadNewerMessages,
        handleJumpToMessage,
        handleScroll,
        handleScrollToBottomClick,
        handleSend,
        handlePinMessage,
        handleUnpinMessage,
        addReaction,
        handleRecall,
        canRecallOwnMessages,
        handleDeleteMessageForMe,
        handleDeleteConversationForMe,
        handleFileUpload,
        handleSendMixedMedia,
        appendRealtimeMessage: handleNewMessage,
        scrollToBottom,
        recallToast,
        jumpToast,

        // === Voice recording state & actions (Ghi âm tin nhắn thoại) ===
        isRecording, // true nếu đang ghi âm
        recordingDuration, // Thời lượng ghi âm (giây)
        startRecording, // Bắt đầu ghi âm
        stopRecording, // Dừng ghi âm và GỬI tin nhắn
        cancelRecording, // Huỷ ghi âm KHÔNG gửi

        defaultAvatarUrl: DEFAULT_AVATAR_URL,
        defaultAvatarSmallUrl: DEFAULT_AVATAR_SMALL_URL,

        // Hàm kiểm tra user có đang ở gần cuối container không (dùng cho onMediaLoad)
        isNearBottom,

        // Hàm kiểm tra đang trong giai đoạn initial load (F5/mở chat)
        // Trong giai đoạn này, luôn scroll xuống cuối khi media load
        isInitialLoad: () => initialLoadRef.current,

        // Hàm kiểm tra có cần scroll khi media load xong không
        // Set true khi nhận tin nhắn mới (của mình hoặc khi đang ở cuối) với type IMAGE/VIDEO
        // Reset sau 3s hoặc khi đổi conversation
        shouldScrollOnMediaLoad: () => shouldScrollOnMediaLoadRef.current,
        shouldForceAutoScroll,

        // Ổn định viewport khi media load trễ trong chế độ historical.
        stabilizeMediaLayoutOnMediaLoad,

        // === Read Receipt (Đánh dấu đã đọc) ===
        // readReceipts: danh sách thông tin "đã xem" của các members (trừ user hiện tại)
        // Mỗi phần tử: { userId, lastMessageId, seenAt }
        // FE dùng để hiển thị avatar "đã xem" bên dưới tin nhắn làm mốc
        readReceipts,

        // === Typing Indicator (Đang soạn tin nhắn) ===
        // typingUsers: Set<userId> - Danh sách user đang gõ tin nhắn (trừ user hiện tại)
        // FE dùng để hiển thị "dummy message bubble" nhấp nháy
        typingUsers,
        sendTypingSignal,
    };
}
