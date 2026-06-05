import type { ApiResponse } from "../types";
import axiosClient from "../api/axiosClient";

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

export interface MessageAttachment {
    url: string;
    type?: string;
    fileName?: string;
    fileSize?: number;
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

export interface ConversationSidebar {
    id: number;
    name?: string;
    type: "DIRECT" | "GROUP";
    imageUrl?: string;
    directPartnerId?: number;
    // Với hội thoại DIRECT: đối phương có đang bị khóa tài khoản không.
    // Dùng để mask tên/avatar ở sidebar (không có sẵn danh sách members).
    directPartnerLocked?: boolean;
    directBlockedByMe?: boolean;
    directBlockedMe?: boolean;
    updatedAt: string;
    lastMessage?: LastMessage;
    unreadCount?: number;
    members?: ConversationMember[];
}

export interface ConversationPin {
    conversationId: number;
    pinnedAt: string;
    conversation?: ConversationSidebar;
}

export interface Conversation extends ConversationSidebar {
    members?: ConversationMember[];
    pinnedMessages?: PinnedMessageDetail[];
    isMessageRestricted?: boolean;
    isJoinApprovalRequired?: boolean;
    inviteToken?: string | null;
    pendingRequests?: JoinRequest[] | null;
}

export type InviteUserStatus = "ACTIVE" | "PENDING" | "NOT_MEMBER";

export interface ConversationPreview {
    conversationId: number;
    name: string;
    imageUrl?: string;
    memberCount: number;
    isJoinApprovalRequired: boolean;
    userStatus: InviteUserStatus;
}

export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface JoinRequest {
    id: number;
    conversationId: number;
    userId: number;
    userName: string;
    userAvatar?: string;
    inviterId?: number | null;
    inviterName?: string | null;
    status: JoinRequestStatus;
    content?: string | null;
    createdAt: string;
}

export type GroupJoinRequest = JoinRequest;

export interface ConversationMember {
    id?: number;
    userId: number;
    username?: string;
    nickname: string;
    avatar?: string;
    unreadCount?: number;
    clearedAt?: string;
    lastReadMessageId?: string; // Mốc tin nhắn đã đọc (watermark)
    role?: MemberRole;
    status?: MemberStatus;
    joinedAt?: string;
    leftAt?: string;
    blockedAt?: string;
    blockedById?: number;
    // Tài khoản user có đang bị Admin/hệ thống khóa hay không (User.locked).
    // KHÁC với MemberStatus. Optional để backward-compatible với client/response cũ.
    accountLocked?: boolean;
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

export interface MessageSeenPayload {
    conversationId: number;
    userId: number;
    lastMessageId: string;
    seenAt: string;
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

function normalizeMembersPayload(
    payload: unknown,
): Record<string, ConversationMember> {
    // Chuẩn hoá response members để FE chịu được 2 kiểu backend:
    // 1) Kiểu bọc ApiResponse: { success, data, ... }
    // 2) Kiểu map raw: { "1": { ... }, "2": { ... } }
    // Mục tiêu: tránh lỗi map sai key/userId khiến UI rơi về fallback
    // "Người dùng" và avatar mặc định.
    if (!payload || typeof payload !== "object") return {};

    // Case 1: API wrapped format { success, data, ... }
    if ("data" in (payload as Record<string, unknown>)) {
        const data = (payload as { data?: unknown }).data;
        if (data && typeof data === "object") {
            return data as Record<string, ConversationMember>;
        }
    }

    // Case 2: raw map format { "1": {...}, "2": {...} }
    return payload as Record<string, ConversationMember>;
}

function unwrapApiData<T>(payload: ApiResponse<T> | T): T {
    if (
        payload &&
        typeof payload === "object" &&
        "data" in (payload as Record<string, unknown>)
    ) {
        const wrapped = payload as ApiResponse<T>;
        if (wrapped.data != null) {
            return wrapped.data;
        }
    }
    return payload as T;
}

export function isMaxPinLimitError(error: unknown): boolean {
    const responseData =
        error &&
        typeof error === "object" &&
        "response" in error
            ? (error as { response?: { data?: unknown } }).response?.data
            : undefined;

    if (!responseData || typeof responseData !== "object") return false;

    const payload = responseData as {
        errors?: unknown;
        data?: unknown;
        message?: unknown;
    };
    const errors = payload.errors;
    const nestedCode =
        errors && typeof errors === "object" && "code" in errors
            ? (errors as { code?: unknown }).code
            : undefined;

    return nestedCode === "MAX_PIN_LIMIT";
}

const chatService = {
    async getConversations(
        _userId: number,
    ): Promise<ApiResponse<ConversationSidebar[]>> {
        const response = await axiosClient.get("/conversations");
        return response.data;
    },

    async getForwardableConversations(): Promise<ApiResponse<ConversationSidebar[]>> {
        const response = await axiosClient.get("/conversations/forward-targets");
        return response.data;
    },

    async getMessages(
        conversationId: number,
        _userId: number,
        before?: string | null,
        limit: number = 20,
        signal?: AbortSignal,
    ): Promise<ApiResponse<CursorResponse<Message[]>>> {
        const params = new URLSearchParams({
            limit: limit.toString(),
        });
        if (before) params.append("before", before);
        const response = await axiosClient.get(
            `/conversations/${conversationId}/messages?${params.toString()}`,
            { signal },
        );

        return response.data;
    },

    async getNewerMessages(
        conversationId: number,
        _userId: number,
        after: string,
        limit: number = 20,
    ): Promise<ApiResponse<CursorResponse<Message[]>>> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            after,
        });
        const response = await axiosClient.get(
            `/conversations/${conversationId}/messages/newer?${params.toString()}`,
        );
        return response.data;
    },

    async jumpToMessage(
        conversationId: number,
        targetMessageId: string,
        _userId: number,
    ): Promise<ApiResponse<CursorResponse<Message[]>>> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/messages/${targetMessageId}/jump`,
        );
        return response.data;
    },

    async searchMessages(
        conversationId: number,
        keyword: string,
        senderId?: number | null,
        fromDate?: string | null,
        toDate?: string | null,
        cursor?: string | null,
        limit: number = 5,
    ): Promise<MessageSearchResponse> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/messages/search`,
            {
                params: {
                    keyword,
                    senderId: senderId || undefined,
                    fromDate: fromDate || undefined,
                    toDate: toDate || undefined,
                    cursor: cursor || undefined,
                    limit,
                },
            },
        );
        return unwrapApiData(
            response.data as ApiResponse<MessageSearchResponse> | MessageSearchResponse,
        );
    },

    async getConversationMedia(
        conversationId: number,
        type: ConversationMediaType,
        cursor?: string | null,
        limit = 20,
    ): Promise<ConversationMediaResponse> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/messages/media`,
            {
                params: {
                    type,
                    cursor: cursor || undefined,
                    limit,
                },
            },
        );
        return unwrapApiData(
            response.data as ApiResponse<ConversationMediaResponse> | ConversationMediaResponse,
        );
    },

    async sendMessage(
        request: SendMessageRequest,
        _userId: number,
    ): Promise<Message> {
        const response = await axiosClient.post("/messages/send", request);
        return unwrapApiData(response.data as ApiResponse<Message> | Message);
    },

    async searchChatUserByPhone(phone: string): Promise<ChatUserSearchResult | null> {
        const response = await axiosClient.get("/chat-users/search-by-phone", {
            params: { phone },
        });
        return unwrapApiData(
            response.data as ApiResponse<ChatUserSearchResult | null> | ChatUserSearchResult | null,
        );
    },

    async getChatUserRelationship(userId: number): Promise<ChatUserSearchResult | null> {
        const response = await axiosClient.get(`/chat-users/${userId}/relationship`);
        return unwrapApiData(
            response.data as ApiResponse<ChatUserSearchResult | null> | ChatUserSearchResult | null,
        );
    },

    async resolveDirectConversation(receiverId: number): Promise<Conversation> {
        const response = await axiosClient.post("/conversations/direct/resolve", {
            receiverId,
        });
        return unwrapApiData(response.data as ApiResponse<Conversation> | Conversation);
    },

    async createPoll(request: CreatePollRequest): Promise<Message> {
        const response = await axiosClient.post("/messages/polls", request);
        return unwrapApiData(response.data as ApiResponse<Message> | Message);
    },

    async votePoll(pollId: string, optionIds: string[]): Promise<PollResponse> {
        const response = await axiosClient.post(`/polls/${pollId}/vote`, {
            optionIds,
        });
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async removePollVote(pollId: string): Promise<PollResponse> {
        const response = await axiosClient.delete(`/polls/${pollId}/vote`);
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async addPollOption(pollId: string, text: string): Promise<PollResponse> {
        const response = await axiosClient.post(`/polls/${pollId}/options`, {
            text,
        });
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async closePoll(pollId: string): Promise<PollResponse> {
        const response = await axiosClient.patch(`/polls/${pollId}/close`);
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async forwardMessage(request: ForwardMessageRequest): Promise<Message[]> {
        const response = await axiosClient.post("/messages/forward", request);
        const payload = response.data as ApiResponse<Message[]> | Message[];
        return unwrapApiData(payload);
    },

    async sendCallMessage(
        request: SendCallMessageRequest,
        _userId: number,
    ): Promise<Message> {
        const response = await axiosClient.post("/messages/call", request);
        return response.data;
    },

    async getConversation(
        conversationId: number,
        _userId: number,
    ): Promise<ApiResponse<Conversation>> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}`,
        );
        return response.data;
    },

    async fetchPinnedConversations(): Promise<ConversationPin[]> {
        const response = await axiosClient.get("/pins");
        return unwrapApiData(
            response.data as ApiResponse<ConversationPin[]> | ConversationPin[],
        );
    },

    async pinConversation(conversationId: number): Promise<ConversationPin> {
        const response = await axiosClient.post("/pins", { conversationId });
        return unwrapApiData(
            response.data as ApiResponse<ConversationPin> | ConversationPin,
        );
    },

    async unpinConversation(conversationId: number): Promise<void> {
        await axiosClient.delete(`/pins/${conversationId}`);
    },

    async markAsRead(
        conversationId: number,
        _userId: number,
        lastMessageId: string,
    ): Promise<void> {
        await axiosClient.put(
            `/conversations/${conversationId}/read?lastMessageId=${lastMessageId}`,
        );
    },

    async getConversationMembers(
        conversationId: number,
    ): Promise<Record<string, ConversationMember>> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/members`,
        );
        // Trả ra đúng map members theo userId để controller dùng join dữ liệu
        // senderId <-> nickname/avatar một cách ổn định.
        return normalizeMembersPayload(response.data);
    },

    async createGroupConversation(
        request: CreateGroupRequest,
    ): Promise<Conversation> {
        const response = await axiosClient.post(
            "/conversations/group",
            request,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async createGroupConversationWithInvites(
        request: CreateGroupWithInvitesRequest,
    ): Promise<Conversation> {
        const response = await axiosClient.post(
            "/conversations/group-with-invites",
            request,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async addMembersToGroup(
        conversationId: number,
        request: AddGroupMembersRequest,
    ): Promise<Conversation> {
        const response = await axiosClient.post(
            `/conversations/${conversationId}/members`,
            request,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async addMembersToGroupWithInvites(
        conversationId: number,
        request: AddGroupMembersWithInvitesRequest,
    ): Promise<Conversation> {
        const response = await axiosClient.post(
            `/conversations/${conversationId}/members-with-invites`,
            request,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async leaveGroup(conversationId: number): Promise<Conversation> {
        const response = await axiosClient.delete(
            `/conversations/${conversationId}/leave`,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async kickGroupMember(
        conversationId: number,
        targetUserId: number,
        blockFromGroup: boolean = false,
    ): Promise<Conversation> {
        const response = await axiosClient.delete(
            `/conversations/${conversationId}/members/${targetUserId}`,
            {
                params: {
                    blockFromGroup,
                },
            },
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async getBlockedGroupMembers(
        conversationId: number,
    ): Promise<ConversationMember[]> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/blocked-members`,
        );
        return unwrapApiData(
            response.data as ApiResponse<ConversationMember[]> | ConversationMember[],
        );
    },

    async blockGroupMember(
        conversationId: number,
        targetUserId: number,
    ): Promise<Conversation> {
        const response = await axiosClient.post(
            `/conversations/${conversationId}/blocked-members/${targetUserId}`,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async unblockGroupMember(
        conversationId: number,
        targetUserId: number,
    ): Promise<Conversation> {
        const response = await axiosClient.delete(
            `/conversations/${conversationId}/blocked-members/${targetUserId}`,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async updateGroupMemberRole(
        conversationId: number,
        targetUserId: number,
        newRole: MemberRole,
    ): Promise<Conversation> {
        const response = await axiosClient.patch(
            `/conversations/${conversationId}/members/${targetUserId}/role`,
            null,
            {
                params: {
                    newRole,
                },
            },
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async disbandGroup(conversationId: number): Promise<void> {
        await axiosClient.delete(`/conversations/${conversationId}/disband`);
    },

    async updateMessageRestriction(
        conversationId: number,
        isRestricted: boolean,
    ): Promise<Conversation> {
        const response = await axiosClient.patch(
            `/conversations/${conversationId}/settings/message-restriction`,
            null,
            {
                params: {
                    isRestricted,
                },
            },
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async updateJoinApprovalRequired(
        conversationId: number,
        isRequired: boolean,
    ): Promise<Conversation> {
        const response = await axiosClient.patch(
            `/conversations/${conversationId}/settings/join-approval`,
            null,
            {
                params: {
                    isRequired,
                },
            },
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async updateGroupImage(
        conversationId: number,
        imageUrl: string,
    ): Promise<Conversation> {
        const response = await axiosClient.patch(
            `/conversations/${conversationId}/image`,
            { imageUrl },
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async getOrCreateInviteLink(conversationId: number): Promise<string> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/invite-link`,
        );
        return unwrapApiData(response.data as ApiResponse<string> | string);
    },

    async resetInviteLink(conversationId: number): Promise<string> {
        const response = await axiosClient.patch(
            `/conversations/${conversationId}/invite-link/reset`,
        );
        return unwrapApiData(response.data as ApiResponse<string> | string);
    },

    async disableInviteLink(conversationId: number): Promise<void> {
        await axiosClient.delete(`/conversations/${conversationId}/invite-link`);
    },

    async previewInvite(token: string): Promise<ConversationPreview> {
        const response = await axiosClient.get(`/conversations/invite/${token}`);
        return unwrapApiData(
            response.data as ApiResponse<ConversationPreview> | ConversationPreview,
        );
    },

    async joinByInvite(token: string): Promise<Conversation | { message?: string }> {
        const response = await axiosClient.post(
            `/conversations/invite/${token}/join`,
        );
        return unwrapApiData(
            response.data as
                | ApiResponse<Conversation | { message?: string }>
                | Conversation
                | { message?: string },
        );
    },

    async processJoinRequest(
        conversationId: number,
        requestId: number,
        isApproved: boolean,
    ): Promise<void> {
        await axiosClient.patch(
            `/conversations/${conversationId}/join-requests/${requestId}`,
            null,
            {
                params: {
                    isApproved,
                },
            },
        );
    },

    async getPendingJoinRequests(conversationId: number): Promise<JoinRequest[]> {
        const response = await axiosClient.get(
            `/conversations/${conversationId}/join-requests`,
        );
        return unwrapApiData(
            response.data as ApiResponse<JoinRequest[]> | JoinRequest[],
        );
    },

    async cancelMyJoinRequest(conversationId: number): Promise<void> {
        await axiosClient.delete(
            `/conversations/${conversationId}/join-requests/me`,
        );
    },

    async updateConversationMemberNickname(
        request: UpdateNicknameRequest,
    ): Promise<void> {
        await axiosClient.patch(
            `/conversations/${request.conversationId}/members/${request.targetUserId}/nickname`,
            request.nickname,
            {
                headers: {
                    "Content-Type": "text/plain",
                },
            },
        );
    },

    async recallMessage(messageId: string, _userId: number): Promise<void> {
        await axiosClient.delete(`/messages/${messageId}/recall`);
    },

    async pinMessage(messageId: string, _userId: number): Promise<void> {
        await axiosClient.post(`/messages/${messageId}/pin`);
    },

    async unpinMessage(messageId: string, _userId: number): Promise<void> {
        await axiosClient.delete(`/messages/${messageId}/pin`);
    },

    async addReaction(messageId: string, emoji: string): Promise<Message> {
        const response = await axiosClient.post(
            `/messages/${messageId}/reactions`,
            { emoji },
        );
        return unwrapApiData(response.data as ApiResponse<Message> | Message);
    },

    // Bước 1: Xin presigned URL từ BE để upload file lên S3
    async getPresignedUrl(
        module: string,
        targetId: string, // Đổi từ number sang string để match với backend
        type: string,
        fileName: string,
        contentType: string,
    ): Promise<PresignedUrlResponse> {
        const list = await this.getBulkPresignedUrls({
            module: module as BulkPresignedRequest["module"],
            targetId,
            files: [
                {
                    type: type as BulkPresignedRequest["files"][number]["type"],
                    fileName,
                    contentType,
                },
            ],
        });

        if (list.length === 0) {
            throw new Error("Không lấy được presigned URL");
        }

        return list[0];
    },

    async getBulkPresignedUrls(
        request: BulkPresignedRequest,
    ): Promise<PresignedUrlResponse[]> {
        const response = await axiosClient.request({
            url: "/files/presigned-url",
            method: "post",
            data: request,
        });

        // Backend có thể trả list raw hoặc dạng bọc { data: [...] }.
        const payload = response.data as
            | PresignedUrlResponse[]
            | { data?: PresignedUrlResponse[] };
        if (Array.isArray(payload)) return payload;
        return Array.isArray(payload?.data) ? payload.data : [];
    },

    // Bước 2a: Upload file thẳng lên S3 bằng presigned PUT URL (không qua BE, không cần auth header)
    async uploadToS3(
        presignedUrl: string,
        file: File,
        onProgress?: (loaded: number, total: number) => void,
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl, true);
            xhr.setRequestHeader(
                "Content-Type",
                file.type || "application/octet-stream",
            );

            xhr.upload.onprogress = (event) => {
                if (!onProgress) return;
                const total = event.lengthComputable ? event.total : file.size;
                onProgress(event.loaded, total || file.size);
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    onProgress?.(file.size, file.size);
                    resolve();
                } else {
                    reject(new Error(`S3 upload failed: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error("S3 upload failed"));
            xhr.onabort = () => reject(new Error("S3 upload aborted"));
            xhr.send(file);
        });
    },

    // Xóa tin nhắn ở phía tôi (chỉ user hiện tại không thấy, người khác vẫn thấy)
    async deleteMessageForMe(messageId: string, _userId: number): Promise<void> {
        await axiosClient.delete(`/messages/${messageId}/delete-for-me`);
    },

    // Xóa cuộc trò chuyện ở phía tôi (xóa lịch sử chat cho user hiện tại)
    async deleteConversationForMe(
        conversationId: number,
        _userId: number,
    ): Promise<void> {
        await axiosClient.delete(
            `/conversations/${conversationId}/delete-for-me`,
        );
    },

    async hideConversationForMe(
        conversationId: number,
        _userId: number,
    ): Promise<void> {
        await axiosClient.patch(`/conversations/${conversationId}/hide-for-me`);
    },
};

export default chatService;
