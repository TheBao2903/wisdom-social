import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import chatService from "@/services/chatService";
import chatWebsocketService from "@/services/chatWebsocketService";
import chatRuntimeStore, { type MembersByUserId } from "@/stores/chatRuntimeStore";
import type {
    Conversation,
    ConversationMember,
    LastMessage,
    Message,
} from "@/types/chat";

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

function toMembersByUserId(
    members: Record<string, ConversationMember>,
): MembersByUserId {
    const normalized: MembersByUserId = {};

    for (const [rawUserId, member] of Object.entries(members)) {
        const userId = Number(member?.userId ?? rawUserId);
        if (!Number.isFinite(userId) || !member) continue;

        normalized[userId] = {
            ...member,
            userId,
        };
    }

    return normalized;
}

function safeParseMemberIds(content: string): number[] {
    if (!content) return [];

    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((value: unknown) => {
                if (typeof value === "object" && value !== null && "id" in value) {
                    return Number((value as { id?: unknown }).id);
                }
                return Number(value);
            })
            .filter((value) => Number.isFinite(value));
    } catch {
        return [];
    }
}

function isCurrentUserRemovedByMessage(
    message: Message,
    currentUserId: number,
): boolean {
    if (message.type === "SYSTEM_DISBAND_GROUP") return true;

    if (message.type === "SYSTEM_LEAVE_GROUP") {
        return Number(message.senderId) === Number(currentUserId);
    }

    if (message.type === "SYSTEM_KICK_MEMBER" || message.type === "SYSTEM_BLOCK_MEMBER") {
        return safeParseMemberIds(message.content).some(
            (memberId) => Number(memberId) === Number(currentUserId),
        );
    }

    return false;
}

function isActiveMember(member?: ConversationMember): boolean {
    return Boolean(member && (!member.status || member.status === "ACTIVE"));
}

function canReviewJoinRequests(member?: ConversationMember): boolean {
    return (
        isActiveMember(member) &&
        (member?.role === "OWNER" || member?.role === "DEPUTY")
    );
}

interface UseGroupConversationRealtimeParams {
    conversationId: number;
    currentUserId: number;
    reloadConversations?: () => Promise<void>;
}

export function useGroupConversationRealtime({
    conversationId,
    currentUserId,
    reloadConversations,
}: UseGroupConversationRealtimeParams): void {
    const router = useRouter();
    const hasNavigatedAwayRef = useRef(false);

    useEffect(() => {
        if (!conversationId || !currentUserId) return;

        let disposed = false;
        let unsubscribe: (() => void) | undefined;
        const syncPendingRequests = async (
            membersById?: MembersByUserId,
        ): Promise<void> => {
            const currentMember =
                membersById?.[currentUserId] ??
                chatRuntimeStore.getMembers(conversationId)[currentUserId];

            if (!canReviewJoinRequests(currentMember)) return;

            const pendingRequests =
                await chatService.getPendingJoinRequests(conversationId);
            if (disposed) return;

            const previousConversation =
                chatRuntimeStore.getConversation(conversationId);
            if (!previousConversation) return;

            chatRuntimeStore.setConversation(conversationId, {
                ...previousConversation,
                pendingRequests,
            });
        };

        const handleUserConversationUpdate = (
            updatedConversationId: number,
            _lastMessage: LastMessage,
            conversationSnapshot?: Conversation & {
                processedJoinRequestId?: unknown;
            },
        ) => {
            if (updatedConversationId !== conversationId) return;

            const processedJoinRequestId = Number(
                conversationSnapshot?.processedJoinRequestId,
            );
            if (!Number.isFinite(processedJoinRequestId)) return;

            chatRuntimeStore.removePendingRequests(conversationId, {
                requestIds: [processedJoinRequestId],
            });
            void syncPendingRequests()
                .catch(() => undefined)
                .finally(() => {
                    void reloadConversations?.();
                });
        };

        const navigateAway = () => {
            if (hasNavigatedAwayRef.current) return;
            hasNavigatedAwayRef.current = true;
            router.replace("/(tabs)/activity");
        };

        const refreshSnapshot = async (message: Message) => {
            const memberSnapshotVersion =
                chatRuntimeStore.markMembersChanging(conversationId);

            try {
                const [conversationResponse, membersResponse] = await Promise.all([
                    chatService.getConversation(conversationId, currentUserId),
                    chatService.getConversationMembers(conversationId),
                ]);

                if (disposed) return;

                const membersById = toMembersByUserId(membersResponse);
                const acceptedMembers = chatRuntimeStore.setMembers(
                    conversationId,
                    membersById,
                    { memberSnapshotVersion },
                );

                let pendingRequests =
                    conversationResponse.success && conversationResponse.data
                        ? conversationResponse.data.pendingRequests
                        : undefined;
                let loadedPendingRequestsFromEndpoint = false;

                if (canReviewJoinRequests(acceptedMembers[currentUserId])) {
                    try {
                        pendingRequests =
                            await chatService.getPendingJoinRequests(
                                conversationId,
                            );
                        loadedPendingRequestsFromEndpoint = true;
                    } catch {
                        // Fall back to conversation detail when the dedicated endpoint is unavailable.
                    }
                }

                if (conversationResponse.success && conversationResponse.data) {
                    const previousConversation =
                        chatRuntimeStore.getConversation(conversationId);
                    const shouldPreservePendingRequests =
                        !loadedPendingRequestsFromEndpoint &&
                        PRESERVE_EMPTY_PENDING_REQUEST_TYPES.has(message.type) &&
                        Array.isArray(pendingRequests) &&
                        pendingRequests.length === 0;
                    const nextConversation: Conversation = {
                        ...conversationResponse.data,
                        pendingRequests: shouldPreservePendingRequests
                            ? previousConversation?.pendingRequests ??
                              pendingRequests
                            : pendingRequests,
                        members: Object.values(acceptedMembers),
                    };

                    chatRuntimeStore.setConversation(
                        conversationId,
                        nextConversation,
                        { memberSnapshotVersion },
                    );
                }

                if (!isActiveMember(acceptedMembers[currentUserId])) {
                    navigateAway();
                    return;
                }

                await reloadConversations?.();
            } catch {
                if (isCurrentUserRemovedByMessage(message, currentUserId)) {
                    navigateAway();
                }
            }
        };

        const setup = async () => {
            try {
                if (!chatWebsocketService.isConnected()) {
                    await chatWebsocketService.connect();
                }

                if (disposed) return;

                unsubscribe = chatWebsocketService.subscribeToConversationMessages(
                    conversationId,
                    (message) => {
                        if (!GROUP_SYSTEM_SYNC_TYPES.has(message.type)) return;

                        if (isCurrentUserRemovedByMessage(message, currentUserId)) {
                            navigateAway();
                            return;
                        }

                        void refreshSnapshot(message);
                    },
                );
                chatWebsocketService.subscribeToUserConversations(
                    currentUserId,
                    handleUserConversationUpdate,
                );
            } catch {
                // The screen still has the normal conversation-list subscription as fallback.
            }
        };

        void setup();

        return () => {
            disposed = true;
            unsubscribe?.();
            chatWebsocketService.unsubscribeFromUserConversations(
                currentUserId,
                handleUserConversationUpdate,
            );
        };
    }, [conversationId, currentUserId, reloadConversations, router]);
}
