import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, DeviceEventEmitter } from "react-native";
import chatService, { isMaxPinLimitError } from "@/services/chatService";
import chatWebsocketService from "@/services/chatWebsocketService";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import type {
    Conversation,
    ConversationMember,
    ConversationPin,
    ConversationSidebar,
    Message,
    MessageSeenEvent,
} from "@/types/chat";
import { useAppContext } from "@/context/AppContext";
import { useFocusEffect } from "@react-navigation/native";

// Module-level ref: track which conversation is currently open on screen.
// Set by useChatWindowController (via setActiveConversationId) when entering/leaving a chat.
// Mirrors web's selectedConversationIdRef (derived from URL) for unread logic.
const activeConversationIdRef = { current: null as number | null };
type UnlockListener = (conversationId: number) => void;
const unlockListeners = new Set<UnlockListener>();
const refreshingConversationIds = new Set<number>();

const GROUP_SYSTEM_SYNC_TYPES = new Set<Message["type"]>([
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

const PRESERVE_EMPTY_PENDING_REQUEST_TYPES = new Set<Message["type"]>([
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
            .filter((value: number) => Number.isFinite(value));
    } catch {
        return [];
    }
}

export function setActiveConversationId(id: number | null): void {
    activeConversationIdRef.current = id;
}

export function onConversationUnlocked(listener: UnlockListener): () => void {
    unlockListeners.add(listener);
    return () => unlockListeners.delete(listener);
}

function emitConversationUnlocked(conversationId: number): void {
    for (const listener of unlockListeners) {
        listener(conversationId);
    }
}

function getConversationSortTime(conversation: Conversation): number {
    const lastMessageTime = conversation.lastMessage?.lastMessageAt
        ? new Date(conversation.lastMessage.lastMessageAt).getTime()
        : 0;
    const updatedAtTime = conversation.updatedAt
        ? new Date(conversation.updatedAt).getTime()
        : 0;

    return Math.max(lastMessageTime, updatedAtTime, 0);
}

function sortConversationsByLatest(
    conversations: Conversation[],
): Conversation[] {
    return [...conversations].sort(
        (a, b) => getConversationSortTime(b) - getConversationSortTime(a),
    );
}

function resolveLastMessageAt(lastMessage: Conversation["lastMessage"]): string {
    if (!lastMessage) return new Date().toISOString();

    const candidate =
        lastMessage.lastMessageAt ||
        (lastMessage as unknown as { createdAt?: string }).createdAt ||
        (lastMessage as unknown as { updatedAt?: string }).updatedAt ||
        (lastMessage as unknown as { timestamp?: string }).timestamp;

    if (candidate && !Number.isNaN(new Date(candidate).getTime())) {
        return candidate;
    }

    return new Date().toISOString();
}

function isSeenAtCurrentForConversation(
    conversation: Conversation | undefined,
    seenAt?: string,
): boolean {
    if (!conversation?.lastMessage?.lastMessageAt || !seenAt) return false;

    const seenTime = new Date(seenAt).getTime();
    const lastMessageTime = new Date(conversation.lastMessage.lastMessageAt).getTime();
    if (Number.isNaN(seenTime) || Number.isNaN(lastMessageTime)) return false;

    return seenTime >= lastMessageTime;
}

function shouldShowInConversationList(conversation: Conversation): boolean {
    if (String(conversation.type).toUpperCase() !== "DIRECT") return true;
    const lastMessage = conversation.lastMessage;
    return Boolean(
        lastMessage?.lastMessageContent?.trim() ||
            (lastMessage?.lastMessageType &&
                lastMessage.lastMessageType !== "SYSTEM_CREATE_GROUP")
    );
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

function mergeMemberLists(
    baseMembers: ConversationMember[] = [],
    incomingMembers: ConversationMember[] = [],
): ConversationMember[] {
    const merged = new Map<number, ConversationMember>();

    const upsert = (member: ConversationMember) => {
        const userId = Number(member.userId);
        if (!Number.isFinite(userId)) return;

        const existing = merged.get(userId);
        if (!existing) {
            merged.set(userId, { ...member, userId });
            return;
        }

        const incomingHasIdentity = hasUsefulMemberIdentity(member);
        const existingHasIdentity = hasUsefulMemberIdentity(existing);

        merged.set(userId, {
            ...existing,
            ...member,
            userId,
            nickname:
                incomingHasIdentity || !existingHasIdentity
                    ? member.nickname || existing.nickname
                    : existing.nickname,
            username:
                incomingHasIdentity || !existingHasIdentity
                    ? member.username || existing.username
                    : existing.username,
            avatar:
                incomingHasIdentity || !existingHasIdentity
                    ? member.avatar || existing.avatar
                    : existing.avatar,
            accountLocked: Boolean(member.accountLocked),
        });
    };

    baseMembers.forEach(upsert);
    incomingMembers.forEach(upsert);
    return Array.from(merged.values());
}

function mergeMembersIntoConversation(
    conversation: Conversation,
    membersByUserId?: Record<string, ConversationMember> | null,
): Conversation {
    const apiMembers = membersByUserId ? Object.values(membersByUserId) : [];
    if (!conversation.members?.length && apiMembers.length === 0) {
        return conversation;
    }

    return {
        ...conversation,
        members: mergeMemberLists(conversation.members ?? [], apiMembers),
    };
}

function mergeConversationDetails(
    preferred: Conversation,
    fallback: Conversation,
): Conversation {
    const preferredClearsPendingRequestsFromSync =
        preferred.lastMessage &&
        PRESERVE_EMPTY_PENDING_REQUEST_TYPES.has(
            preferred.lastMessage.lastMessageType,
        ) &&
        Array.isArray(preferred.pendingRequests) &&
        preferred.pendingRequests.length === 0;

    return {
        ...fallback,
        ...preferred,
        members:
            preferred.members || fallback.members
                ? mergeMemberLists(fallback.members ?? [], preferred.members ?? [])
                : undefined,
        pinnedMessages: preferred.pinnedMessages ?? fallback.pinnedMessages,
        pendingRequests: preferredClearsPendingRequestsFromSync
            ? fallback.pendingRequests ?? preferred.pendingRequests
            : preferred.pendingRequests ?? fallback.pendingRequests,
        lastMessage: preferred.lastMessage ?? fallback.lastMessage,
        unreadCount: Math.max(preferred.unreadCount ?? 0, fallback.unreadCount ?? 0),
    };
}

function mergePendingRequestsForSocketUpdate(
    currentRequests: Conversation["pendingRequests"],
    incomingRequests: Conversation["pendingRequests"],
    lastMessageType: Message["type"],
): Conversation["pendingRequests"] {
    if (!incomingRequests) return currentRequests;

    if (
        PRESERVE_EMPTY_PENDING_REQUEST_TYPES.has(lastMessageType) &&
        incomingRequests.length === 0
    ) {
        return currentRequests ?? incomingRequests;
    }

    if (incomingRequests.length === 0) return incomingRequests;

    return [
        ...(currentRequests ?? []).filter(
            (request) =>
                !incomingRequests.some(
                    (nextRequest) => nextRequest.id === request.id,
                ),
        ),
        ...incomingRequests,
    ];
}

function chooseLatestConversation(
    left: Conversation,
    right: Conversation,
): Conversation {
    const leftTime = getConversationSortTime(left);
    const rightTime = getConversationSortTime(right);

    if (rightTime > leftTime) return mergeConversationDetails(right, left);
    if (rightTime < leftTime) return mergeConversationDetails(left, right);

    // If timestamps are equal, preserve the higher unread value to avoid
    // stale runtime patches dropping bold/badge state.
    const leftUnread = left.unreadCount ?? 0;
    const rightUnread = right.unreadCount ?? 0;
    if (rightUnread > leftUnread) return mergeConversationDetails(right, left);
    if (rightUnread < leftUnread) return mergeConversationDetails(left, right);

    return mergeConversationDetails(right, left);
}

function mergeConversationsByFreshness(
    sources: Conversation[][],
): Conversation[] {
    const byId = new Map<number, Conversation>();

    for (const source of sources) {
        for (const conversation of source) {
            const previous = byId.get(conversation.id);
            if (!previous) {
                byId.set(conversation.id, conversation);
                continue;
            }

            byId.set(
                conversation.id,
                chooseLatestConversation(previous, conversation),
            );
        }
    }

    return sortConversationsByLatest(Array.from(byId.values()));
}

function toConversationFromSidebar(
    conversation: ConversationSidebar,
): Conversation {
    const {
        members: _members,
        pinnedMessages: _pinnedMessages,
        ...sidebarConversation
    } = conversation as Conversation;

    return { ...sidebarConversation };
}

function getProcessedJoinRequestId(
    conversation?: Conversation,
): number | null {
    const value = (
        conversation as (Conversation & { processedJoinRequestId?: unknown }) | undefined
    )?.processedJoinRequestId;
    const requestId = Number(value);
    return Number.isFinite(requestId) ? requestId : null;
}

export function useMessagesController() {
    const [searchQuery, setSearchQuery] = useState("");
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [pinnedConversations, setPinnedConversations] = useState<
        ConversationPin[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { currentUser } = useAppContext();
    const currentUserId = Number(currentUser?.id ?? 0);

    const currentUserIdRef = useRef(currentUserId);
    const presenceHydratedConversationIdsRef = useRef<Set<number>>(new Set());
    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    // Cập nhật SIDEBAR realtime khi 1 thành viên bị khóa/mở khóa tài khoản
    // (mask/bỏ mask tên + avatar) mà không cần F5.
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            "conversation-member-lock-changed",
            (detail: {
                conversationId?: number;
                userId?: number | null;
                accountLocked?: boolean;
            }) => {
                if (!detail || typeof detail.conversationId !== "number") return;
                const lockedUserId = Number(detail.userId);
                const accountLocked = Boolean(detail.accountLocked);

                setConversations((prev) =>
                    prev.map((conversation) => {
                        if (conversation.id !== detail.conversationId)
                            return conversation;

                        const members = conversation.members?.map((member) =>
                            Number(member.userId) === lockedUserId
                                ? { ...member, accountLocked }
                                : member,
                        );

                        return {
                            ...conversation,
                            members: members ?? conversation.members,
                            directPartnerLocked:
                                conversation.type === "DIRECT" &&
                                Number(conversation.directPartnerId) ===
                                    lockedUserId
                                    ? accountLocked
                                    : conversation.directPartnerLocked,
                        };
                    }),
                );
            },
        );
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            "conversation-direct-block-status-changed",
            (detail: {
                conversationId?: number;
                blockerId?: number | null;
                blockedId?: number | null;
                blocked?: boolean;
            }) => {
                if (!detail || typeof detail.conversationId !== "number") return;

                setConversations((prev) =>
                    prev.map((conversation) => {
                        if (
                            conversation.id !== detail.conversationId ||
                            conversation.type !== "DIRECT"
                        ) {
                            return conversation;
                        }

                        const nextConversation = {
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
                        chatRuntimeStore.setConversation(conversation.id, nextConversation);
                        return nextConversation;
                    }),
                );
            },
        );
        return () => subscription.remove();
    }, []);

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

        // Sidebar cũ có thể thiếu members/directPartnerId, hydrate nền để chấm xanh hiện ngay trên list.
        missingPresenceConversations.forEach((conversation) =>
            presenceHydratedConversationIdsRef.current.add(conversation.id),
        );

        let cancelled = false;
        Promise.all(
            missingPresenceConversations.map((conversation) =>
                Promise.all([
                    chatService.getConversation(conversation.id, currentUserId),
                    chatService
                        .getConversationMembers(conversation.id)
                        .catch(() => null),
                ])
                    .then(([response, membersByUserId]) =>
                        response.data
                            ? mergeMembersIntoConversation(
                                  response.data,
                                  membersByUserId,
                              )
                            : null,
                    )
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
                    const next = {
                        ...conversation,
                        ...detail,
                        lastMessage: conversation.lastMessage ?? detail.lastMessage,
                        unreadCount: conversation.unreadCount ?? detail.unreadCount,
                    };
                    chatRuntimeStore.setConversation(conversation.id, next);
                    return next;
                }),
            );
        });

        return () => {
            cancelled = true;
        };
    }, [conversations, currentUserId]);

    useFocusEffect(
        useCallback(() => {
            setActiveConversationId(null);
        }, []),
    );

    const loadConversations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const cachedConversations = chatRuntimeStore.getAllConversations();
            if (cachedConversations.length > 0) {
                setConversations(
                    sortConversationsByLatest(
                        cachedConversations.filter(shouldShowInConversationList),
                    ),
                );
            }

            const [response, pins] = await Promise.all([
                chatService.getConversations(currentUserId),
                chatService.fetchPinnedConversations(),
            ]);
            setPinnedConversations(pins);
            if (response.success && response.data) {
                const sidebarConversations = response.data.map(
                    toConversationFromSidebar,
                );
                const merged = mergeConversationsByFreshness([
                    sidebarConversations,
                    chatRuntimeStore
                        .getAllConversations()
                        .filter(shouldShowInConversationList),
                ]);

                setConversations(
                    sortWithPinnedConversations(
                        merged.filter(shouldShowInConversationList),
                        pins,
                    ),
                );
                merged.forEach((conversation) => {
                    chatRuntimeStore.setConversation(
                        conversation.id,
                        conversation,
                    );
                });
                return;
            }

            setConversations([]);
            setError(response.message || "Không thể tải danh sách hội thoại");
        } catch {
            setConversations([]);
            setError("Không thể tải danh sách hội thoại");
        } finally {
            setLoading(false);
        }
    }, [currentUserId]);

    useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

    const fetchPinnedConversations = useCallback(async () => {
        const pins = await chatService.fetchPinnedConversations();
        setPinnedConversations(pins);
        setConversations((prev) => sortWithPinnedConversations(prev, pins));
        return pins;
    }, []);

    const [onPinLimitReachedRef] = useState<{ current: ((conversationId: number) => void) | null }>({ current: null });

    const registerPinLimitCallback = useCallback(
        (cb: ((conversationId: number) => void) | null) => {
            onPinLimitReachedRef.current = cb;
        },
        [onPinLimitReachedRef],
    );

    const showMaxPinLimitAlert = useCallback(
        (conversationId: number) => {
            if (onPinLimitReachedRef.current) {
                onPinLimitReachedRef.current(conversationId);
            } else {
                Alert.alert(
                    "Thông báo",
                    `Bạn chỉ được ghim tối đa ${MAX_PINNED_CONVERSATIONS} cuộc hội thoại. Hãy bỏ ghim 1 cuộc hội thoại trước.`,
                );
            }
        },
        [onPinLimitReachedRef],
    );

    const pinConversation = useCallback(
        async (conversationId: number) => {
            const conversation = conversations.find(
                (item) => item.id === conversationId,
            );
            if (!conversation) return false;

            if (
                pinnedConversations.length >= MAX_PINNED_CONVERSATIONS &&
                !pinnedConversations.some(
                    (pin) => pin.conversationId === conversationId,
                )
            ) {
                showMaxPinLimitAlert(conversationId);
                return false;
            }

            const previousPins = pinnedConversations;
            const nextPins: ConversationPin[] = [
                {
                    conversationId,
                    pinnedAt: new Date().toISOString(),
                    conversation,
                },
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
                    showMaxPinLimitAlert(conversationId);
                } else {
                    setError("Không thể ghim cuộc trò chuyện");
                }
                return false;
            }
        },
        [conversations, pinnedConversations, showMaxPinLimitAlert],
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
                setError("Không thể bỏ ghim cuộc trò chuyện");
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
                    showMaxPinLimitAlert(conversationIdToPin);
                }
                return false;
            }
        },
        [
            conversations,
            pinnedConversations,
            showMaxPinLimitAlert,
        ],
    );

    useEffect(() => {
        return chatRuntimeStore.subscribeConversationChanges(
            (updatedConversation) => {
                setConversations((prev) => {
                    if (!shouldShowInConversationList(updatedConversation)) {
                        return prev.filter(
                            (conversation) =>
                                conversation.id !== updatedConversation.id,
                        );
                    }

                    const exists = prev.some(
                        (conversation) =>
                            conversation.id === updatedConversation.id,
                    );

                    if (!exists) {
                        return sortConversationsByLatest([
                            updatedConversation,
                            ...prev,
                        ].filter(shouldShowInConversationList));
                    }

                    return sortConversationsByLatest(
                        prev.map((conversation) =>
                            conversation.id === updatedConversation.id
                                ? {
                                      ...conversation,
                                      ...updatedConversation,
                                      members:
                                          updatedConversation.members ??
                                          conversation.members,
                                      pinnedMessages:
                                          updatedConversation.pinnedMessages ??
                                          conversation.pinnedMessages,
                                      pendingRequests:
                                          updatedConversation.pendingRequests ??
                                          conversation.pendingRequests,
                                      lastMessage:
                                          updatedConversation.lastMessage ??
                                          conversation.lastMessage,
                                      unreadCount: Math.max(
                                          updatedConversation.unreadCount ?? 0,
                                          conversation.unreadCount ?? 0,
                                      ),
                                  }
                                : conversation,
                        ).filter(shouldShowInConversationList),
                    );
                });
            },
        );
    }, []);

    const refreshConversationById = useCallback(
        (
            conversationId: number,
            userId: number,
            memberSnapshotVersion?: number,
            preserveEmptyPendingRequests = false,
        ) => {
            if (!conversationId || !userId) return;

            if (refreshingConversationIds.has(conversationId)) return;

            refreshingConversationIds.add(conversationId);
            Promise.all([
                chatService.getConversation(conversationId, userId),
                chatService
                    .getConversationMembers(conversationId)
                    .catch(() => null),
            ])
                .then(([response, membersByUserId]) => {
                    const responseData = response.data;
                    if (!response.success || !responseData) return;
                    const responseWithMembers = mergeMembersIntoConversation(
                        responseData,
                        membersByUserId,
                    );

                    const previousConversation =
                        chatRuntimeStore.getConversation(conversationId);
                    const nextResponseData =
                        preserveEmptyPendingRequests &&
                        Array.isArray(responseWithMembers.pendingRequests) &&
                        responseWithMembers.pendingRequests.length === 0
                            ? {
                                  ...responseWithMembers,
                                  pendingRequests:
                                      previousConversation?.pendingRequests ??
                                      responseWithMembers.pendingRequests,
                              }
                            : responseWithMembers;

                    const runtimeConversation = chatRuntimeStore.setConversation(
                        conversationId,
                        nextResponseData,
                        { memberSnapshotVersion },
                    );

                    setConversations((prev) => {
                        const exists = prev.some(
                            (conversation) =>
                                conversation.id === conversationId,
                        );

                        const nextConversation = exists
                            ? undefined
                            : runtimeConversation;

                        const next = exists
                            ? prev.map((conversation) =>
                                  conversation.id === conversationId
                                      ? mergeConversationDetails(
                                            runtimeConversation,
                                            conversation,
                                        )
                                      : conversation,
                              )
                            : [nextConversation!, ...prev];

                        return sortConversationsByLatest(next);
                    });
                })
                .catch(() => undefined)
                .finally(() => {
                    refreshingConversationIds.delete(conversationId);
                });
        },
        [],
    );

    const handleConversationUpdate = useCallback(
        (
            conversationId: number,
            lastMessage: Conversation["lastMessage"],
            conversationSnapshot?: Conversation,
        ) => {
            if (!lastMessage) return;

            const latestUserId = currentUserIdRef.current;
            const processedJoinRequestId =
                getProcessedJoinRequestId(conversationSnapshot);
            if (processedJoinRequestId !== null) {
                chatRuntimeStore.removePendingRequests(conversationId, {
                    requestIds: [processedJoinRequestId],
                });
                setConversations((prev) =>
                    sortConversationsByLatest(
                        prev.map((conversation) =>
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

            const rawSenderId =
                lastMessage.lastSenderId ??
                (lastMessage as unknown as { senderId?: unknown }).senderId ??
                (lastMessage as unknown as { sender?: { id?: unknown } }).sender?.id;
            const normalizedSenderId = Number(rawSenderId);
            const isMyMessage = Number.isFinite(normalizedSenderId)
                ? normalizedSenderId === latestUserId
                : rawSenderId === latestUserId;
            const readFlagRaw =
                (
                    lastMessage as unknown as {
                        read?: unknown;
                        isRead?: unknown;
                    }
                ).read ??
                (
                    lastMessage as unknown as {
                        read?: unknown;
                        isRead?: unknown;
                    }
                ).isRead;
            const isReadUpdate =
                readFlagRaw === true ||
                readFlagRaw === "true" ||
                readFlagRaw === 1 ||
                readFlagRaw === "1";
            const normalizedLastMessage = {
                ...lastMessage,
                lastMessageAt: resolveLastMessageAt(lastMessage),
                read: isReadUpdate,
            };
            const shouldRefreshSnapshot = GROUP_SYSTEM_SYNC_TYPES.has(
                normalizedLastMessage.lastMessageType,
            );
            const shouldForceDetailRefresh =
                normalizedLastMessage.lastMessageType === "SYSTEM_UPDATE_ROLE" ||
                normalizedLastMessage.lastMessageType === "SYSTEM_UPDATE_SETTING" ||
                normalizedLastMessage.lastMessageType === "SYSTEM_REQUIRE_APPROVAL";
            const shouldPreserveEmptyPendingRequests =
                PRESERVE_EMPTY_PENDING_REQUEST_TYPES.has(
                    normalizedLastMessage.lastMessageType,
                );
            const memberSnapshotVersion = shouldRefreshSnapshot
                ? chatRuntimeStore.markMembersChanging(conversationId)
                : undefined;

            const isUnlockingMessage =
                lastMessage.lastMessageType === "SYSTEM_ADD_MEMBER" &&
                safeParseMemberIds(lastMessage.lastMessageContent ?? "").some(
                    (id: string | number) => Number(id) === Number(latestUserId)
                );

            if (isUnlockingMessage) {
                emitConversationUnlocked(conversationId);
            }

            setConversations((prev) => {
                const exists = prev.some((conv) => conv.id === conversationId);
                if (!exists) {
                    if (conversationSnapshot) {
                        const unreadCountFromSnapshot =
                            conversationSnapshot.unreadCount ?? 0;
                        const nextUnreadCount =
                            isReadUpdate || isMyMessage
                                ? unreadCountFromSnapshot
                                : unreadCountFromSnapshot > 0
                                  ? unreadCountFromSnapshot
                                  : 1;

                        const snapshotWithLastMessage: Conversation = {
                            ...conversationSnapshot,
                            lastMessage:
                                conversationSnapshot.lastMessage ??
                                normalizedLastMessage,
                            unreadCount: nextUnreadCount,
                        };

                        const runtimeConversation = chatRuntimeStore.setConversation(
                            conversationId,
                            snapshotWithLastMessage,
                            memberSnapshotVersion !== undefined
                                ? { memberSnapshotVersion }
                                : undefined,
                        );

                        return sortConversationsByLatest([
                            runtimeConversation,
                            ...prev,
                        ]);
                    }

                    void chatService
                        .getConversation(conversationId, latestUserId)
                        .then((response) => {
                            const conversation = response.data;
                            if (!response.success || !conversation) return;

                            setConversations((innerPrev) => {
                                if (
                                    innerPrev.some(
                                        (conv) => conv.id === conversationId,
                                    )
                                ) {
                                    return innerPrev;
                                }

                                const runtimeConversation =
                                    chatRuntimeStore.setConversation(
                                        conversation.id,
                                        conversation,
                                    );

                                return sortConversationsByLatest([
                                    runtimeConversation,
                                    ...innerPrev,
                                ]);
                            });
                        })
                        .catch(() => undefined);

                    return prev;
                }

                // Kiểm tra xem user có đang mở conversation này không.
                // Giống web: nếu đang xem thì không tăng unreadCount.
                const isViewingThisConversation =
                    activeConversationIdRef.current === conversationId;

                const next = prev.map((conv) => {
                    if (conv.id !== conversationId) return conv;

                    const isGroup = conv.type === "GROUP";
                    const mergedSnapshot =
                        conversationSnapshot &&
                        conversationSnapshot.id === conversationId
                            ? { ...conversationSnapshot }
                            : undefined;

                    // Khi nhận được snapshot từ WebSocket, chúng ta phải giữ nguyên name và imageUrl hiện tại
                    // nếu đó là conversation nhóm và backend đang tự ý map thành tên cá nhân.
                    if (isGroup && mergedSnapshot) {
                        if (
                            mergedSnapshot.name !== undefined &&
                            mergedSnapshot.name !== null &&
                            !mergedSnapshot.name.trim()
                        ) {
                            mergedSnapshot.name = conv.name;
                        }
                        if (
                            mergedSnapshot.imageUrl !== undefined &&
                            mergedSnapshot.imageUrl !== null &&
                            !mergedSnapshot.imageUrl.trim()
                        ) {
                            mergedSnapshot.imageUrl = conv.imageUrl;
                        }
                    }

                    const baseConversation = mergedSnapshot
                        ? { ...conv, ...mergedSnapshot }
                        : conv;
                    const currentUnreadCount = conv.unreadCount || 0;
                    const pendingRequests =
                        mergedSnapshot &&
                        "pendingRequests" in mergedSnapshot
                            ? mergePendingRequestsForSocketUpdate(
                                  conv.pendingRequests,
                                  mergedSnapshot.pendingRequests,
                                  normalizedLastMessage.lastMessageType,
                              )
                            : baseConversation.pendingRequests;

                    let newUnreadCount: number;
                    if (!isMyMessage) {
                        // Tin nhắn mới từ người khác:
                        // Đang xem conversation → reset 0; không xem → +1.
                        newUnreadCount = isViewingThisConversation
                            ? 0
                            : currentUnreadCount + 1;
                    } else if (isReadUpdate) {
                        // Thu hồi tin nhắn: giữ nguyên unreadCount hiện tại.
                        newUnreadCount = baseConversation.unreadCount || 0;
                    } else {
                        // Tin nhắn của chính mình: không thay đổi unreadCount.
                        newUnreadCount = baseConversation.unreadCount || 0;
                    }

                    return {
                        ...baseConversation,
                        pendingRequests,
                        updatedAt: lastMessage.lastMessageAt,
                        lastMessage: normalizedLastMessage,
                        unreadCount: newUnreadCount,
                    };
                });

                const updatedConversation = next.find(
                    (conv) => conv.id === conversationId,
                );
                let runtimeConversation: Conversation | null = null;
                if (updatedConversation) {
                    runtimeConversation = chatRuntimeStore.setConversation(
                        conversationId,
                        updatedConversation,
                        conversationSnapshot &&
                            memberSnapshotVersion !== undefined
                            ? { memberSnapshotVersion }
                            : undefined,
                    );
                }

                if (!runtimeConversation) {
                    return sortConversationsByLatest(next);
                }

                return sortConversationsByLatest(
                    next.map((conv) =>
                        conv.id === conversationId
                            ? mergeConversationDetails(
                                  runtimeConversation!,
                                  conv,
                              )
                            : conv,
                    ),
                );
            });

            if (
                shouldRefreshSnapshot &&
                (shouldForceDetailRefresh ||
                    !conversationSnapshot ||
                    !conversationSnapshot.members)
            ) {
                refreshConversationById(
                    conversationId,
                    latestUserId,
                    memberSnapshotVersion,
                    shouldPreserveEmptyPendingRequests,
                );
            }
        },
        [refreshConversationById],
    );

    useFocusEffect(
        useCallback(() => {
            let disposed = false;
            let retryTimeout: ReturnType<typeof setTimeout> | null = null;
            let syncInterval: ReturnType<typeof setInterval> | null = null;

            const setup = async () => {
                try {
                    if (disposed) return;

                    const wasConnected = chatWebsocketService.isConnected();
                    if (!wasConnected) {
                        await chatWebsocketService.connect();
                    }

                    if (disposed) return;

                    chatWebsocketService.subscribeToUserConversations(
                        currentUserId,
                        handleConversationUpdate,
                    );

                    // Re-sync when the screen regains focus so stack screens
                    // don't keep stale members/roles after child screens update.
                    void loadConversations();
                    if (!syncInterval) {
                        syncInterval = setInterval(() => {
                            void loadConversations();
                        }, 10000);
                    }
                } catch {
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
                if (syncInterval) {
                    clearInterval(syncInterval);
                }
                chatWebsocketService.unsubscribeFromUserConversations(
                    currentUserId,
                    handleConversationUpdate,
                );
            };
        }, [currentUserId, handleConversationUpdate, loadConversations]),
    );

    const normalizeSearchValue = useCallback((value: string) => {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }, []);

    const filteredConversations = useMemo(() => {
        const query = normalizeSearchValue(searchQuery.trim());
        const source = sortWithPinnedConversations(
            conversations.filter(shouldShowInConversationList),
            pinnedConversations,
        );
        if (!query) return source;

        return source.filter((conversation) => {
            const candidate = [
                conversation.name,
                conversation.lastMessage?.lastMessageContent,
            ]
                .filter(Boolean)
                .join(" ")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

            return candidate.includes(query);
        });
    }, [conversations, normalizeSearchValue, pinnedConversations, searchQuery]);

    const clearUnreadCount = useCallback((conversationId: number) => {
        setConversations((prev) =>
            prev.map((conv) =>
                conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv,
            ),
        );

        chatRuntimeStore.patchConversation(conversationId, {
            unreadCount: 0,
        });
    }, []);

    useEffect(() => {
        const unreadConversationIds = conversations
            .filter((conversation) => (conversation.unreadCount ?? 0) > 0)
            .map((conversation) => conversation.id);

        if (!currentUserId || unreadConversationIds.length === 0) return;

        let disposed = false;
        const handleMessageSeen = (event: MessageSeenEvent) => {
            const payload = event.messageSeenResponse;
            if (Number(payload.userId) !== Number(currentUserId)) return;
            const conversationId = Number(payload.conversationId);
            const conversation = conversations.find(
                (item) => item.id === conversationId,
            );
            if (!isSeenAtCurrentForConversation(conversation, payload.seenAt)) {
                return;
            }
            clearUnreadCount(conversationId);
        };

        void chatWebsocketService.connect().then(() => {
            if (disposed) return;
            unreadConversationIds.forEach((conversationId) => {
                chatWebsocketService.subscribeToConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        }).catch(() => undefined);

        return () => {
            disposed = true;
            unreadConversationIds.forEach((conversationId) => {
                chatWebsocketService.unsubscribeFromConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        };
    }, [clearUnreadCount, conversations, currentUserId]);

    const deleteConversationForMe = useCallback(
        async (conversationId: number) => {
            try {
                await chatService.deleteConversationForMe(
                    conversationId,
                    currentUserId,
                );

                setConversations((prev) =>
                    prev.filter((conv) => conv.id !== conversationId),
                );
            } catch {
            setError("Không thể xóa cuộc trò chuyện");
            }
        },
        [currentUserId],
    );

    const hideConversationForMe = useCallback(
        async (conversationId: number) => {
            try {
                await chatService.hideConversationForMe(
                    conversationId,
                    currentUserId,
                );

                setConversations((prev) =>
                    prev.filter((conv) => conv.id !== conversationId),
                );
            } catch {
                setError("Không thể ẩn cuộc trò chuyện");
            }
        },
        [currentUserId],
    );

    return {
        searchQuery,
        setSearchQuery,
        conversations,
        pinnedConversations,
        isPinLimitReached:
            pinnedConversations.length >= MAX_PINNED_CONVERSATIONS,
        filteredConversations,
        loading,
        error,
        currentUserId,
        clearUnreadCount,
        pinConversation,
        unpinConversation,
        replacePinnedConversation,
        fetchPinnedConversations,
        deleteConversationForMe,
        hideConversationForMe,
        reload: loadConversations,
        registerPinLimitCallback,
        maxPinnedConversations: MAX_PINNED_CONVERSATIONS,
    };
}
