import type {
    Conversation,
    ConversationMember,
    Message,
    PinnedMessageDetail,
} from "@/types/chat";

export interface ConversationPagingState {
    hasMoreOlder: boolean;
    hasMoreNewer: boolean;
    isHistoricalMode: boolean;
    olderCursor: string | null;
}

export type MembersByUserId = Record<number, ConversationMember>;
export interface ActiveCallRuntimeState {
    callId: string;
    conversationId: number;
    callType: "audio" | "video";
    userId: number;
}
type ConversationListener = (conversation: Conversation) => void;
interface SetConversationOptions {
    memberSnapshotVersion?: number;
}
interface RemovePendingRequestsOptions {
    requestIds?: number[];
    userIds?: number[];
}

const MEMBER_SNAPSHOT_GUARD_MS = 5000;

class ChatRuntimeStore {
    private readonly conversations = new Map<number, Conversation>();
    private readonly membersByConversation = new Map<number, MembersByUserId>();
    private readonly messagesByConversation = new Map<number, Message[]>();
    private readonly pinsByConversation = new Map<
        number,
        PinnedMessageDetail[]
    >();
    private readonly pagingByConversation = new Map<
        number,
        ConversationPagingState
    >();
    private readonly conversationListeners = new Set<ConversationListener>();
    private readonly memberSnapshotVersions = new Map<number, number>();
    private readonly requiredMemberSnapshotVersions = new Map<number, number>();
    private readonly memberSnapshotGuardUntil = new Map<number, number>();
    private readonly acceptedMemberSnapshotVersions = new Map<number, number>();
    private readonly dismissedPendingRequestIds = new Map<number, Set<number>>();
    private activeCall: ActiveCallRuntimeState | null = null;

    private createDefaultPagingState(): ConversationPagingState {
        return {
            hasMoreOlder: false,
            hasMoreNewer: false,
            isHistoricalMode: false,
            olderCursor: null,
        };
    }

    private toMembersByUserId(
        members?: ConversationMember[],
    ): MembersByUserId | null {
        if (!members) return null;

        return members.reduce<MembersByUserId>((next, member) => {
            next[member.userId] = member;
            return next;
        }, {});
    }

    private rememberDismissedPendingRequestIds(
        conversationId: number,
        requestIds: number[],
    ): void {
        const normalizedIds = requestIds
            .map((requestId) => Number(requestId))
            .filter((requestId) => Number.isFinite(requestId));

        if (normalizedIds.length === 0) return;

        const dismissedIds =
            this.dismissedPendingRequestIds.get(conversationId) ?? new Set<number>();

        normalizedIds.forEach((requestId) => dismissedIds.add(requestId));
        this.dismissedPendingRequestIds.set(conversationId, dismissedIds);
    }

    private removeDismissedPendingRequests(
        conversationId: number,
        requests: Conversation["pendingRequests"],
    ): Conversation["pendingRequests"] {
        if (!requests?.length) return requests;

        const dismissedIds = this.dismissedPendingRequestIds.get(conversationId);
        if (!dismissedIds?.size) return requests;

        return requests.filter((request) => !dismissedIds.has(Number(request.id)));
    }

    private removeHandledMemberRequests(
        requests: Conversation["pendingRequests"],
        members?: ConversationMember[],
    ): Conversation["pendingRequests"] {
        if (!requests || !members?.length) return requests;

        const membersByUserId = new Map(
            members.map((member) => [Number(member.userId), member]),
        );

        if (membersByUserId.size === 0) return requests;

        return requests.filter((request) => {
            const member = membersByUserId.get(Number(request.userId));
            if (!member) return true;

            if (!member.status || member.status === "ACTIVE") return false;

            const requestTime = request.createdAt
                ? new Date(request.createdAt).getTime()
                : 0;
            const joinedTime = member.joinedAt
                ? new Date(member.joinedAt).getTime()
                : 0;
            const leftTime = member.leftAt
                ? new Date(member.leftAt).getTime()
                : 0;
            const handledTime = Math.max(joinedTime, leftTime);

            return !requestTime || !handledTime || requestTime > handledTime;
        });
    }

    getConversation(conversationId: number): Conversation | null {
        return this.conversations.get(conversationId) ?? null;
    }

    getAllConversations(): Conversation[] {
        return Array.from(this.conversations.values());
    }

    private emitConversationChanged(conversation: Conversation): void {
        const listeners = Array.from(this.conversationListeners);
        // Dùng queueMicrotask thay vì setTimeout(0):
        // - Thoát khỏi render cycle hiện tại (tránh "setState during render")
        // - Nhanh hơn setTimeout: chạy trước frame tiếp theo (~0ms thực tế)
        // → sidebar vẫn cập nhật gần như ngay lập tức.
        queueMicrotask(() => {
            listeners.forEach((listener) => listener(conversation));
        });
    }

    subscribeConversationChanges(listener: ConversationListener): () => void {
        this.conversationListeners.add(listener);
        return () => {
            this.conversationListeners.delete(listener);
        };
    }

    markMembersChanging(conversationId: number): number {
        const existingRequiredVersion =
            this.requiredMemberSnapshotVersions.get(conversationId);
        const existingGuardUntil =
            this.memberSnapshotGuardUntil.get(conversationId) ?? 0;

        if (
            existingRequiredVersion !== undefined &&
            Date.now() <= existingGuardUntil &&
            this.acceptedMemberSnapshotVersions.get(conversationId) !==
                existingRequiredVersion
        ) {
            return existingRequiredVersion;
        }

        const nextVersion =
            (this.memberSnapshotVersions.get(conversationId) ?? 0) + 1;
        this.memberSnapshotVersions.set(conversationId, nextVersion);
        this.requiredMemberSnapshotVersions.set(conversationId, nextVersion);
        this.acceptedMemberSnapshotVersions.delete(conversationId);
        this.memberSnapshotGuardUntil.set(
            conversationId,
            Date.now() + MEMBER_SNAPSHOT_GUARD_MS,
        );
        return nextVersion;
    }

    private canAcceptMemberSnapshot(
        conversationId: number,
        version?: number,
        consumeVersion = false,
    ): boolean {
        const requiredVersion =
            this.requiredMemberSnapshotVersions.get(conversationId);
        if (requiredVersion === undefined) return true;
        const guardUntil = this.memberSnapshotGuardUntil.get(conversationId) ?? 0;

        if (Date.now() > guardUntil) {
            this.requiredMemberSnapshotVersions.delete(conversationId);
            this.memberSnapshotGuardUntil.delete(conversationId);
            return true;
        }

        if (version === undefined || version < requiredVersion) return false;
        if (
            this.acceptedMemberSnapshotVersions.get(conversationId) ===
            requiredVersion
        ) {
            return false;
        }

        if (consumeVersion) {
            this.acceptedMemberSnapshotVersions.set(
                conversationId,
                requiredVersion,
            );
        }

        return true;
    }

    setConversation(
        conversationId: number,
        conversation: Conversation,
        options?: SetConversationOptions,
    ): Conversation {
        const previous = this.conversations.get(conversationId);
        const acceptMembers =
            conversation.members === undefined ||
            this.canAcceptMemberSnapshot(
                conversationId,
                options?.memberSnapshotVersion,
                true,
            );
        const mergedConversation = previous
            ? {
                  ...previous,
                  ...conversation,
                  members: acceptMembers
                      ? conversation.members ?? previous.members
                      : previous.members,
                  pinnedMessages:
                      conversation.pinnedMessages ?? previous.pinnedMessages,
                  pendingRequests:
                      conversation.pendingRequests ?? previous.pendingRequests,
                  lastMessage: conversation.lastMessage ?? previous.lastMessage,
              }
            : acceptMembers
              ? conversation
              : { ...conversation, members: undefined };
        const next = {
            ...mergedConversation,
            pendingRequests: this.removeHandledMemberRequests(
                this.removeDismissedPendingRequests(
                    conversationId,
                    mergedConversation.pendingRequests,
                ),
                mergedConversation.members,
            ),
        };

        this.conversations.set(conversationId, next);
        if (acceptMembers && conversation.members !== undefined) {
            const membersById = this.toMembersByUserId(conversation.members);
            if (membersById) {
                this.membersByConversation.set(conversationId, membersById);
            }
        }
        this.emitConversationChanged(next);
        return next;
    }

    removePendingRequests(
        conversationId: number,
        options: RemovePendingRequestsOptions,
    ): Conversation | null {
        const requestIds = new Set(
            (options.requestIds ?? [])
                .map((requestId) => Number(requestId))
                .filter((requestId) => Number.isFinite(requestId)),
        );
        const userIds = new Set(
            (options.userIds ?? [])
                .map((userId) => Number(userId))
                .filter((userId) => Number.isFinite(userId)),
        );
        this.rememberDismissedPendingRequestIds(
            conversationId,
            Array.from(requestIds),
        );

        const previous = this.getConversation(conversationId);
        if (!previous) return null;

        const matchedRequestIds =
            previous.pendingRequests
                ?.filter(
                    (request) =>
                        requestIds.has(Number(request.id)) ||
                        userIds.has(Number(request.userId)),
                )
                .map((request) => Number(request.id)) ?? [];

        this.rememberDismissedPendingRequestIds(
            conversationId,
            matchedRequestIds,
        );

        const nextPendingRequests =
            previous.pendingRequests?.filter(
                (request) =>
                    !requestIds.has(Number(request.id)) &&
                    !userIds.has(Number(request.userId)),
            ) ?? previous.pendingRequests;

        const next = {
            ...previous,
            pendingRequests: nextPendingRequests,
        };

        this.conversations.set(conversationId, next);
        this.emitConversationChanged(next);
        return next;
    }

    patchConversation(
        conversationId: number,
        patch: Partial<Conversation>,
    ): Conversation | null {
        const previous = this.getConversation(conversationId);
        if (!previous) return null;

        const next = {
            ...previous,
            ...patch,
        };

        this.conversations.set(conversationId, next);
        this.emitConversationChanged(next);
        return next;
    }

    getMembers(conversationId: number): MembersByUserId {
        return this.membersByConversation.get(conversationId) ?? {};
    }

    setMembers(
        conversationId: number,
        members: MembersByUserId,
        options?: SetConversationOptions,
    ): MembersByUserId {
        if (
            !this.canAcceptMemberSnapshot(
                conversationId,
                options?.memberSnapshotVersion,
            )
        ) {
            return this.getMembers(conversationId);
        }

        this.membersByConversation.set(conversationId, members);
        return members;
    }

    patchMember(
        conversationId: number,
        userId: number,
        memberPatch: Partial<ConversationMember>,
    ): MembersByUserId {
        const previous = this.getMembers(conversationId);
        const next: MembersByUserId = {
            ...previous,
            [userId]: {
                ...previous[userId],
                userId,
                username: previous[userId]?.username ?? "",
                nickname: previous[userId]?.nickname ?? "Unknown",
                ...memberPatch,
            },
        };

        this.membersByConversation.set(conversationId, next);
        return next;
    }

    getMessages(conversationId: number): Message[] {
        return this.messagesByConversation.get(conversationId) ?? [];
    }

    setMessages(conversationId: number, messages: Message[]): void {
        this.messagesByConversation.set(conversationId, messages);
    }

    upsertMessage(conversationId: number, message: Message): Message[] {
        const previous = this.getMessages(conversationId);
        const exists = previous.some((item) => item.id === message.id);
        const next = exists ? previous : [...previous, message];
        this.messagesByConversation.set(conversationId, next);
        return next;
    }

    getPins(conversationId: number): PinnedMessageDetail[] {
        return this.pinsByConversation.get(conversationId) ?? [];
    }

    setPins(conversationId: number, pins: PinnedMessageDetail[]): void {
        this.pinsByConversation.set(conversationId, pins);
    }

    getPaging(conversationId: number): ConversationPagingState {
        return (
            this.pagingByConversation.get(conversationId) ??
            this.createDefaultPagingState()
        );
    }

    setPaging(
        conversationId: number,
        paging: ConversationPagingState,
    ): ConversationPagingState {
        this.pagingByConversation.set(conversationId, paging);
        return paging;
    }

    patchPaging(
        conversationId: number,
        patch: Partial<ConversationPagingState>,
    ): ConversationPagingState {
        const next = {
            ...this.getPaging(conversationId),
            ...patch,
        };

        this.pagingByConversation.set(conversationId, next);
        return next;
    }

    clearConversationRuntime(conversationId: number): void {
        this.messagesByConversation.delete(conversationId);
        this.pagingByConversation.delete(conversationId);
    }

    setActiveCall(call: ActiveCallRuntimeState | null): void {
        this.activeCall = call;
    }

    getActiveCall(): ActiveCallRuntimeState | null {
        return this.activeCall;
    }
}

const chatRuntimeStore = new ChatRuntimeStore();

export default chatRuntimeStore;
