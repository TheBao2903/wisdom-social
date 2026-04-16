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
type ConversationListener = (conversation: Conversation) => void;

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

    private createDefaultPagingState(): ConversationPagingState {
        return {
            hasMoreOlder: false,
            hasMoreNewer: false,
            isHistoricalMode: false,
            olderCursor: null,
        };
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

    setConversation(conversationId: number, conversation: Conversation): void {
        this.conversations.set(conversationId, conversation);
        this.emitConversationChanged(conversation);
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

    setMembers(conversationId: number, members: MembersByUserId): void {
        this.membersByConversation.set(conversationId, members);
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
}

const chatRuntimeStore = new ChatRuntimeStore();

export default chatRuntimeStore;
