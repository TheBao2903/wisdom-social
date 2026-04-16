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
    type SendMessageRequest,
} from "../services/chatService";
import websocketService, {
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

/**
 * Các hằng số điều khiển UX & paging.
 * - PAGE_SIZE: số tin nhắn mỗi lần tải.
 * - NEAR_BOTTOM_THRESHOLD_PX: ngưỡng để coi user đang "gần cuối" (phục vụ auto-scroll).
 * - LOAD_MORE_TRIGGER_PX: khi scrollTop < ngưỡng => tải thêm tin nhắn cũ.
 * - SCROLLABLE_EPSILON_PX: sai số nhỏ để kiểm tra container có thật sự scroll được.
 */
const PAGE_SIZE = 20;
const NEAR_BOTTOM_THRESHOLD_PX = 200;
const LOAD_MORE_TRIGGER_PX = 100;
const SCROLLABLE_EPSILON_PX = 2;
const MARK_AS_READ_DEBOUNCE_MS = 1000; // Debounce 1 giây cho API markAsRead
const MESSAGE_WINDOW_LIMIT = 200;
const MESSAGE_TRIM_BATCH = 20;
const MAX_FILES_PER_SEND = 50;
const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const RECALLED_REPLY_TEXT = "Tin nhắn đã được thu hồi";

type LoadOlderOptions = { keepAtBottom?: boolean };
type VisibleAnchorSnapshot = { messageId: string; topOffset: number };

/**
 * Interface cho read receipt - lưu thông tin "đã xem" của mỗi user
 */
export interface ReadReceipt {
    userId: number;
    lastMessageId: string;
    seenAt: string;
}

function getConversationDisplayInfo(
    conversation: Conversation,
    userId: number,
    membersById: MembersByUserId,
) {
    const otherMemberFromStore = Object.values(membersById).find(
        (m) => m.userId !== userId,
    );

    const displayName =
        conversation.type === "GROUP"
            ? conversation.name
            : otherMemberFromStore?.nickname ||
              conversation.members?.find((m) => m.userId !== userId)
                  ?.nickname ||
              "Unknown";

    const displayAvatar =
        conversation.type === "GROUP"
            ? conversation.imageUrl
            : otherMemberFromStore?.avatar ||
              conversation.members?.find((m) => m.userId !== userId)?.avatar;

    return { displayName, displayAvatar };
}

function toMembersByUserId(
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
            normalized[member.userId] = member;
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

function isImageFile(file: File): boolean {
    return file.type.startsWith("image/");
}

function toAttachmentCategory(file: File): "IMAGE" | "FILE" {
    return isImageFile(file) ? "IMAGE" : "FILE";
}

function getValidationErrorForFiles(files: File[]): string | null {
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

function getFileClientKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
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
    userId: number;
    onMarkAsRead?: (conversationId: number) => void; // Callback để clear unreadCount ở sidebar
}) {
    const { conversationId, userId, onMarkAsRead } = args;

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
    const recallToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
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
            if (behavior === "auto") {
                setTimeout(() => scrollToBottom("auto"), 50);
            }
        });
    }, [loadingMore, messages.length, scrollToBottom]);

    const loadInitialData = useCallback(
        async (
            token: number,
            markAsReadFn?: (lastMessageId: string) => void,
        ) => {
            try {
                setError(null);

                const [convResponse, membersResponse, messagesResponse] =
                    await Promise.all([
                        chatService.getConversation(conversationId, userId),
                        chatService.getConversationMembers(conversationId),
                        chatService.getMessages(
                            conversationId,
                            userId,
                            null,
                            PAGE_SIZE,
                        ),
                    ]);

                if (token !== loadTokenRef.current) return;

                if (!convResponse.success || !convResponse.data) {
                    setConversation(null);
                    setError(
                        convResponse.message || "Không thể tải cuộc trò chuyện",
                    );
                    return;
                }

                const cursorData = messagesResponse?.success
                    ? messagesResponse.data
                    : null;
                const list = Array.isArray(cursorData?.data)
                    ? normalizeMessagesForUi(cursorData.data)
                    : [];

                const membersFromApi = toMembersByUserId(membersResponse);
                const sideLoadedRefs = cursorData?.referenceUsers ?? {};
                const mergedMembers = mergeReferenceUsers(
                    membersFromApi,
                    sideLoadedRefs,
                );

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
                    .filter((m) => m.userId !== userId && m.lastReadMessageId)
                    .map((m) => ({
                        userId: m.userId,
                        lastMessageId: m.lastReadMessageId!,
                        seenAt: new Date().toISOString(),
                    }));

                setReadReceipts(initialReceipts);
                scrollOnNextRenderRef.current = "auto";

                const lastMessage = list.at(-1);
                if (lastMessage && markAsReadFn) {
                    markAsReadFn(lastMessage.id);
                }
            } catch {
                if (token !== loadTokenRef.current) return;
                setMessages([]);
                setConversation(null);
                setMembersById({});
                setError("Không thể tải dữ liệu cuộc trò chuyện");
            } finally {
                if (token === loadTokenRef.current) {
                    returningToPresentRef.current = false;
                    setLoading(false);
                }
            }
        },
        [conversationId, mergeReferenceUsers, userId],
    );

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
                setError("Không thể nhảy tới tin nhắn");
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
        [conversationId, mergeReferenceUsers, resetMediaLoadStabilizer, userId],
    );

    const handleJumpToMessage = useCallback(
        async (targetMessageId: string): Promise<boolean> => {
            const existed = messages.some(
                (message) => message.id === targetMessageId,
            );
            if (existed) return true;
            return jumpToMessage(targetMessageId);
        },
        [jumpToMessage, messages],
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
            const isMyMessage =
                Number(normalizedIncoming.senderId) ===
                Number(userIdRef.current);
            const currentlyNearBottom = isNearBottom();

            if (isHistoricalModeRef.current) {
                setShowScrollToBottomButton(true);
                setPendingNewMessages((count) => count + 1);
                return;
            }

            setMessages((prev) => {
                if (prev.some((m) => m.id === normalizedIncoming.id)) {
                    return prev;
                }
                const nextMessages = applyWindowForNewer([
                    ...prev,
                    normalizedIncoming,
                ]);
                chatRuntimeStore.setMessages(conversationId, nextMessages);
                return nextMessages;
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
        [applyWindowForNewer, conversationId, isNearBottom],
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
        [messages, userId],
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

        if (cachedMembers[userId]) {
            const cachedReceipts: ReadReceipt[] = Object.values(cachedMembers)
                .filter((m) => m.userId !== userId && m.lastReadMessageId)
                .map((m) => ({
                    userId: m.userId,
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
                );
                websocketService.subscribeToConversationMembers(
                    conversationId,
                    handleMemberUpdated,
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
        loadInitialData,
        markAsRead,
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

    const handleSend = useCallback(
        async (textOverride?: string, replyToId?: string) => {
            const trimmed = (textOverride ?? messageText).trim();
            if (!trimmed) return;

            try {
                setSending(true);
                setError(null);

                const request: SendMessageRequest = {
                    content: trimmed,
                    type: "TEXT",
                    conversationId,
                };
                if (replyToId) {
                    // Backend hiện nhận reply theo trường replyToId.
                    // Không gửi replyInfo từ FE để tránh lỗi parse JSON (500).
                    request.replyToId = replyToId;
                }

                await chatService.sendMessage(request, userId);

                setMessageText("");
                // Sau khi send, thường server sẽ broadcast lại qua WS; dù vậy ta vẫn chủ động scroll.
                scrollOnNextRenderRef.current = "smooth";
            } catch {
                setError("Không thể gửi tin nhắn");
            } finally {
                setSending(false);
            }
        },
        [conversationId, messageText, userId],
    );

    const handlePinMessage = useCallback(
        async (messageId: string) => {
            try {
                // Kiểm tra: nếu đã có 3 tin ghim rồi, báo cho user
                // (backend sẽ tự động bỏ ghim tin cũ nhất, nhưng frontend cũng nên kiểm tra)

                await chatService.pinMessage(messageId, userId);
            } catch (error) {
                const errorMsg =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message || "Không thể ghim tin nhắn";
                setRecallToast(errorMsg);
            }
        },
        [userId, pinnedMessages.length],
    );

    const handleUnpinMessage = useCallback(
        async (messageId: string) => {
            try {
                await chatService.unpinMessage(messageId, userId);
            } catch (error) {
                const errorMsg =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ||
                    "Không thể bỏ ghim tin nhắn";
                setRecallToast(errorMsg);
            }
        },
        [userId],
    );

    // Upload file/image/video/audio: presign → S3 PUT → sendMessage với objectKey
    const handleFileUpload = useCallback(
        async (file: File) => {
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
                // Bước 3: Gửi tin nhắn với objectKey làm content (BE tự ghép domain khi trả về)
                const request: SendMessageRequest = {
                    content: objectKey,
                    type,
                    conversationId,
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
        [conversationId, userId],
    );

    const handleSendMixedMedia = useCallback(
        async (files: File[], textOverride?: string, replyToId?: string) => {
            if (files.length === 0) return false;

            const validationError = getValidationErrorForFiles(files);
            if (validationError) {
                setRecallToast(validationError);
                return false;
            }

            const trimmed = (textOverride ?? messageText).trim();

            try {
                setUploading(true);
                setUploadProgressPercent(0);
                setUploadProgressLabel(`Đang tải tệp 0/${files.length}`);
                setUploadFileProgressMap(
                    Object.fromEntries(
                        files.map((file) => [getFileClientKey(file), 0]),
                    ),
                );
                setUploadFailedFileNames([]);
                setError(null);

                const presignedPayload: BulkPresignedRequest = {
                    module: "CONVERSATION",
                    targetId: String(conversationId),
                    files: files.map((file) => ({
                        type: toAttachmentCategory(file),
                        fileName: file.name,
                        contentType: file.type || "application/octet-stream",
                    })),
                };

                let presignedList: Array<{
                    presignedUrl: string;
                    objectKey: string;
                    fileName: string;
                }> = [];

                try {
                    presignedList =
                        await chatService.getBulkPresignedUrls(
                            presignedPayload,
                        );
                } catch {
                    presignedList = [];
                }

                if (presignedList.length !== files.length) {
                    presignedList = await Promise.all(
                        files.map((file) =>
                            chatService.getPresignedUrl(
                                "CONVERSATION",
                                String(conversationId),
                                toAttachmentCategory(file),
                                file.name,
                                file.type || "application/octet-stream",
                            ),
                        ),
                    );
                }

                const perFileLoaded = files.map(() => 0);
                const totalBytes = files.reduce(
                    (sum, file) => sum + Math.max(file.size, 1),
                    0,
                );

                await Promise.all(
                    files.map(async (file, index) => {
                        try {
                            await chatService.uploadToS3(
                                presignedList[index].presignedUrl,
                                file,
                                (loaded, total) => {
                                    const safeTotal =
                                        total > 0
                                            ? total
                                            : Math.max(file.size, 1);
                                    perFileLoaded[index] = Math.min(
                                        loaded,
                                        safeTotal,
                                    );

                                    const loadedBytes = perFileLoaded.reduce(
                                        (sum, value) => sum + value,
                                        0,
                                    );
                                    const completed = perFileLoaded.filter(
                                        (value, fileIndex) =>
                                            value >=
                                            Math.max(files[fileIndex].size, 1),
                                    ).length;

                                    const percent = Math.min(
                                        99,
                                        Math.round(
                                            (loadedBytes / totalBytes) * 100,
                                        ),
                                    );
                                    const filePercent = Math.min(
                                        100,
                                        Math.round(
                                            (perFileLoaded[index] / safeTotal) *
                                                100,
                                        ),
                                    );
                                    setUploadProgressPercent(percent);
                                    setUploadProgressLabel(
                                        `Đang tải tệp ${completed}/${files.length}`,
                                    );
                                    setUploadFileProgressMap((prev) => ({
                                        ...prev,
                                        [getFileClientKey(file)]: filePercent,
                                    }));
                                },
                            );
                        } catch {
                            throw new Error(`UPLOAD_FAILED::${file.name}`);
                        }
                    }),
                );

                const uploaded = files.map((file, index) => ({
                    file,
                    objectKey: presignedList[index].objectKey,
                }));

                const imageAttachments = uploaded
                    .filter((item) => isImageFile(item.file))
                    .map((item) => ({
                        url: item.objectKey,
                        type: item.file.type || "application/octet-stream",
                        fileName: item.file.name,
                        fileSize: item.file.size,
                    }));

                const fileAttachments = uploaded
                    .filter((item) => !isImageFile(item.file))
                    .map((item) => ({
                        url: item.objectKey,
                        type: item.file.type || "application/octet-stream",
                        fileName: item.file.name,
                        fileSize: item.file.size,
                    }));

                // Text-only fallback nếu có thao tác nhưng không có media hợp lệ.
                if (
                    imageAttachments.length === 0 &&
                    fileAttachments.length === 0
                ) {
                    if (!trimmed) return false;
                    await chatService.sendMessage(
                        {
                            content: trimmed,
                            type: "TEXT",
                            conversationId,
                            ...(replyToId ? { replyToId } : {}),
                        },
                        userId,
                    );
                }

                // Có media + có text => luôn gửi TEXT thành message riêng.
                if (
                    trimmed &&
                    (imageAttachments.length > 0 || fileAttachments.length > 0)
                ) {
                    await chatService.sendMessage(
                        {
                            content: trimmed,
                            type: "TEXT",
                            conversationId,
                            ...(replyToId ? { replyToId } : {}),
                        },
                        userId,
                    );
                }

                // Rule: toàn bộ ảnh gộp vào 1 message IMAGE và KHÔNG kèm text.
                if (imageAttachments.length > 0) {
                    await chatService.sendMessage(
                        {
                            content: "",
                            type: "IMAGE",
                            conversationId,
                            attachments: imageAttachments,
                            ...(replyToId ? { replyToId } : {}),
                        },
                        userId,
                    );
                }

                // Rule: các file không phải ảnh tách lẻ từng message FILE, không kẹp text.
                for (const attachment of fileAttachments) {
                    await chatService.sendMessage(
                        {
                            content: "",
                            type: "FILE",
                            conversationId,
                            attachments: [attachment],
                        },
                        userId,
                    );
                }

                setMessageText("");
                setUploadProgressPercent(100);
                setUploadProgressLabel(
                    `Đã tải ${files.length}/${files.length}`,
                );
                setUploadFileProgressMap((prev) => {
                    const next = { ...prev };
                    for (const file of files) {
                        next[getFileClientKey(file)] = 100;
                    }
                    return next;
                });
                scrollOnNextRenderRef.current = shouldForceAutoScroll()
                    ? "auto"
                    : "smooth";
                return true;
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : "";
                const failedName = errMsg.startsWith("UPLOAD_FAILED::")
                    ? errMsg.replace("UPLOAD_FAILED::", "")
                    : "";
                if (failedName) {
                    setUploadFailedFileNames([failedName]);
                    setRecallToast(`Tải tệp thất bại: ${failedName}`);
                }
                setError("Không thể gửi tệp đính kèm");
                return false;
            } finally {
                setUploading(false);
                setUploadProgressPercent(null);
                setUploadProgressLabel("");
                setUploadFileProgressMap({});
            }
        },
        [
            conversationId,
            messageText,
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
    }, [isRecording, handleFileUpload]);

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
            return { displayName: "", displayAvatar: null as string | null };
        }
        // Memo hoá để tránh tính lại tên/avatar mỗi render không cần thiết.
        return getConversationDisplayInfo(conversation, userId, membersById);
    }, [conversation, membersById, userId]);

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

        displayName: displayInfo.displayName,
        displayAvatar: displayInfo.displayAvatar,

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
        handleRecall,
        handleDeleteMessageForMe,
        handleDeleteConversationForMe,
        handleFileUpload,
        handleSendMixedMedia,
        appendRealtimeMessage: handleNewMessage,
        scrollToBottom,
        recallToast,

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
        // sendTypingSignal: Gửi signal đang gõ/ngừng gõ lên backend
        // Gọi khi: onChange input (isTyping=true), onBlur/Enter/Empty (isTyping=false)
        sendTypingSignal,
    };
}
