import type {
    Conversation,
    ConversationMember,
    Message,
} from "../services/chatService";

export interface PinnedMessageDetail {
    messageId: string;
    pinnerId: number;
    pinnedAt: string;
}

export interface ConversationPagingState {
    hasMoreOlder: boolean;
    hasMoreNewer: boolean;
    isHistoricalMode: boolean;
    olderCursor: string | null;
}

export type MembersByUserId = Record<number, ConversationMember>;

class ChatRuntimeStore {
    // conversations: snapshot metadata của từng cuộc trò chuyện (tên, type, lastMessage,...)
    private readonly conversations = new Map<number, Conversation>();

    // membersByConversation: bảng tra cứu nhanh thành viên theo userId cho từng conversation.
    // Dùng để render nickname/avatar dựa trên senderId của message.
    private readonly membersByConversation = new Map<number, MembersByUserId>();

    // messagesByConversation: cache danh sách tin nhắn theo từng conversation.
    // Giúp chuyển room mượt mà trước khi fetch mới trả về.
    private readonly messagesByConversation = new Map<number, Message[]>();

    // pinsByConversation: cache danh sách tin nhắn ghim theo conversation.
    // Dùng để giữ banner ghim ổn định khi đổi room và khi F5 (kết hợp hydrate từ API).
    private readonly pinsByConversation = new Map<
        number,
        PinnedMessageDetail[]
    >();

    private readonly pagingByConversation = new Map<
        number,
        ConversationPagingState
    >();

    private createDefaultPagingState(): ConversationPagingState {
        return {
            hasMoreOlder: false,
            hasMoreNewer: false,
            isHistoricalMode: false,
            olderCursor: null,
        };
    }

    getMembers(conversationId: number): MembersByUserId {
        return this.membersByConversation.get(conversationId) ?? {};
    }

    getConversation(conversationId: number): Conversation | null {
        return this.conversations.get(conversationId) ?? null;
    }

    setConversation(conversationId: number, conversation: Conversation): void {
        this.conversations.set(conversationId, conversation);
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
