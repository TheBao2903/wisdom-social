import {
    CHAT_PAGE_SIZE,
    DEFAULT_CHAT_USER_ID,
    RECALLED_REPLY_TEXT,
} from "@/constants/chat";
import chatRuntimeStore, {
    type MembersByUserId,
} from "@/stores/chatRuntimeStore";
import chatService from "@/services/chatService";
import chatWebsocketService from "@/services/chatWebsocketService";
import type {
    BulkPresignedRequest,
    Conversation,
    ConversationMember,
    LocalUploadFile,
    Message,
    MessageSeenEvent,
    PinnedMessageDetail,
    TypingEvent,
} from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { setActiveConversationId } from "@/hooks/useMessagesController";

const MARK_AS_READ_DEBOUNCE_MS = 1000;
const TYPING_STOP_TIMEOUT_MS = 10000;
const REALTIME_FALLBACK_POLL_MS = 1500;
const MAX_FILES_PER_SEND = 20;
const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

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

export function useChatWindowController(args: {
    conversationId: number;
    onMarkAsRead?: (conversationId: number) => void;
}) {
    const { conversationId, onMarkAsRead } = args;

    const currentUserId = DEFAULT_CHAT_USER_ID;
    const isScreenFocused = useIsFocused();

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
    const [error, setError] = useState<string | null>(null);
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
    const typingTimeoutsRef = useRef<
        Map<number, ReturnType<typeof setTimeout>>
    >(new Map());

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

    const loadInitialData = useCallback(async () => {
        loadInitialDataRunCountRef.current += 1;
        console.log("[JUMP_DEBUG][controller] loadInitialData:start", {
            conversationId,
            run: loadInitialDataRunCountRef.current,
            isScreenFocused,
        });

        try {
            setLoading(true);
            setError(null);

            // Align with web UX: entering a conversation should clear unread immediately.
            if (isScreenFocused) {
                clearUnreadLocally();
                void executeMarkAsRead(undefined, { force: true });
            }

            const cachedConversation =
                chatRuntimeStore.getConversation(conversationId);
            const cachedMembers = chatRuntimeStore.getMembers(conversationId);
            const cachedMessages = chatRuntimeStore.getMessages(conversationId);
            const cachedPins = chatRuntimeStore.getPins(conversationId);

            if (cachedConversation) {
                setConversation(cachedConversation);
                setMembersById(cachedMembers);
                setMessages(cachedMessages);
                setPinnedMessages(cachedPins);
            }

            const [convResponse, membersResponse, messagesResponse] =
                await Promise.all([
                    chatService.getConversation(conversationId, currentUserId),
                    chatService.getConversationMembers(conversationId),
                    chatService.getMessages(
                        conversationId,
                        currentUserId,
                        null,
                        CHAT_PAGE_SIZE,
                    ),
                ]);

            if (!convResponse.success || !convResponse.data) {
                setConversation(null);
                setError(
                    convResponse.message || "Khong the tai cuoc tro chuyen",
                );
                return;
            }

            const cursorData = messagesResponse.success
                ? messagesResponse.data
                : null;
            const normalizedMessages = Array.isArray(cursorData?.data)
                ? normalizeMessagesForUi(cursorData.data)
                : [];

            const membersFromApi = toMembersByUserId(membersResponse);
            const mergedMembers = mergeReferenceUsers(
                membersFromApi,
                cursorData?.referenceUsers ?? {},
            );

            const normalizedConversation: Conversation = {
                ...convResponse.data,
                members: Object.values(mergedMembers),
            };

            const initialPins = normalizedConversation.pinnedMessages ?? [];

            chatRuntimeStore.setConversation(
                conversationId,
                normalizedConversation,
            );
            chatRuntimeStore.setMembers(conversationId, mergedMembers);
            chatRuntimeStore.setMessages(conversationId, normalizedMessages);
            chatRuntimeStore.setPins(conversationId, initialPins);
            chatRuntimeStore.setPaging(conversationId, {
                hasMoreOlder: Boolean(cursorData?.hasMoreOlder),
                hasMoreNewer: Boolean(cursorData?.hasMoreNewer),
                isHistoricalMode: false,
                olderCursor: cursorData?.nextCursor ?? null,
            });

            setConversation(normalizedConversation);
            setMembersById(mergedMembers);
            setMessages(normalizedMessages);
            setPinnedMessages(initialPins);
            setReadReceipts(
                Object.values(mergedMembers)
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
            if (lastMessage && isScreenFocused) {
                void executeMarkAsRead(lastMessage.id, { force: true });
            }

            console.log("[JUMP_DEBUG][controller] loadInitialData:done", {
                conversationId,
                run: loadInitialDataRunCountRef.current,
                messageCount: normalizedMessages.length,
                hasMoreOlder: Boolean(cursorData?.hasMoreOlder),
                hasMoreNewer: Boolean(cursorData?.hasMoreNewer),
            });
        } catch {
            setError("Khong the tai du lieu chat");
        } finally {
            setLoading(false);
        }
    }, [
        clearUnreadLocally,
        conversationId,
        currentUserId,
        executeMarkAsRead,
        isScreenFocused,
        mergeReferenceUsers,
    ]);

    useEffect(() => {
        console.log("[JUMP_DEBUG][controller] effect->loadInitialData", {
            conversationId,
        });
        void loadInitialData();
    }, [conversationId, loadInitialData]);

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

    const handleNewMessage = useCallback(
        (incomingMessage: Message) => {
            const normalizedIncoming =
                normalizeReplyPreviewContent(incomingMessage);

            setMessages((prev) => {
                if (prev.some((item) => item.id === normalizedIncoming.id)) {
                    return prev;
                }

                const next = [...prev, normalizedIncoming];
                chatRuntimeStore.setMessages(conversationId, next);
                return next;
            });

            setConversation((prev) => {
                if (!prev) return prev;

                const next: Conversation = {
                    ...prev,
                    updatedAt: normalizedIncoming.createdAt,
                    unreadCount: 0,
                    lastMessage: {
                        lastMessageContent:
                            buildLastMessagePreview(normalizedIncoming),
                        lastMessageType: normalizedIncoming.type,
                        lastSenderId: normalizedIncoming.senderId,
                        lastSenderName:
                            normalizedIncoming.senderName || "Unknown",
                        lastMessageAt: normalizedIncoming.createdAt,
                        read: normalizedIncoming.senderId === currentUserId,
                    },
                };

                chatRuntimeStore.setConversation(conversationId, next);
                return next;
            });

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
        };
    }, [
        applyRecallDomino,
        conversationId,
        currentUserId,
        executeMarkAsRead,
        handleMessageSeen,
        handleNewMessage,
        handleTyping,
        isScreenFocused,
    ]);

    const handleSend = useCallback(
        async (replyToId?: string) => {
            const trimmed = messageText.trim();
            if (!trimmed) return false;

            try {
                setSending(true);
                setError(null);

                const createdMessage = await chatService.sendMessage(
                    {
                        content: trimmed,
                        type: "TEXT",
                        conversationId,
                        ...(replyToId ? { replyToId } : {}),
                    },
                    currentUserId,
                );
                handleNewMessage(createdMessage);

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

                setMessageText("");
                return true;
            } catch {
                setError("Khong the gui tin nhan");
                return false;
            } finally {
                setSending(false);
            }
        },
        [conversationId, currentUserId, handleNewMessage, messageText],
    );

    const handleRecall = useCallback(
        async (messageId: string) => {
            try {
                await chatService.recallMessage(messageId, currentUserId);
                applyRecallDomino(messageId);
            } catch {
                setError("Khong the thu hoi tin nhan");
            }
        },
        [applyRecallDomino, currentUserId],
    );

    const handleSendMixedMedia = useCallback(
        async (
            files: LocalUploadFile[],
            textOverride?: string,
            replyToId?: string,
        ): Promise<boolean> => {
            if (files.length === 0) return false;

            const validationError = getValidationErrorForFiles(files);
            if (validationError) {
                setError(validationError);
                return false;
            }

            const trimmed = (textOverride ?? messageText).trim();

            try {
                setUploading(true);
                setUploadProgressPercent(0);
                setUploadProgressLabel(`Dang tai tep 0/${files.length}`);
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
                        fileName: file.fileName,
                        contentType:
                            file.mimeType || "application/octet-stream",
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
                                String(conversationId),
                                toAttachmentCategory(file),
                                file.fileName,
                                file.mimeType || "application/octet-stream",
                            ),
                        ),
                    );
                }

                const perFileLoaded = files.map(() => 0);
                const totalBytes = files.reduce(
                    (sum, file) => sum + Math.max(file.fileSize, 1),
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
                                            : Math.max(file.fileSize, 1);

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
                                            Math.max(
                                                files[fileIndex].fileSize,
                                                1,
                                            ),
                                    ).length;

                                    const percent = Math.min(
                                        99,
                                        Math.round(
                                            (loadedBytes /
                                                Math.max(totalBytes, 1)) *
                                                100,
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
                                        `Dang tai tep ${completed}/${files.length}`,
                                    );
                                    setUploadFileProgressMap((prev) => ({
                                        ...prev,
                                        [getFileClientKey(file)]: filePercent,
                                    }));
                                },
                            );
                        } catch {
                            throw new Error(`UPLOAD_FAILED::${file.fileName}`);
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
                        type: item.file.mimeType || "application/octet-stream",
                        fileName: item.file.fileName,
                        fileSize: item.file.fileSize,
                    }));

                const audioAttachments = uploaded
                    .filter((item) => item.file.mimeType.startsWith("audio/"))
                    .map((item) => ({
                        url: item.objectKey,
                        type: item.file.mimeType || "application/octet-stream",
                        fileName: item.file.fileName,
                        fileSize: item.file.fileSize,
                    }));

                const videoAttachments = uploaded
                    .filter((item) => item.file.mimeType.startsWith("video/"))
                    .map((item) => ({
                        url: item.objectKey,
                        type: item.file.mimeType || "application/octet-stream",
                        fileName: item.file.fileName,
                        fileSize: item.file.fileSize,
                    }));

                const fileAttachments = uploaded
                    .filter(
                        (item) =>
                            !isImageFile(item.file) &&
                            !item.file.mimeType.startsWith("audio/") &&
                            !item.file.mimeType.startsWith("video/"),
                    )
                    .map((item) => ({
                        url: item.objectKey,
                        type: item.file.mimeType || "application/octet-stream",
                        fileName: item.file.fileName,
                        fileSize: item.file.fileSize,
                    }));

                if (
                    imageAttachments.length === 0 &&
                    audioAttachments.length === 0 &&
                    videoAttachments.length === 0 &&
                    fileAttachments.length === 0
                ) {
                    if (!trimmed) return false;

                    const createdMessage = await chatService.sendMessage(
                        {
                            content: trimmed,
                            type: "TEXT",
                            conversationId,
                            ...(replyToId ? { replyToId } : {}),
                        },
                        currentUserId,
                    );
                    handleNewMessage(createdMessage);
                }

                if (
                    trimmed &&
                    (imageAttachments.length > 0 ||
                        audioAttachments.length > 0 ||
                        videoAttachments.length > 0 ||
                        fileAttachments.length > 0)
                ) {
                    const createdMessage = await chatService.sendMessage(
                        {
                            content: trimmed,
                            type: "TEXT",
                            conversationId,
                            ...(replyToId ? { replyToId } : {}),
                        },
                        currentUserId,
                    );
                    handleNewMessage(createdMessage);
                }

                if (imageAttachments.length > 0) {
                    const createdMessage = await chatService.sendMessage(
                        {
                            content: "",
                            type: "IMAGE",
                            conversationId,
                            attachments: imageAttachments,
                            ...(replyToId ? { replyToId } : {}),
                        },
                        currentUserId,
                    );
                    handleNewMessage(createdMessage);
                }

                for (const attachment of audioAttachments) {
                    const createdMessage = await chatService.sendMessage(
                        {
                            content: "",
                            type: "AUDIO",
                            conversationId,
                            attachments: [attachment],
                            ...(replyToId ? { replyToId } : {}),
                        },
                        currentUserId,
                    );
                    handleNewMessage(createdMessage);
                }

                for (const attachment of videoAttachments) {
                    const createdMessage = await chatService.sendMessage(
                        {
                            content: "",
                            type: "VIDEO",
                            conversationId,
                            attachments: [attachment],
                            ...(replyToId ? { replyToId } : {}),
                        },
                        currentUserId,
                    );
                    handleNewMessage(createdMessage);
                }

                for (const attachment of fileAttachments) {
                    const createdMessage = await chatService.sendMessage(
                        {
                            content: "",
                            type: "FILE",
                            conversationId,
                            attachments: [attachment],
                            ...(replyToId ? { replyToId } : {}),
                        },
                        currentUserId,
                    );
                    handleNewMessage(createdMessage);
                }

                setMessageText("");
                setUploadProgressPercent(100);
                setUploadProgressLabel(
                    `Da tai ${files.length}/${files.length}`,
                );
                setUploadFileProgressMap((prev) => {
                    const next = { ...prev };
                    for (const file of files) {
                        next[getFileClientKey(file)] = 100;
                    }
                    return next;
                });

                return true;
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : "";
                const failedName = errMsg.startsWith("UPLOAD_FAILED::")
                    ? errMsg.replace("UPLOAD_FAILED::", "")
                    : "";
                if (failedName) {
                    setUploadFailedFileNames([failedName]);
                }
                setError("Khong the gui tep dinh kem");
                return false;
            } finally {
                setUploading(false);
                setUploadProgressPercent(null);
                setUploadProgressLabel("");
                setUploadFileProgressMap({});
            }
        },
        [conversationId, currentUserId, handleNewMessage, messageText],
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

                    const next: Conversation = {
                        ...prev,
                        updatedAt: newestMessage.createdAt,
                        unreadCount: 0,
                        lastMessage: {
                            lastMessageContent:
                                buildLastMessagePreview(newestMessage),
                            lastMessageType: newestMessage.type,
                            lastSenderId: newestMessage.senderId,
                            lastSenderName:
                                newestMessage.senderName || "Unknown",
                            lastMessageAt: newestMessage.createdAt,
                            read: newestMessage.senderId === currentUserId,
                        },
                    };

                    chatRuntimeStore.setConversation(conversationId, next);
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

            if (messages.some((message) => message.id === targetMessageId)) {
               
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
                setError("Khong the nhay toi tin nhan");
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
        [conversationId, currentUserId, mergeReferenceUsers, messages],
    );

    const resetToPresent = useCallback(async () => {
        console.log("[JUMP_DEBUG][controller] resetToPresent:start", {
            conversationId,
        });
        await loadInitialData();
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
        error,
        handleSend,
        handleSendMixedMedia,
        handleRecall,
        handleDeleteForMe,
        handlePinMessage,
        handleUnpinMessage,
        sendTypingSignal,
        loadOlderMessages,
        loadNewerMessages,
        handleJumpToMessage,
        resetToPresent,
    };
}
