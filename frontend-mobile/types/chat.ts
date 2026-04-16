export interface ApiResponse<T> {
    status: number;
    success: boolean;
    message: string;
    data: T | null;
    errors?: unknown;
    timestamp: string;
}

export type MessageType =
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "FILE"
    | "AUDIO"
    | "CALL"
    | "SYSTEM_PIN"
    | "SYSTEM_UPIN";

export interface ReplyInfo {
    messageId: string;
    senderId?: number;
    type?: MessageType;
    content?: string;
}

export interface MessageAttachment {
    url: string;
    type?: string;
    fileName?: string;
    fileSize?: number;
}

export interface Message {
    id: string;
    conversationId: number;
    content: string;
    type: MessageType;
    createdAt: string;
    senderId: number;
    senderName?: string;
    senderAvatar?: string;
    replyInfo?: ReplyInfo;
    active?: boolean;
    isActive?: boolean;
    isRecalled?: boolean;
    attachments?: MessageAttachment[];
}

export interface ReferenceUser {
    nickname: string;
    avatar?: string;
}

export interface CursorResponse<T> {
    data: T;
    nextCursor: string | null;
    hasMoreOlder: boolean;
    hasMoreNewer: boolean;
    referenceUsers?: Record<string, ReferenceUser>;
}

export interface LastMessage {
    lastMessageContent: string;
    lastMessageType: MessageType;
    lastSenderId: number;
    lastSenderName: string;
    lastMessageAt: string;
    read: boolean;
}

export interface PinnedMessageDetail {
    messageId: string;
    pinnerId: number;
    pinnedAt: string;
}

export interface ConversationMember {
    userId: number;
    username: string;
    nickname: string;
    avatar?: string;
    lastReadMessageId?: string;
}

export interface Conversation {
    id: number;
    name?: string;
    type: "DIRECT" | "GROUP";
    imageUrl?: string;
    updatedAt: string;
    lastMessage?: LastMessage;
    members?: ConversationMember[];
    unreadCount?: number;
    pinnedMessages?: PinnedMessageDetail[];
}

export interface SendMessageRequest {
    content: string;
    type: MessageType;
    conversationId: number;
    replyToId?: string;
    attachments?: Array<{
        url: string;
        type: string;
        fileName: string;
        fileSize: number;
    }>;
}

export interface PresignedUrlResponse {
    presignedUrl: string;
    objectKey: string;
    fileName: string;
}

export interface BulkPresignedRequest {
    module: "CONVERSATION" | "USER" | "POST";
    targetId: string;
    files: Array<{
        type: "IMAGE" | "VIDEO" | "FILE" | "AUDIO";
        fileName: string;
        contentType: string;
    }>;
}

export interface LocalUploadFile {
    uri: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
}

export interface MessageCreatedEvent {
    domainEventType: "MESSAGE_CREATED";
    messageResponse: Message;
}

export interface MessageRecalledEvent {
    domainEventType: "MESSAGE_RECALLED";
    messageRecalledResponse: {
        messageId: string;
        conversationId: number;
        createdAt: string;
    };
}

export interface MessageSeenEvent {
    domainEventType: "MESSAGE_SEEN";
    messageSeenResponse: {
        conversationId: number;
        userId: number;
        lastMessageId: string;
        seenAt: string;
    };
}

export interface TypingEvent {
    domainEventType: "TYPING";
    typingResponse: {
        conversationId: number;
        userId: number;
        isTyping: boolean;
    };
}

export interface PinUpdatedEvent {
    domainEventType: "PIN_MESSAGE" | "UPIN_MESSAGE";
    conversationId: number;
    currentPins: PinnedMessageDetail[];
}

export interface MemberUpdatedEvent {
    domainEventType: "MEMBER_UPDATED";
    conversationId: number;
    userId: number;
    newNickname: string;
    newAvatar?: string;
}

export interface ConversationUpdatedEvent {
    type: "ROOM_UPDATED";
    conversationId: number;
    lastMessage: LastMessage;
}
