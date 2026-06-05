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
    | "LINK"
    | "IMAGE"
    | "VIDEO"
    | "FILE"
    | "AUDIO"
    | "CALL"
    | "POLL"
    | "SYSTEM_PIN"
    | "SYSTEM_UPIN"
    | "SYSTEM_POLL_CREATED"
    | "SYSTEM_POLL_VOTED"
    | "SYSTEM_POLL_CHANGED"
    | "SYSTEM_POLL_CLOSED"
    | "SYSTEM_POLL_PINNED"
    | "SYSTEM_CREATE_GROUP"
    | "SYSTEM_ADD_MEMBER"
    | "SYSTEM_LEAVE_GROUP"
    | "SYSTEM_KICK_MEMBER"
    | "SYSTEM_BLOCK_MEMBER"
    | "SYSTEM_UPDATE_ROLE"
    | "SYSTEM_DISBAND_GROUP"
    | "SYSTEM_UPDATE_SETTING"
    | "SYSTEM_REQUIRE_APPROVAL"
    | "SYSTEM_JOIN_VIA_LINK"
    | "SYSTEM_MEMBER_BLOCKED_FROM_JOIN"
    | "SYSTEM_GROUP_INVITE_LINK_SENT";

export type MemberRole = "OWNER" | "DEPUTY" | "MEMBER";

export type MemberStatus = "ACTIVE" | "LEFT" | "KICKED" | "BLOCKED" | "GROUP_DISBANDED";

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
    clientMessageId?: string;
    content: string;
    type: MessageType;
    createdAt: string;
    senderId: number;
    senderName?: string;
    senderAvatar?: string;
    pollId?: string;
    poll?: PollResponse;
    replyInfo?: ReplyInfo;
    active?: boolean;
    isActive?: boolean;
    isRecalled?: boolean;
    attachments?: MessageAttachment[];
    deletedFor?: number[];
    iconName?: MessageReaction[];
    conversation?: Conversation;
    newConversation?: boolean;
    deliveryStatus?: "sending" | "sent" | "failed";
}

export interface PollOptionResponse {
    id: string;
    text: string;
    voteCount: number;
    selectedByCurrentUser: boolean;
    voterIds?: number[];
}

export interface PollResponse {
    id: string;
    messageId: string;
    conversationId: number;
    creatorId: number;
    title: string;
    allowMultipleChoices: boolean;
    allowAddOption: boolean;
    anonymous: boolean;
    closed: boolean;
    recalled: boolean;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
    totalVoterCount?: number;
    totalVoteCount: number;
    currentUserOptionIds: string[];
    options: PollOptionResponse[];
}

export interface CreatePollRequest {
    conversationId: number;
    title: string;
    options: string[];
    allowMultipleChoices?: boolean;
    allowAddOption?: boolean;
    anonymous?: boolean;
    expiresAt?: string | null;
}

export interface MessageReactionUser {
    userId: number;
    quantity: number;
}

export interface MessageReaction {
    name: string;
    user: MessageReactionUser[];
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
    originalSenderId?: number;
    type?: MessageType;
    content?: string;
}

export interface ConversationMember {
    id?: number;
    userId: number;
    username: string;
    nickname: string;
    avatar?: string;
    unreadCount?: number;
    clearedAt?: string;
    lastReadMessageId?: string;
    role?: MemberRole;
    status?: MemberStatus;
    joinedAt?: string;
    leftAt?: string;
    blockedAt?: string;
    blockedById?: number;
    // Tài khoản user có đang bị Admin/hệ thống khóa hay không (User.locked).
    // KHÁC với MemberStatus. Optional để backward-compatible.
    accountLocked?: boolean;
}

export interface ConversationSidebar {
    id: number;
    name?: string;
    type: "DIRECT" | "GROUP";
    imageUrl?: string;
    directPartnerId?: number;
    // Với hội thoại DIRECT: đối phương có đang bị khóa tài khoản không.
    directPartnerLocked?: boolean;
    directBlockedByMe?: boolean;
    directBlockedMe?: boolean;
    updatedAt: string;
    lastMessage?: LastMessage;
    unreadCount?: number;
    members?: ConversationMember[];
    isMessageRestricted?: boolean;
    isJoinApprovalRequired?: boolean;
    pendingRequests?: JoinRequest[] | null;
    inviteToken?: string | null;
}

export interface ConversationPin {
    conversationId: number;
    pinnedAt: string;
    conversation?: ConversationSidebar;
}

export interface Conversation extends ConversationSidebar {
    members?: ConversationMember[];
    pinnedMessages?: PinnedMessageDetail[];
}

export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface JoinRequest {
    id: number;
    conversationId: number;
    userId: number;
    userName: string;
    userAvatar?: string | null;
    username?: string | null;
    nickname?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    inviterId?: number | null;
    inviterName?: string | null;
    status: JoinRequestStatus;
    content?: string | null;
    createdAt: string;
}

export type GroupJoinRequest = JoinRequest;

export type InviteUserStatus = "ACTIVE" | "PENDING" | "NOT_MEMBER";

export interface ConversationPreview {
    conversationId: number;
    name: string;
    imageUrl?: string | null;
    memberCount: number;
    isJoinApprovalRequired: boolean;
    userStatus: InviteUserStatus;
}

export interface SendMessageRequest {
    content: string;
    type: MessageType;
    conversationId?: number;
    receiverId?: number;
    clientMessageId?: string;
    replyToId?: string;
    attachments?: Array<{
        url: string;
        type: string;
        fileName: string;
        fileSize: number;
    }>;
}

export interface ChatUserSearchResult {
    userId: number;
    name: string;
    username?: string;
    phone?: string;
    avatarUrl?: string;
    friendStatus: "FRIEND" | "STRANGER";
    mutualGroupsCount: number;
    existingDirectConversationId?: number | null;
    blocked?: boolean;
}

export interface ForwardMessageRequest {
    sourceMessageId: string;
    targetConversationIds: number[];
}

export interface SendCallMessageRequest {
    conversationId: number;
    callType: "audio" | "video";
    status: "calling" | "ringing" | "accepted" | "rejected" | "ended";
    durationSeconds: number;
}

export interface UpdateNicknameRequest {
    conversationId: number;
    targetUserId: number;
    nickname: string;
}

export interface CreateGroupRequest {
    name?: string;
    imageUrl?: string;
    memberIds: number[];
}

export interface CreateGroupWithInvitesRequest extends CreateGroupRequest {
    inviteeUserIds: number[];
}

export interface AddGroupMembersRequest {
    newMemberIds: number[];
}

export interface AddGroupMembersWithInvitesRequest extends AddGroupMembersRequest {
    inviteeUserIds: number[];
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

export interface MessageSearchResult {
    messageId: string;
    conversationId: number;
    senderId?: number;
    senderName?: string;
    content: string;
    createdAt: string;
}

export interface MessageSearchResponse {
    items: MessageSearchResult[];
    nextCursor: string | null;
    hasMore: boolean;
}

export type ConversationMediaType = "MEDIA" | "FILE" | "LINK";

export interface ConversationMediaItem {
    messageId: string;
    conversationId: number;
    senderId: number;
    type: "IMAGE" | "VIDEO" | "FILE" | "LINK";
    url: string;
    content?: string;
    fileName?: string;
    fileSize?: number;
    createdAt: string;
}

export interface ConversationMediaResponse {
    items: ConversationMediaItem[];
    nextCursor: string | null;
    hasMore: boolean;
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

// Realtime khi tài khoản 1 thành viên bị khóa/mở khóa. Phát trên cả
// /topic/conversations/{id}/members lẫn /topic/user/{id}/conversations.
export interface MemberAccountLockChangedEvent {
    domainEventType: "MEMBER_ACCOUNT_LOCK_CHANGED";
    conversationId: number;
    userId: number;
    accountLocked: boolean;
}

export interface DirectBlockStatusChangedEvent {
    domainEventType: "DIRECT_BLOCK_STATUS_CHANGED";
    conversationId: number;
    blockerId: number;
    blockedId: number;
    blocked: boolean;
}

export interface ConversationUpdatedEvent {
    domainEventType?: "ROOM_UPDATED";
    type?: "ROOM_UPDATED";
    conversationId: number;
    lastMessage: LastMessage;
}

export interface ConversationCreatedEvent {
    domainEventType?: "ROOM_CREATED";
    type?: "ROOM_CREATED";
    conversationResponse?: Conversation | ConversationSidebar;
}

export interface ConversationMembershipEvent {
    domainEventType?:
        | "MEMBER_ADDED"
        | "MEMBER_ROLE_UPDATED"
        | "MEMBER_LEFT"
        | "MEMBER_KICKED"
        | "CONVERSATION_BLOCKED_MEMBERS_UPDATED";
    conversationResponse?: Conversation | ConversationSidebar;
}

export interface GroupDisbandedEvent {
    domainEventType?: "GROUP_DISBANDED";
    conversationId?: number;
}

export interface NewJoinRequestEvent {
    domainEventType: "NEW_JOIN_REQUEST";
    conversationId: number;
    requestData: JoinRequest;
}

export interface JoinRequestProcessedEvent {
    domainEventType: "JOIN_REQUEST_PROCESSED";
    conversationId: number;
    requestId: number;
}

export interface MessageReactionEvent {
    domainEventType: "MESSAGE_REACTION";
    messageResponse: Message;
}

export interface PollUpdatedEvent {
    domainEventType: "POLL_UPDATED";
    poll: PollResponse;
}
