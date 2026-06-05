import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import chatService, {
    type Conversation,
    type ConversationPin,
    type MessageType,
    isMaxPinLimitError,
} from "../services/chatService";
import websocketService, {
    type ConversationSnapshot,
    type LastMessageUpdate,
    type MessageSeenEvent,
} from "../services/websocket";
import { useAuth } from "../contexts/AuthContext";
import { useChatUnread } from "../contexts/ChatUnreadContext";
import chatRuntimeStore from "../stores/chatRuntimeStore";
import {
    formatConversationTime,
    getConversationDisplayInfo,
    GROUP_SYSTEM_SYNC_TYPES,
    parseOptionalInt,
    resolveReadOnlyNoticeFromConversation,
    resolveReadOnlyNoticeFromLastMessage,
    safeParseMemberIds,
    sortConversationsByLastMessageAt,
} from "../utils/messagesControllerUtils";

const PRESERVE_EMPTY_PENDING_REQUEST_TYPES = new Set<MessageType>([
    "SYSTEM_ADD_MEMBER",
    "SYSTEM_KICK_MEMBER",
    "SYSTEM_BLOCK_MEMBER",
    "SYSTEM_MEMBER_BLOCKED_FROM_JOIN",
    "SYSTEM_UPDATE_ROLE",
    "SYSTEM_UPDATE_SETTING",
    "SYSTEM_REQUIRE_APPROVAL",
    "SYSTEM_JOIN_VIA_LINK",
    "SYSTEM_GROUP_INVITE_LINK_SENT",
]);

const MAX_PINNED_CONVERSATIONS = 4;
const MAX_PIN_LIMIT_TITLE = "Bạn đã đạt tối đa 4 cuộc hội thoại được ghim";
const MAX_PIN_LIMIT_HINT = "Hãy bỏ ghim 1 cuộc hội thoại trước";

function sortWithPinnedConversations(
    conversations: Conversation[],
    pinnedConversations: ConversationPin[],
): Conversation[] {
    const pinnedOrder = new Map(
        pinnedConversations.map((pin, index) => [pin.conversationId, index]),
    );

    return [...conversations].sort((left, right) => {
        const leftPinnedOrder = pinnedOrder.get(left.id);
        const rightPinnedOrder = pinnedOrder.get(right.id);

        if (leftPinnedOrder !== undefined && rightPinnedOrder !== undefined) {
            return leftPinnedOrder - rightPinnedOrder;
        }

        if (leftPinnedOrder !== undefined) return -1;
        if (rightPinnedOrder !== undefined) return 1;

        return 0;
    });
}

function areConversationListsEquivalent(
    current: Conversation[],
    next: Conversation[],
): boolean {
    if (current.length !== next.length) return false;

    return current.every((conversation, index) => {
        const candidate = next[index];
        if (!candidate) return false;
        return (
            conversation.id === candidate.id &&
            conversation.name === candidate.name &&
            conversation.imageUrl === candidate.imageUrl &&
            conversation.directPartnerId === candidate.directPartnerId &&
            conversation.updatedAt === candidate.updatedAt &&
            conversation.unreadCount === candidate.unreadCount &&
            conversation.lastMessage?.lastMessageAt ===
                candidate.lastMessage?.lastMessageAt &&
            conversation.lastMessage?.lastMessageContent ===
                candidate.lastMessage?.lastMessageContent &&
            conversation.lastMessage?.lastMessageType ===
                candidate.lastMessage?.lastMessageType &&
            conversation.lastMessage?.lastSenderId ===
                candidate.lastMessage?.lastSenderId &&
            conversation.lastMessage?.read === candidate.lastMessage?.read
        );
    });
}

/**
 * useMessagesController
 * - Controller hook cho trang Messages: fetch list hội thoại + search/filter + điều hướng.
 * - Đồng bộ lastMessage/unreadCount realtime qua WebSocket.
 * - Mark-as-read khi user mở hội thoại.
 *
 * Gợi ý đọc nhanh: xem các section `// ======` trong thân hook.
 * Ví dụ dùng (rút gọn):
 * ```tsx
 * const { filteredConversations, handleSelectConversation } = useMessagesController();
 * ```
 */
export function useMessagesController() {
    // ====== UI State (render) ======
    const [searchQuery, setSearchQuery] = useState("");
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [pinnedConversations, setPinnedConversations] = useState<
        ConversationPin[]
    >([]);
    const [conversationReadOnlyNotices, setConversationReadOnlyNotices] =
        useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ====== Routing / URL ======
    // navigate: chuyển route khi user chọn hội thoại
    const navigate = useNavigate();
    const { conversationId } = useParams<{ conversationId?: string }>();

    // selectedConversationId: param trong URL (có thể null nếu chưa chọn)
    const selectedConversationId = parseOptionalInt(conversationId);

    // currentUserId: lấy từ AuthContext (security integration)
    const { currentUser } = useAuth();
    const { clearConversationUnread } = useChatUnread();
    const currentUserId = currentUser?.id ?? 0;

    // ====== Refs chống stale-closure (đặc biệt cho websocket callbacks) ======
    // Lý do: callback subscribe có thể chạy sau nhiều render; dùng ref để đọc giá trị mới nhất.
    const selectedConversationIdRef = useRef<number | null>(
        selectedConversationId,
    );
    const currentUserIdRef = useRef<number>(currentUserId);
    const refreshingConversationIdsRef = useRef<Set<number>>(new Set());
    const presenceHydratedConversationIdsRef = useRef<Set<number>>(new Set());
    const conversationListCatchupRef = useRef({
        inFlight: false,
        lastRunAt: 0,
        needsCatchup: false,
        retryTimerId: null as number | null,
        retryAttempts: 0,
    });

    useEffect(() => {
        // Đồng bộ ref mỗi khi URL param đổi.
        selectedConversationIdRef.current = selectedConversationId;
    }, [selectedConversationId]);

    useEffect(() => {
        // Đồng bộ ref mỗi khi userId đổi.
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) return;
        const missingPresenceConversations = conversations.filter(
            (conversation) =>
                conversation.type === "DIRECT" &&
                !conversation.directPartnerId &&
                (!conversation.members || conversation.members.length === 0) &&
                !presenceHydratedConversationIdsRef.current.has(conversation.id),
        );

        if (missingPresenceConversations.length === 0) return;

        // Sidebar cũ có thể không trả members/directPartnerId, nên hydrate nền để presence hiện ngay không cần bấm detail.
        missingPresenceConversations.forEach((conversation) =>
            presenceHydratedConversationIdsRef.current.add(conversation.id),
        );

        let cancelled = false;
        Promise.all(
            missingPresenceConversations.map((conversation) =>
                chatService
                    .getConversation(conversation.id, currentUserId)
                    .then((response) => response.data ?? null)
                    .catch(() => null),
            ),
        ).then((details) => {
            if (cancelled) return;
            const detailMap = new Map(
                details
                    .filter((detail): detail is Conversation => Boolean(detail))
                    .map((detail) => [detail.id, detail]),
            );
            if (detailMap.size === 0) return;

            setConversations((prev) =>
                prev.map((conversation) => {
                    const detail = detailMap.get(conversation.id);
                    if (!detail) return conversation;
                    chatRuntimeStore.setConversation(conversation.id, {
                        ...conversation,
                        ...detail,
                    });
                    return {
                        ...conversation,
                        ...detail,
                        lastMessage: conversation.lastMessage ?? detail.lastMessage,
                        unreadCount: conversation.unreadCount ?? detail.unreadCount,
                    };
                }),
            );
        });

        return () => {
            cancelled = true;
        };
    }, [conversations, currentUserId]);

    // ====== Data loading: danh sách hội thoại ======
    const loadConversations = useCallback(async (
        options: { showLoading?: boolean } = {},
    ) => {
        const showLoading = options.showLoading ?? true;
        try {
            if (showLoading) {
                setLoading(true);
                setError(null);
            }

            const [convs, pins] = await Promise.all([
                chatService.getConversations(currentUserId),
                chatService.fetchPinnedConversations(),
            ]);
            setPinnedConversations(pins);
            if (convs.success) {
                const conversationData = Array.isArray(convs.data)
                    ? convs.data
                    : [];
                conversationListCatchupRef.current.needsCatchup = false;
                setError(null);
                // API trả về ok: set list hội thoại.
                const sortedConversations = sortWithPinnedConversations(
                    conversationData,
                    pins,
                );
                setConversations((prev) =>
                    areConversationListsEquivalent(prev, sortedConversations)
                        ? prev
                        : sortedConversations,
                );
                setConversationReadOnlyNotices(() => {
                    const next: Record<number, string> = {};
                    for (const conv of conversationData) {
                        const notice = resolveReadOnlyNoticeFromConversation(
                            conv,
                            currentUserId,
                        );
                        if (notice) {
                            next[conv.id] = notice;
                        }
                    }
                    return next;
                });
            } else {
                conversationListCatchupRef.current.needsCatchup = true;
                setConversationReadOnlyNotices({});
                if (showLoading) {
                    setError(convs.message || "Không thể tải danh sách hội thoại");
                }
            }
        } catch {
            // Network/exception: cố gắng fail-safe với list rỗng + thông báo.
            setConversationReadOnlyNotices({});
            conversationListCatchupRef.current.needsCatchup = true;
            if (showLoading) {
                setError("Không thể tải danh sách hội thoại");
            }
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [currentUserId]);

    useEffect(() => {
        // Reload lại list khi userId thay đổi.
        void loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (!currentUserId) return;
        const catchupTimers: number[] = [];
        const clearRetryTimer = () => {
            const timerId = conversationListCatchupRef.current.retryTimerId;
            if (timerId !== null) {
                window.clearTimeout(timerId);
                conversationListCatchupRef.current.retryTimerId = null;
            }
        };

        const runCatchup = () => {
            const now = Date.now();
            if (conversationListCatchupRef.current.inFlight) return;
            if (now - conversationListCatchupRef.current.lastRunAt < 2500) {
                return;
            }

            conversationListCatchupRef.current.inFlight = true;
            conversationListCatchupRef.current.lastRunAt = now;
            void loadConversations({ showLoading: false }).finally(() => {
                conversationListCatchupRef.current.inFlight = false;
            });
        };

        const scheduleRetryLoop = () => {
            if (conversationListCatchupRef.current.retryTimerId !== null) return;
            conversationListCatchupRef.current.retryTimerId = window.setTimeout(() => {
                conversationListCatchupRef.current.retryTimerId = null;
                if (!conversationListCatchupRef.current.needsCatchup) {
                    conversationListCatchupRef.current.retryAttempts = 0;
                    return;
                }
                if (document.visibilityState !== "visible" || !navigator.onLine) {
                    scheduleRetryLoop();
                    return;
                }
                if (conversationListCatchupRef.current.retryAttempts >= 20) {
                    conversationListCatchupRef.current.retryAttempts = 0;
                    return;
                }
                conversationListCatchupRef.current.retryAttempts += 1;
                runCatchup();
                scheduleRetryLoop();
            }, 3000);
        };

        const scheduleCatchup = () => {
            if (!conversationListCatchupRef.current.needsCatchup) return;
            conversationListCatchupRef.current.retryAttempts = 0;
            [0, 3000, 8000].forEach((delay) => {
                catchupTimers.push(window.setTimeout(runCatchup, delay));
            });
            scheduleRetryLoop();
        };

        const forceCatchup = () => {
            conversationListCatchupRef.current.needsCatchup = true;
            scheduleCatchup();
        };

        const markNeedsCatchup = () => {
            conversationListCatchupRef.current.needsCatchup = true;
            conversationListCatchupRef.current.retryAttempts = 0;
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
    }, [currentUserId, loadConversations]);

    useEffect(() => {
        for (const conv of conversations) {
            chatRuntimeStore.setConversation(conv.id, conv);
        }
    }, [conversations]);

    // Cập nhật SIDEBAR realtime khi 1 thành viên bị khóa/mở khóa tài khoản.
    // websocket.ts phát window event này từ topic /topic/user/{id}/conversations.
    useEffect(() => {
        const handleMemberLockChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
                conversationId?: number;
                userId?: number;
                accountLocked?: boolean;
            } | null;
            if (!detail || typeof detail.conversationId !== "number") return;

            const lockedUserId = Number(detail.userId);
            const accountLocked = Boolean(detail.accountLocked);

            setConversations((prev) =>
                prev.map((conversation) => {
                    if (conversation.id !== detail.conversationId)
                        return conversation;

                    // Cập nhật cờ trên member tương ứng (group + direct).
                    const members = conversation.members?.map((member) =>
                        Number(member.userId) === lockedUserId
                            ? { ...member, accountLocked }
                            : member,
                    );

                    return {
                        ...conversation,
                        members: members ?? conversation.members,
                        // Direct: đồng bộ cờ đối phương để mask tên/avatar ở sidebar.
                        directPartnerLocked:
                            conversation.type === "DIRECT" &&
                            Number(conversation.directPartnerId) === lockedUserId
                                ? accountLocked
                                : conversation.directPartnerLocked,
                    };
                }),
            );
        };

        const handleDirectBlockStatusChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
                conversationId?: number;
                blockerId?: number;
                blockedId?: number;
                blocked?: boolean;
            } | null;
            if (!detail || typeof detail.conversationId !== "number") return;

            setConversations((prev) =>
                prev.map((conversation) => {
                    if (conversation.id !== detail.conversationId || conversation.type !== "DIRECT") {
                        return conversation;
                    }

                    return {
                        ...conversation,
                        directBlockedByMe:
                            Number(detail.blockerId) === Number(currentUserIdRef.current)
                                ? Boolean(detail.blocked)
                                : conversation.directBlockedByMe,
                        directBlockedMe:
                            Number(detail.blockedId) === Number(currentUserIdRef.current)
                                ? Boolean(detail.blocked)
                                : conversation.directBlockedMe,
                    };
                }),
            );
        };

        const handleUserBlockStatusChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
                blockerId?: number;
                blockedId?: number;
                blocked?: boolean;
            } | null;
            if (!detail) return;

            setConversations((prev) =>
                prev.map((conversation) => {
                    if (conversation.type !== "DIRECT") return conversation;
                    const partnerId = Number(conversation.directPartnerId);
                    if (!Number.isFinite(partnerId)) return conversation;

                    const currentUserId = Number(currentUserIdRef.current);
                    const affectsThisConversation =
                        (Number(detail.blockerId) === currentUserId &&
                            Number(detail.blockedId) === partnerId) ||
                        (Number(detail.blockerId) === partnerId &&
                            Number(detail.blockedId) === currentUserId);
                    if (!affectsThisConversation) return conversation;

                    return {
                        ...conversation,
                        directBlockedByMe:
                            Number(detail.blockerId) === currentUserId
                                ? Boolean(detail.blocked)
                                : conversation.directBlockedByMe,
                        directBlockedMe:
                            Number(detail.blockedId) === currentUserId
                                ? Boolean(detail.blocked)
                                : conversation.directBlockedMe,
                    };
                }),
            );
        };

        window.addEventListener(
            "conversation-member-lock-changed",
            handleMemberLockChanged,
        );
        window.addEventListener(
            "conversation-direct-block-status-changed",
            handleDirectBlockStatusChanged,
        );
        window.addEventListener(
            "user-block-status-changed",
            handleUserBlockStatusChanged,
        );
        return () => {
            window.removeEventListener(
                "conversation-member-lock-changed",
                handleMemberLockChanged,
            );
            window.removeEventListener(
                "conversation-direct-block-status-changed",
                handleDirectBlockStatusChanged,
            );
            window.removeEventListener(
                "user-block-status-changed",
                handleUserBlockStatusChanged,
            );
        };
    }, []);

    const fetchPinnedConversations = useCallback(async () => {
        const pins = await chatService.fetchPinnedConversations();
        setPinnedConversations(pins);
        setConversations((prev) => sortWithPinnedConversations(prev, pins));
        return pins;
    }, []);

    const showMaxPinLimitPopup = useCallback(() => {
        window.alert(`${MAX_PIN_LIMIT_TITLE}\n${MAX_PIN_LIMIT_HINT}`);
    }, []);

    const pinConversation = useCallback(
        async (conversationId: number) => {
            const conversation = conversations.find(
                (conv) => conv.id === conversationId,
            );
            if (!conversation) return false;

            if (
                pinnedConversations.length >= MAX_PINNED_CONVERSATIONS &&
                !pinnedConversations.some(
                    (pin) => pin.conversationId === conversationId,
                )
            ) {
                showMaxPinLimitPopup();
                return false;
            }

            const optimisticPin: ConversationPin = {
                conversationId,
                pinnedAt: new Date().toISOString(),
                conversation,
            };
            const previousPins = pinnedConversations;
            const nextPins = [
                optimisticPin,
                ...previousPins.filter(
                    (pin) => pin.conversationId !== conversationId,
                ),
            ];

            setPinnedConversations(nextPins);
            setConversations((prev) =>
                sortWithPinnedConversations(prev, nextPins),
            );

            try {
                const savedPin =
                    await chatService.pinConversation(conversationId);
                setPinnedConversations((currentPins) => {
                    const syncedPins = [
                        savedPin,
                        ...currentPins.filter(
                            (pin) => pin.conversationId !== conversationId,
                        ),
                    ];
                    setConversations((prev) =>
                        sortWithPinnedConversations(prev, syncedPins),
                    );
                    return syncedPins;
                });
                return true;
            } catch (error) {
                setPinnedConversations(previousPins);
                setConversations((prev) =>
                    sortWithPinnedConversations(prev, previousPins),
                );
                if (isMaxPinLimitError(error)) {
                    showMaxPinLimitPopup();
                }
                return false;
            }
        },
        [conversations, pinnedConversations, showMaxPinLimitPopup],
    );

    const unpinConversation = useCallback(
        async (conversationId: number) => {
            const previousPins = pinnedConversations;
            const nextPins = previousPins.filter(
                (pin) => pin.conversationId !== conversationId,
            );

            setPinnedConversations(nextPins);
            setConversations((prev) =>
                sortWithPinnedConversations(prev, nextPins),
            );

            try {
                await chatService.unpinConversation(conversationId);
                return true;
            } catch {
                setPinnedConversations(previousPins);
                setConversations((prev) =>
                    sortWithPinnedConversations(prev, previousPins),
                );
                return false;
            }
        },
        [pinnedConversations],
    );

    const replacePinnedConversation = useCallback(
        async (conversationIdToUnpin: number, conversationIdToPin: number) => {
            if (conversationIdToUnpin === conversationIdToPin) return true;

            const conversation = conversations.find(
                (conv) => conv.id === conversationIdToPin,
            );
            if (!conversation) return false;

            const previousPins = pinnedConversations;
            const optimisticPin: ConversationPin = {
                conversationId: conversationIdToPin,
                pinnedAt: new Date().toISOString(),
                conversation,
            };
            const nextPins = [
                optimisticPin,
                ...previousPins.filter(
                    (pin) =>
                        pin.conversationId !== conversationIdToUnpin &&
                        pin.conversationId !== conversationIdToPin,
                ),
            ];

            setPinnedConversations(nextPins);
            setConversations((prev) =>
                sortWithPinnedConversations(prev, nextPins),
            );

            try {
                await chatService.unpinConversation(conversationIdToUnpin);
                const savedPin =
                    await chatService.pinConversation(conversationIdToPin);
                const syncedPins = [
                    savedPin,
                    ...nextPins.filter(
                        (pin) => pin.conversationId !== conversationIdToPin,
                    ),
                ];
                setPinnedConversations(syncedPins);
                setConversations((prev) =>
                    sortWithPinnedConversations(prev, syncedPins),
                );
                return true;
            } catch (error) {
                const pins = await chatService
                    .fetchPinnedConversations()
                    .catch(() => previousPins);
                setPinnedConversations(pins);
                setConversations((prev) =>
                    sortWithPinnedConversations(prev, pins),
                );
                if (isMaxPinLimitError(error)) {
                    showMaxPinLimitPopup();
                }
                return false;
            }
        },
        [
            conversations,
            pinnedConversations,
            showMaxPinLimitPopup,
        ],
    );

    // ====== Clear unreadCount khi user mở hội thoại ======
    // Optimistic update: UI phản hồi ngay, API thực tế được gọi từ ChatWindow (có lastMessageId)
    useEffect(() => {
        const convId = selectedConversationId;
        if (convId == null) return;

        // Clear unreadCount ngay khi mở conversation
        // API markAsRead sẽ được gọi từ useChatWindowController (có lastMessageId đầy đủ)
        setConversations((prev) =>
            prev.map((conv) =>
                conv.id === convId ? { ...conv, unreadCount: 0 } : conv,
            ),
        );
        clearConversationUnread(convId);
    }, [clearConversationUnread, selectedConversationId]);

    // Hydrate chi tiết hội thoại sau khi chọn item từ sidebar response mới
    // (GET /conversations đã tối ưu và không còn members/pinnedMessages).
    useEffect(() => {
        const convId = selectedConversationId;
        if (convId == null || !currentUserId) return;

        const selectedConv = conversations.find((conv) => conv.id === convId);
        
        // We need to bypass the early return if the conversation's cached members
        // list indicates the current user has a restricted status, because we must
        // fetch the fresh data to set the conversationReadOnlyNotices properly.
        let hasRestrictedStatus = false;
        if (selectedConv?.members) {
            const me = selectedConv.members.find(
                (m) => Number(m.userId) === Number(currentUserId)
            );
            if (!me) {
                // If the user is not in the cached members list, they might have left/kicked
                // and the backend list API didn't include them. We must fetch detail to know.
                hasRestrictedStatus = true;
            } else if (
                me.status === "LEFT" ||
                me.status === "KICKED" ||
                me.status === "BLOCKED" ||
                me.status === "GROUP_DISBANDED"
            ) {
                hasRestrictedStatus = true;
            }
        }

        console.log("[DEBUG_READD] Hydration check", {
            convId,
            hasMembers: selectedConv?.members?.length,
            hasRestrictedStatus,
            me: selectedConv?.members?.find((m) => Number(m.userId) === Number(currentUserId))
        });

        if (!hasRestrictedStatus && selectedConv?.members && selectedConv.members.length > 0) {
            console.log("[DEBUG_READD] Hydration skipped (already has members and no restricted status)");
            return;
        }

        let isCancelled = false;
        console.log("[DEBUG_READD] Fetching conversation detail for hydration", convId);

        chatService
            .getConversation(convId, currentUserId)
            .then((response) => {
                if (isCancelled || !response.success || !response.data) return;

                const detailConversation = response.data;

                setConversations((prev) =>
                    sortConversationsByLastMessageAt(
                        prev.map((conv) =>
                            conv.id === convId
                                ? {
                                      ...conv,
                                      ...detailConversation,
                                      lastMessage:
                                          detailConversation.lastMessage ??
                                          conv.lastMessage,
                                      unreadCount:
                                          conv.unreadCount ??
                                          detailConversation.unreadCount,
                                  }
                                : conv,
                        ),
                    ),
                );

                chatRuntimeStore.setConversation(convId, detailConversation);

                const detailNotice = resolveReadOnlyNoticeFromConversation(
                    detailConversation,
                    currentUserId,
                );
                
                console.log("[DEBUG_READD] Hydration fetched detail", {
                    convId,
                    detailNotice
                });

                setConversationReadOnlyNotices((prev) => {
                    const next = { ...prev };

                    if (detailNotice) {
                        next[convId] = detailNotice;
                        console.log("[DEBUG_READD] Setting conversationReadOnlyNotices during hydration", next);
                        return next;
                    }

                    if (convId in next) {
                        delete next[convId];
                        console.log("[DEBUG_READD] Clearing conversationReadOnlyNotices during hydration", next);
                    }

                    return next;
                });
            })
            .catch((error: unknown) => {
                if (isCancelled) return;
                
                // Nếu fetch detail trả về 403, nghĩa là user đã rời/bị kick khỏi nhóm
                // và backend không cho phép truy cập detail nữa.
                // Chúng ta phải set notice để UI chat window hiện khóa,
                // và ĐẶC BIỆT để sau này khi websocket mở khóa, nó tạo ra sự thay đổi state (từ có lỗi -> null).
                const response =
                    error &&
                    typeof error === "object" &&
                    "response" in error
                        ? (error as {
                              response?: { status?: number; data?: unknown };
                          }).response
                        : undefined;

                if (response?.status === 403) {
                    const data =
                        response.data &&
                        typeof response.data === "object"
                            ? (response.data as Record<string, unknown>)
                            : null;
                    const nestedData =
                        data?.data && typeof data.data === "object"
                            ? (data.data as Record<string, unknown>)
                            : null;
                    const directMessage = typeof data?.message === "string" ? data.message : null;
                    const nestedMessage = typeof nestedData?.message === "string" ? nestedData.message : null;
                    const springMessage = typeof data?.error === "string" ? data.error : null;
                    const finalServerMsg = directMessage || nestedMessage || springMessage;
                    
                    const notice = finalServerMsg || "Bạn không có quyền truy cập hội thoại này.";

                    setConversationReadOnlyNotices((prev) => ({
                        ...prev,
                        [convId]: notice,
                    }));
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [conversations, currentUserId, selectedConversationId]);

    useEffect(() => {
        const convId = selectedConversationId;
        if (convId == null || !currentUserId) return;
        if (!conversationReadOnlyNotices[convId]) return;

        let cancelled = false;

        const tryRecoverConversation = async () => {
            try {
                const response = await chatService.getConversation(
                    convId,
                    currentUserId,
                );
                if (cancelled || !response.success || !response.data) return;

                const detailConversation = response.data;
                const detailNotice = resolveReadOnlyNoticeFromConversation(
                    detailConversation,
                    currentUserId,
                );
                if (detailNotice) return;

                chatRuntimeStore.setConversation(convId, detailConversation);
                setConversations((prev) => {
                    const exists = prev.some((conv) => conv.id === convId);
                    const next = exists
                        ? prev.map((conv) =>
                              conv.id === convId
                                  ? {
                                        ...conv,
                                        ...detailConversation,
                                        lastMessage:
                                            detailConversation.lastMessage ??
                                            conv.lastMessage,
                                        unreadCount:
                                            conv.unreadCount ??
                                            detailConversation.unreadCount,
                                    }
                                  : conv,
                          )
                        : [detailConversation, ...prev];

                    return sortConversationsByLastMessageAt(next);
                });
                setConversationReadOnlyNotices((prev) => {
                    if (!(convId in prev)) return prev;
                    const next = { ...prev };
                    delete next[convId];
                    return next;
                });
            } catch {
                // User is still blocked/removed, or backend has not committed the re-add yet.
            }
        };

        void tryRecoverConversation();
        const intervalId = window.setInterval(tryRecoverConversation, 5000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [
        conversationReadOnlyNotices,
        currentUserId,
        selectedConversationId,
    ]);

    /**
     * clearUnreadCount - Callback để ChatWindow gọi khi đánh dấu đã đọc
     * Dùng để clear unreadCount trên sidebar sau khi API markAsRead thành công
     */
    const clearUnreadCount = useCallback((conversationId: number) => {
        setConversations((prev) =>
            prev.map((conv) =>
                conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv,
            ),
        );
        clearConversationUnread(conversationId);
    }, [clearConversationUnread]);

    useEffect(() => {
        const unreadConversationIds = conversations
            .filter((conversation) => (conversation.unreadCount ?? 0) > 0)
            .map((conversation) => conversation.id);

        if (!currentUserId || unreadConversationIds.length === 0) return;

        let cancelled = false;
        const handleMessageSeen = (event: MessageSeenEvent) => {
            const payload = event.messageSeenResponse;
            if (Number(payload.userId) !== Number(currentUserId)) return;
            clearUnreadCount(Number(payload.conversationId));
        };

        const subscribe = async () => {
            await websocketService.connect();
            if (cancelled) return;
            unreadConversationIds.forEach((conversationId) => {
                websocketService.subscribeToConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        };

        void subscribe();

        return () => {
            cancelled = true;
            unreadConversationIds.forEach((conversationId) => {
                websocketService.unsubscribeFromConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        };
    }, [clearUnreadCount, conversations, currentUserId]);

    const refreshConversationById = useCallback(
        (
            conversationId: number,
            userId: number,
            preserveEmptyPendingRequests = false,
        ) => {
            const inFlight = refreshingConversationIdsRef.current;
            if (inFlight.has(conversationId)) return;

            inFlight.add(conversationId);
            chatService
                .getConversation(conversationId, userId)
                .then((response) => {
                    const responseData = response.data;
                    if (!response.success || !responseData) return;
                    const previousConversation =
                        chatRuntimeStore.getConversation(conversationId);
                    const nextResponseData =
                        preserveEmptyPendingRequests &&
                        Array.isArray(responseData.pendingRequests) &&
                        responseData.pendingRequests.length === 0
                            ? {
                                  ...responseData,
                                  pendingRequests:
                                      previousConversation?.pendingRequests ??
                                      responseData.pendingRequests,
                              }
                            : responseData;

                    chatRuntimeStore.setConversation(
                        conversationId,
                        nextResponseData,
                    );

                    setConversations((prev) => {
                        const existed = prev.some(
                            (conv) => conv.id === conversationId,
                        );
                        if (!existed) {
                            return sortConversationsByLastMessageAt([
                                nextResponseData,
                                ...prev,
                            ]);
                        }

                        return sortConversationsByLastMessageAt(
                            prev.map((conv) =>
                                conv.id === conversationId
                                    ? {
                                          ...conv,
                                          ...nextResponseData,
                                          lastMessage:
                                              nextResponseData.lastMessage ??
                                              conv.lastMessage,
                                          unreadCount:
                                              conv.unreadCount ??
                                              nextResponseData.unreadCount,
                                      }
                                    : conv,
                            ),
                        );
                    });
                })
                .catch((error) =>
                    console.error("Error refreshing conversation:", error),
                )
                .finally(() => {
                    inFlight.delete(conversationId);
                });
        },
        [],
    );

    const getProcessedJoinRequestId = useCallback(
        (conversation?: ConversationSnapshot): number | null => {
            const requestId = Number(conversation?.processedJoinRequestId);
            return Number.isFinite(requestId) ? requestId : null;
        },
        [],
    );

    const handleConversationUpdate = useCallback(
        (
            conversationId: number,
            lastMessage: LastMessageUpdate,
            conversationSnapshot?: ConversationSnapshot,
        ) => {
            // Callback này chạy khi có event từ websocket:
            // - Update lastMessage
            // - Tính lại unreadCount
            // - Sort list theo thời gian mới nhất
            const latestUserId = currentUserIdRef.current;
            const latestSelectedConversationId =
                selectedConversationIdRef.current;
            const processedJoinRequestId =
                getProcessedJoinRequestId(conversationSnapshot);
            if (processedJoinRequestId !== null) {
                chatRuntimeStore.removePendingRequests(conversationId, {
                    requestIds: [processedJoinRequestId],
                });
                setConversations((prevConversations) =>
                    sortConversationsByLastMessageAt(
                        prevConversations.map((conversation) =>
                            conversation.id === conversationId
                                ? {
                                      ...conversation,
                                      pendingRequests:
                                          conversation.pendingRequests?.filter(
                                              (request) =>
                                                  Number(request.id) !==
                                                  processedJoinRequestId,
                                          ) ?? conversation.pendingRequests,
                                  }
                                : conversation,
                        ),
                    ),
                );
                return;
            }

            const isMyMessage = lastMessage.lastSenderId === latestUserId;
            const isViewingThisConversation =
                latestSelectedConversationId === conversationId;

            // BE set read:true chỉ khi thu hồi, read:false cho tin nhắn mới
            const isRecallUpdate = lastMessage.read === true;
            const shouldRefreshSnapshot = GROUP_SYSTEM_SYNC_TYPES.has(
                lastMessage.lastMessageType,
            );
            const shouldForceDetailRefresh =
                lastMessage.lastMessageType === "SYSTEM_ADD_MEMBER" ||
                lastMessage.lastMessageType === "SYSTEM_UPDATE_ROLE" ||
                lastMessage.lastMessageType === "SYSTEM_UPDATE_SETTING" ||
                lastMessage.lastMessageType === "SYSTEM_REQUIRE_APPROVAL";
            const shouldPreserveEmptyPendingRequests =
                PRESERVE_EMPTY_PENDING_REQUEST_TYPES.has(
                    lastMessage.lastMessageType,
                );
            const snapshotReadOnlyNotice =
                resolveReadOnlyNoticeFromConversation(
                    conversationSnapshot,
                    latestUserId,
                );
            const messageReadOnlyNotice = resolveReadOnlyNoticeFromLastMessage(
                lastMessage,
                latestUserId,
            );

            setConversationReadOnlyNotices((prev) => {
                const next = { ...prev };
                const isUnlockingMessage =
                    lastMessage.lastMessageType === "SYSTEM_ADD_MEMBER" &&
                    safeParseMemberIds(lastMessage.lastMessageContent).some(
                        (id) => Number(id) === Number(latestUserId),
                    );
                    
                console.log("[DEBUG_READD] handleConversationUpdate notice eval", {
                    conversationId,
                    lastMessageType: lastMessage?.lastMessageType,
                    lastMessageContent: lastMessage?.lastMessageContent,
                    isUnlockingMessage,
                    snapshotReadOnlyNotice,
                    messageReadOnlyNotice
                });

                if (isUnlockingMessage) {
                    delete next[conversationId];
                    console.log("[DEBUG_READD] Cleared notice for unlocked message", next);
                    return next;
                }

                const resolvedNotice =
                    snapshotReadOnlyNotice ?? messageReadOnlyNotice;

                if (resolvedNotice) {
                    next[conversationId] = resolvedNotice;
                    return next;
                }

                if (conversationSnapshot) {
                    const currentMember = (
                        conversationSnapshot.members ?? []
                    ).find(
                        (member) =>
                            Number(member.userId) === Number(latestUserId),
                    );

                    if (
                        !currentMember ||
                        !currentMember.status ||
                        currentMember.status === "ACTIVE"
                    ) {
                        delete next[conversationId];
                    }
                }

                return next;
            });

            // Lưu ý: markAsRead API được gọi từ useChatWindowController (có lastMessageId đầy đủ)
            // Ở đây chỉ cập nhật unreadCount local

            setConversations((prevConversations) => {
                // Kiểm tra xem conversation có tồn tại trong list không
                const conversationExists = prevConversations.some(
                    (conv) => conv.id === conversationId,
                );

                // Nếu conversation KHÔNG tồn tại (đã bị xóa bởi delete-for-me)
                // → Fetch lại từ API và thêm vào list
                if (!conversationExists) {
                    if (conversationSnapshot) {
                        const snapshotWithLastMessage: Conversation = {
                            ...conversationSnapshot,
                            lastMessage: conversationSnapshot.lastMessage ?? {
                                lastMessageContent:
                                    lastMessage.lastMessageContent,
                                lastMessageType: lastMessage.lastMessageType,
                                lastSenderId: lastMessage.lastSenderId,
                                lastSenderName: lastMessage.lastSenderName,
                                lastMessageAt: lastMessage.lastMessageAt,
                                read: lastMessage.read,
                            },
                        };

                        const unreadCountFromSnapshot =
                            snapshotWithLastMessage.unreadCount ?? 0;
                        const nextUnreadCount =
                            isRecallUpdate ||
                            isMyMessage ||
                            isViewingThisConversation
                                ? unreadCountFromSnapshot
                                : unreadCountFromSnapshot > 0
                                  ? unreadCountFromSnapshot
                                  : 1;

                        return sortConversationsByLastMessageAt([
                            {
                                ...snapshotWithLastMessage,
                                unreadCount: nextUnreadCount,
                            },
                            ...prevConversations,
                        ]);
                    }

                    chatService
                        .getConversation(conversationId, latestUserId)
                        .then((response) => {
                            if (response.success && response.data) {
                                const newConv = response.data;
                                setConversations((prev) => {
                                    // Kiểm tra lại lần nữa để tránh duplicate
                                    if (
                                        prev.some(
                                            (conv) =>
                                                conv.id === conversationId,
                                        )
                                    ) {
                                        return prev;
                                    }

                                    // Thêm conversation vào đầu list và sort
                                    return sortConversationsByLastMessageAt([
                                        newConv,
                                        ...prev,
                                    ]);
                                });
                            }
                        })
                        .catch((e) =>
                            console.error("Error fetching conversation:", e),
                        );

                    // Return list hiện tại, conversation sẽ được thêm vào khi API trả về
                    return prevConversations;
                }

                // Conversation tồn tại → update như cũ
                const updatedConversations = prevConversations.map((conv) => {
                    if (conv.id !== conversationId) return conv;

                    const baseConversation =
                        conversationSnapshot &&
                        conversationSnapshot.id === conversationId
                            ? { ...conv, ...conversationSnapshot }
                            : conv;
                    const pendingRequests =
                        conversationSnapshot?.pendingRequests &&
                        conversationSnapshot.pendingRequests.length > 0
                            ? [
                                  ...(conv.pendingRequests ?? []).filter(
                                      (request) =>
                                          !conversationSnapshot.pendingRequests?.some(
                                              (nextRequest) =>
                                                  nextRequest.id === request.id,
                                          ),
                                  ),
                                  ...conversationSnapshot.pendingRequests,
                              ]
                            : baseConversation.pendingRequests;

                    let lastName = "";
                    if (baseConversation.type === "GROUP") {
                        lastName = lastMessage.lastSenderName;
                    }

                    let newUnreadCount: number;
                    if (isRecallUpdate) {
                        // Thu hồi: giữ nguyên unreadCount hiện tại.
                        // - Nếu đang có unread (> 0) → giữ bold, không tăng
                        // - Nếu không có unread (= 0) → không bold, không tăng
                        newUnreadCount = baseConversation.unreadCount || 0;
                    } else if (!isMyMessage) {
                        // Tin nhắn mới từ người khác:
                        // Đang xem thì reset 0, không xem thì +1.
                        newUnreadCount = isViewingThisConversation
                            ? 0
                            : (baseConversation.unreadCount || 0) + 1;
                    } else {
                        // Tin nhắn mới của chính mình: không thay đổi unreadCount
                        newUnreadCount = baseConversation.unreadCount || 0;
                    }

                    return {
                        ...baseConversation,
                        pendingRequests,
                        lastMessage: {
                            lastMessageContent: lastMessage.lastMessageContent,
                            lastMessageType: lastMessage.lastMessageType,
                            lastSenderId: lastMessage.lastSenderId,
                            lastSenderName:
                                lastMessage.lastSenderId !== latestUserId
                                    ? lastName
                                    : "Bạn",
                            lastMessageAt: lastMessage.lastMessageAt,
                            read: lastMessage.read,
                        },
                        unreadCount: newUnreadCount,
                    };
                });

                return sortConversationsByLastMessageAt(updatedConversations);
            });

            if (
                shouldRefreshSnapshot &&
                (shouldForceDetailRefresh || !conversationSnapshot)
            ) {
                refreshConversationById(
                    conversationId,
                    latestUserId,
                    shouldPreserveEmptyPendingRequests,
                );
            }
        },
        [getProcessedJoinRequestId, refreshConversationById],
    );

    // ====== WebSocket: subscribe updates cho list hội thoại ======
    useEffect(() => {
        const setupWebSocket = async () => {
            try {
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }
                websocketService.subscribeToUserConversations(
                    currentUserId,
                    handleConversationUpdate,
                );
            } catch (e) {
                console.error(
                    "Error setting up WebSocket for conversations:",
                    e,
                );
            }
        };

        void setupWebSocket();

        return () => {
            // Cleanup để tránh leak subscribe khi userId đổi/unmount.
            websocketService.unsubscribeFromUserConversations(
                currentUserId,
                handleConversationUpdate,
            );
        };
    }, [currentUserId, handleConversationUpdate]);

    const handleSelectConversation = useCallback(
        (convId: number) => {
            const selectedConv = conversations.find(
                (conv) => conv.id === convId,
            );
            if (selectedConv) {
                chatRuntimeStore.setConversation(convId, selectedConv);
            }
            // Chuyển route để ChatWindow load theo conversationId mới.
            navigate(`/messages/${convId}`);
        },
        [conversations, navigate],
    );

    const clearSelectedConversation = useCallback(() => {
        navigate(`/messages`);
    }, [navigate]);

    const normalizeSearchValue = useCallback((value: string) => {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }, []);

    const filteredConversations = useMemo(() => {
        // Filter theo searchQuery trên displayName.
        const trimmed = normalizeSearchValue(searchQuery.trim());
        const source = sortWithPinnedConversations(
            conversations,
            pinnedConversations,
        );
        if (!trimmed) return source;
        return source.filter((conv) => {
            const displayName =
                conv.name?.trim() ||
                (conv.type === "GROUP" ? "Nhóm chat" : "Người dùng");

            return normalizeSearchValue(displayName || "").includes(trimmed);
        });
    }, [conversations, normalizeSearchValue, pinnedConversations, searchQuery]);

    const getDisplayInfo = useCallback(
        (conv: Conversation) => {
            return getConversationDisplayInfo(conv, currentUserId);
        },
        [currentUserId],
    );

    const formatTime = useCallback((dateString: string) => {
        // Format thời gian kiểu "now / 5m / 2h / 3d / 27 thg 1".
        // UI dùng format ngắn để giống các app chat phổ biến.
        return formatConversationTime(dateString);
    }, []);

    // Xóa cuộc trò chuyện ở phía tôi (xóa khỏi danh sách sidebar)
    const handleDeleteConversationForMe = useCallback(
        async (conversationId: number) => {
            try {
                await chatService.deleteConversationForMe(
                    conversationId,
                    currentUserId,
                );
                // API 200 OK → xóa conversation khỏi local state
                setConversations((prev) =>
                    prev.filter((conv) => conv.id !== conversationId),
                );
                setConversationReadOnlyNotices((prev) => {
                    if (!(conversationId in prev)) return prev;
                    const next = { ...prev };
                    delete next[conversationId];
                    return next;
                });

                // Nếu đang xem conversation này → navigate về trang messages (không chọn conversation nào)
                if (selectedConversationId === conversationId) {
                    navigate(`/messages`);
                }
            } catch {
                console.error("Không thể xóa cuộc trò chuyện");
            }
        },
        [currentUserId, navigate, selectedConversationId],
    );

    const handleHideConversationForMe = useCallback(
        async (conversationId: number) => {
            try {
                await chatService.hideConversationForMe(
                    conversationId,
                    currentUserId,
                );
                setConversations((prev) =>
                    prev.filter((conv) => conv.id !== conversationId),
                );
                setConversationReadOnlyNotices((prev) => {
                    if (!(conversationId in prev)) return prev;
                    const next = { ...prev };
                    delete next[conversationId];
                    return next;
                });

                if (selectedConversationId === conversationId) {
                    navigate(`/messages`);
                }
            } catch {
                console.error("Không thể ẩn cuộc trò chuyện");
            }
        },
        [currentUserId, navigate, selectedConversationId],
    );

    const selectedConversationReadOnlyNotice =
        selectedConversationId != null
            ? (conversationReadOnlyNotices[selectedConversationId] ?? null)
            : null;

    return {
        searchQuery,
        setSearchQuery,
        loading,
        error,

        selectedConversationId,
        currentUserId,
        conversations,
        pinnedConversations,
        isPinLimitReached:
            pinnedConversations.length >= MAX_PINNED_CONVERSATIONS,

        filteredConversations,
        handleSelectConversation,
        clearSelectedConversation,
        handleDeleteConversationForMe,
        handleHideConversationForMe,
        getDisplayInfo,
        formatTime,
        clearUnreadCount,
        pinConversation,
        unpinConversation,
        replacePinnedConversation,
        fetchPinnedConversations,
        selectedConversationReadOnlyNotice,

        reload: loadConversations,
    };
}
