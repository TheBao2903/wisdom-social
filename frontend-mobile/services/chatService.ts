import apiClient from "@/api/apiClient";
import type {
    AddGroupMembersWithInvitesRequest,
    AddGroupMembersRequest,
    ApiResponse,
    BulkPresignedRequest,
    ChatUserSearchResult,
    Conversation,
    ConversationPreview,
    ConversationPin,
    ConversationSidebar,
    ConversationMediaResponse,
    ConversationMediaType,
    ConversationMember,
    CreatePollRequest,
    CreateGroupWithInvitesRequest,
    CreateGroupRequest,
    CursorResponse,
    LocalUploadFile,
    ForwardMessageRequest,
    JoinRequest,
    MemberRole,
    Message,
    MessageSearchResponse,
    PollResponse,
    PinnedMessageDetail,
    PresignedUrlResponse,
    SendCallMessageRequest,
    SendMessageRequest,
    UpdateNicknameRequest,
} from "@/types/chat";

function normalizeMembersPayload(
    payload: unknown,
): Record<string, ConversationMember> {
    if (!payload || typeof payload !== "object") return {};

    if ("data" in (payload as Record<string, unknown>)) {
        const data = (payload as { data?: unknown }).data;
        if (data && typeof data === "object") {
            return data as Record<string, ConversationMember>;
        }
    }

    return payload as Record<string, ConversationMember>;
}

function normalizeMessagePayload(payload: unknown): Message {
    if (!payload || typeof payload !== "object") {
        throw new Error("Phan hoi gui tin nhan khong hop le");
    }

    const raw =
        "data" in (payload as Record<string, unknown>)
            ? (payload as { data?: unknown }).data
            : payload;

    if (!raw || typeof raw !== "object") {
        throw new Error("Khong nhan duoc du lieu tin nhan");
    }

    return raw as Message;
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

    const payload = responseData as { errors?: unknown };
    const errors = payload.errors;
    const nestedCode =
        errors && typeof errors === "object" && "code" in errors
            ? (errors as { code?: unknown }).code
            : undefined;

    return nestedCode === "MAX_PIN_LIMIT";
}

const chatService = {
    async getConversations(
        userId: number,
    ): Promise<ApiResponse<ConversationSidebar[]>> {
        const response = await apiClient.get(`/conversations`);
        return response.data;
    },

    async getForwardableConversations(): Promise<ApiResponse<ConversationSidebar[]>> {
        const response = await apiClient.get(`/conversations/forward-targets`);
        return response.data;
    },

    async getConversation(
        conversationId: number,
        userId: number,
    ): Promise<ApiResponse<Conversation>> {
        const response = await apiClient.get(
            `/conversations/${conversationId}`,
        );
        return response.data;
    },

    async fetchPinnedConversations(): Promise<ConversationPin[]> {
        const response = await apiClient.get("/pins");
        return unwrapApiData(
            response.data as ApiResponse<ConversationPin[]> | ConversationPin[],
        );
    },

    async pinConversation(conversationId: number): Promise<ConversationPin> {
        const response = await apiClient.post("/pins", { conversationId });
        return unwrapApiData(
            response.data as ApiResponse<ConversationPin> | ConversationPin,
        );
    },

    async unpinConversation(conversationId: number): Promise<void> {
        await apiClient.delete(`/pins/${conversationId}`);
    },

    async getConversationMembers(
        conversationId: number,
    ): Promise<Record<string, ConversationMember>> {
        const response = await apiClient.get(
            `/conversations/${conversationId}/members`,
        );
        return normalizeMembersPayload(response.data);
    },

    async getMessages(
        conversationId: number,
        userId: number,
        before?: string | null,
        limit = 20,
        signal?: AbortSignal,
    ): Promise<ApiResponse<CursorResponse<Message[]>>> {
        const params = new URLSearchParams({
            limit: String(limit),
        });

        if (before) {
            params.append("before", before);
        }

        const response = await apiClient.get(
            `/conversations/${conversationId}/messages?${params.toString()}`,
            { signal },
        );

        return response.data;
    },

    async getNewerMessages(
        conversationId: number,
        userId: number,
        after: string,
        limit = 20,
    ): Promise<ApiResponse<CursorResponse<Message[]>>> {
        const params = new URLSearchParams({
            limit: String(limit),
            after,
        });

        const response = await apiClient.get(
            `/conversations/${conversationId}/messages/newer?${params.toString()}`,
        );

        return response.data;
    },

    async jumpToMessage(
        conversationId: number,
        targetMessageId: string,
        userId: number,
    ): Promise<ApiResponse<CursorResponse<Message[]>>> {
        const response = await apiClient.get(
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
        limit = 5,
    ): Promise<MessageSearchResponse> {
        const response = await apiClient.get(
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
        const response = await apiClient.get(
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
        userId: number,
    ): Promise<Message> {
        const response = await apiClient.post(`/messages/send`, request);
        return normalizeMessagePayload(response.data);
    },

    async searchChatUserByPhone(phone: string): Promise<ChatUserSearchResult | null> {
        const response = await apiClient.get("/chat-users/search-by-phone", {
            params: { phone },
        });
        return unwrapApiData(
            response.data as ApiResponse<ChatUserSearchResult | null> | ChatUserSearchResult | null,
        );
    },

    async getChatUserRelationship(userId: number): Promise<ChatUserSearchResult | null> {
        const response = await apiClient.get(`/chat-users/${userId}/relationship`);
        return unwrapApiData(
            response.data as ApiResponse<ChatUserSearchResult | null> | ChatUserSearchResult | null,
        );
    },

    async resolveDirectConversation(receiverId: number): Promise<Conversation> {
        const response = await apiClient.post("/conversations/direct/resolve", {
            receiverId,
        });
        return unwrapApiData(response.data as ApiResponse<Conversation> | Conversation);
    },

    async createPoll(request: CreatePollRequest): Promise<Message> {
        const response = await apiClient.post(`/messages/polls`, request);
        return normalizeMessagePayload(response.data);
    },

    async getPoll(pollId: string): Promise<PollResponse> {
        const response = await apiClient.get(`/polls/${pollId}`);
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async votePoll(pollId: string, optionIds: string[]): Promise<PollResponse> {
        const response = await apiClient.post(`/polls/${pollId}/vote`, {
            optionIds,
        });
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async removePollVote(pollId: string): Promise<PollResponse> {
        const response = await apiClient.delete(`/polls/${pollId}/vote`);
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async addPollOption(pollId: string, text: string): Promise<PollResponse> {
        const response = await apiClient.post(`/polls/${pollId}/options`, {
            text,
        });
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async closePoll(pollId: string): Promise<PollResponse> {
        const response = await apiClient.patch(`/polls/${pollId}/close`);
        return unwrapApiData(response.data as ApiResponse<PollResponse> | PollResponse);
    },

    async forwardMessage(request: ForwardMessageRequest): Promise<Message[]> {
        const response = await apiClient.post(`/messages/forward`, request);
        return unwrapApiData(
            response.data as ApiResponse<Message[]> | Message[],
        );
    },

    async sendCallMessage(
        request: SendCallMessageRequest,
        userId: number,
    ): Promise<Message> {
        const response = await apiClient.post(
            `/messages/call?userId=${userId}`,
            request,
        );
        return normalizeMessagePayload(response.data);
    },

    async markAsRead(
        conversationId: number,
        userId: number,
        lastMessageId?: string,
    ): Promise<void> {
        const params = new URLSearchParams({});

        if (lastMessageId) {
            params.set("lastMessageId", lastMessageId);
        }

        await apiClient.put(
            `/conversations/${conversationId}/read?${params.toString()}`,
        );
    },

    async recallMessage(messageId: string, userId: number): Promise<void> {
        await apiClient.delete(`/messages/${messageId}/recall`);
    },

    async pinMessage(messageId: string, userId: number): Promise<void> {
        await apiClient.post(`/messages/${messageId}/pin`);
    },

    async unpinMessage(messageId: string, userId: number): Promise<void> {
        await apiClient.delete(`/messages/${messageId}/pin`);
    },

    async addReaction(messageId: string, emoji: string): Promise<Message> {
        const response = await apiClient.post(
            `/messages/${messageId}/reactions`,
            { emoji },
        );
        return normalizeMessagePayload(response.data);
    },

    async deleteMessageForMe(messageId: string, userId: number): Promise<void> {
        await apiClient.delete(`/messages/${messageId}/delete-for-me`);
    },

    async deleteConversationForMe(
        conversationId: number,
        userId: number,
    ): Promise<void> {
        await apiClient.delete(
            `/conversations/${conversationId}/delete-for-me`,
        );
    },

    async hideConversationForMe(
        conversationId: number,
        _userId: number,
    ): Promise<void> {
        await apiClient.patch(`/conversations/${conversationId}/hide-for-me`);
    },

    async createGroupConversation(
        request: CreateGroupRequest,
    ): Promise<Conversation> {
        const response = await apiClient.post("/conversations/group", request);

        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async createGroupConversationWithInvites(
        request: CreateGroupWithInvitesRequest,
    ): Promise<Conversation> {
        const response = await apiClient.post(
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
        const response = await apiClient.post(
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
        const response = await apiClient.post(
            `/conversations/${conversationId}/members-with-invites`,
            request,
        );

        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async leaveGroup(conversationId: number): Promise<Conversation> {
        const response = await apiClient.delete(
            `/conversations/${conversationId}/leave`,
        );

        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async kickGroupMember(
        conversationId: number,
        targetUserId: number,
        blockFromGroup = false,
    ): Promise<Conversation> {
        const response = await apiClient.delete(
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
        const response = await apiClient.get(
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
        const response = await apiClient.post(
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
        const response = await apiClient.delete(
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
        const response = await apiClient.patch(
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
        await apiClient.delete(`/conversations/${conversationId}/disband`);
    },

    async updateMessageRestriction(
        conversationId: number,
        isRestricted: boolean,
    ): Promise<Conversation> {
        const response = await apiClient.patch(
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
        const response = await apiClient.patch(
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
        const response = await apiClient.patch(
            `/conversations/${conversationId}/image`,
            { imageUrl },
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation> | Conversation,
        );
    },

    async processJoinRequest(
        conversationId: number,
        requestId: number,
        isApproved: boolean,
    ): Promise<void> {
        await apiClient.patch(
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
        const response = await apiClient.get(
            `/conversations/${conversationId}/join-requests`,
        );
        return unwrapApiData(
            response.data as ApiResponse<JoinRequest[]> | JoinRequest[],
        );
    },

    async cancelMyJoinRequest(conversationId: number): Promise<void> {
        await apiClient.delete(
            `/conversations/${conversationId}/join-requests/me`,
        );
    },

    async getOrCreateInviteLink(conversationId: number): Promise<string> {
        const response = await apiClient.get(
            `/conversations/${conversationId}/invite-link`,
        );
        const payload = response.data as ApiResponse<string> | string;
        return unwrapApiData(payload);
    },

    async resetInviteLink(conversationId: number): Promise<string> {
        const response = await apiClient.patch(
            `/conversations/${conversationId}/invite-link/reset`,
        );
        const payload = response.data as ApiResponse<string> | string;
        return unwrapApiData(payload);
    },

    async disableInviteLink(conversationId: number): Promise<void> {
        await apiClient.delete(`/conversations/${conversationId}/invite-link`);
    },

    async previewInvite(token: string): Promise<ConversationPreview> {
        const response = await apiClient.get(`/conversations/invite/${token}`);
        return unwrapApiData(
            response.data as ApiResponse<ConversationPreview> | ConversationPreview,
        );
    },

    async joinByInvite(token: string): Promise<Conversation | { message?: string }> {
        const response = await apiClient.post(
            `/conversations/invite/${token}/join`,
        );
        return unwrapApiData(
            response.data as ApiResponse<Conversation | { message?: string }> | Conversation | { message?: string },
        );
    },

    async updateConversationMemberNickname(
        request: UpdateNicknameRequest,
    ): Promise<void> {
        await apiClient.patch(
            `/conversations/${request.conversationId}/members/${request.targetUserId}/nickname`,
            request.nickname,
            {
                headers: {
                    "Content-Type": "text/plain",
                },
            },
        );
    },

    async getPresignedUrl(
        module: BulkPresignedRequest["module"],
        targetId: string,
        type: BulkPresignedRequest["files"][number]["type"],
        fileName: string,
        contentType: string,
    ): Promise<PresignedUrlResponse> {
        const list = await this.getBulkPresignedUrls({
            module,
            targetId,
            files: [{ type, fileName, contentType }],
        });

        if (!Array.isArray(list) || list.length === 0) {
            throw new Error("Khong lay duoc presigned URL");
        }

        return list[0];
    },

    async getBulkPresignedUrls(
        request: BulkPresignedRequest,
    ): Promise<PresignedUrlResponse[]> {
        const response = await apiClient.request({
            url: "/files/presigned-url",
            method: "post",
            data: request,
        });

        const payload = response.data as
            | PresignedUrlResponse[]
            | { data?: PresignedUrlResponse[] };

        if (Array.isArray(payload)) return payload;
        return Array.isArray(payload?.data) ? payload.data : [];
    },

    async uploadToS3(
        presignedUrl: string,
        file: LocalUploadFile,
        onProgress?: (loaded: number, total: number) => void,
    ): Promise<void> {
        const response = await fetch(file.uri);
        if (!response.ok) {
            throw new Error(`Khong the doc file local: ${file.fileName}`);
        }

        const blob = await response.blob();
        const totalBytes = file.fileSize > 0 ? file.fileSize : blob.size;

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl, true);
            xhr.setRequestHeader(
                "Content-Type",
                file.mimeType || "application/octet-stream",
            );

            xhr.upload.onprogress = (event) => {
                if (!onProgress) return;
                const total = event.lengthComputable
                    ? event.total
                    : totalBytes || 1;
                onProgress(event.loaded, total);
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    onProgress?.(totalBytes || 1, totalBytes || 1);
                    resolve();
                    return;
                }

                reject(
                    new Error(
                        `S3 upload failed (${xhr.status}): ${file.fileName}`,
                    ),
                );
            };

            xhr.onerror = () => {
                reject(new Error(`S3 upload network error: ${file.fileName}`));
            };

            xhr.onabort = () => {
                reject(new Error(`S3 upload aborted: ${file.fileName}`));
            };

            xhr.send(blob);
        });
    },

    getPinnedFromConversation(
        conversation: Conversation | null,
    ): PinnedMessageDetail[] {
        if (!conversation?.pinnedMessages) return [];
        return conversation.pinnedMessages;
    },
};

export default chatService;
