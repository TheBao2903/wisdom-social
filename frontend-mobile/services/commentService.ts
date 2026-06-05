import apiClient from "@/api/apiClient";

export interface Comment {
    id: string;
    userId: string;
    targetType: string;
    targetId: string;
    parentId: string | null;
    content: string;
    mentions: { userId: string; username: string }[];
    reactCount: number;
    replyCount: number;
    status: string;
    isEdited: boolean;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    replies: Comment[];
    hasMoreReplies: boolean;
    nextCursor: string | null;
}

export interface PaginatedResponse {
    data: Comment[];
    hasMore: boolean;
    nextCursor: string | null;
    totalCount: number;
}

export interface ReactionSummaryItem {
    type: string;
    count: number;
}

export interface ReactionSummary {
    totalCount: number;
    topReactions: ReactionSummaryItem[];
}

export const commentService = {
    /**
     * Get root comments (cấp 1) of post/target with pagination
     * Sorted: mới → cũ
     * Each comment includes initial replies (first 3)
     */
    getRootComments: async (
        targetType: string,
        targetId: string,
        page = 0,
        size = 10
    ): Promise<PaginatedResponse> => {
        const response = await apiClient.get("/comments/root", {
            params: { targetType, targetId, page, size },
        });
        const res = response.data?.data ?? response.data;
        return {
            data: Array.isArray(res?.data) ? res.data : [],
            hasMore: Boolean(res?.hasMore),
            nextCursor: res?.nextCursor || null,
            totalCount: Number(res?.totalCount || 0),
        };
    },

    /**
     * Get a specific comment with its initial replies
     */
    getCommentWithReplies: async (
        commentId: string,
        replyLimit = 3
    ): Promise<Comment> => {
        const response = await apiClient.get(`/comments/${commentId}/with-replies`, {
            params: { replyLimit },
        });
        return response.data?.data ?? response.data;
    },

    /**
     * Get more replies using cursor-based pagination
     */
    getMoreReplies: async (
        parentId: string,
        cursor?: string | null,
        size = 10
    ): Promise<PaginatedResponse> => {
        const response = await apiClient.get(`/comments/${parentId}/replies`, {
            params: { cursor, size },
        });
        const res = response.data?.data ?? response.data;
        return {
            data: Array.isArray(res?.data) ? res.data : [],
            hasMore: Boolean(res?.hasMore),
            nextCursor: res?.nextCursor || null,
            totalCount: Number(res?.totalCount || 0),
        };
    },

    /**
     * Create a new comment or reply
     */
    createComment: async (
        targetType: string,
        targetId: string,
        content: string,
        userId: string | number,
        parentId: string | null = null,
        mentions: { userId: string; username: string }[] = []
    ): Promise<Comment> => {
        const response = await apiClient.post(
            "/comments",
            {
                targetType,
                targetId,
                content,
                parentId: parentId || null,
                mentions,
            },
            {
                params: { userId },
            }
        );
        return response.data?.data ?? response.data;
    },

    /**
     * Delete a comment
     */
    deleteComment: async (commentId: string, userId: string | number): Promise<void> => {
        await apiClient.delete(`/comments/${commentId}`, {
            params: { userId },
        });
    },

    /**
     * Submit reaction on a comment
     */
    toggleCommentReaction: async (
        userId: string | number,
        commentId: string,
        reactionType: string
    ): Promise<any> => {
        const response = await apiClient.post(`/reactions/toggle`, null, {
            params: {
                userId,
                targetType: "COMMENT",
                targetId: commentId,
                reactionType,
            },
        });
        return response.data?.data ?? response.data;
    },

    /**
     * Fetch reaction summary for a comment (total count + top reaction types)
     */
    fetchCommentReactionSummary: async (
        commentId: string,
        top = 3
    ): Promise<ReactionSummary> => {
        const response = await apiClient.get(`/reactions/summary`, {
            params: {
                targetType: "COMMENT",
                targetId: commentId,
                top,
            },
        });

        const data = response.data?.data ?? response.data;
        return {
            totalCount: Number(data?.totalCount || 0),
            topReactions: Array.isArray(data?.topReactions) ? data.topReactions : [],
        };
    },

    /**
     * Fetch user's reaction on a comment
     */
    fetchUserCommentReaction: async (
        userId: string | number,
        commentId: string
    ): Promise<{ type: string } | null> => {
        try {
            const response = await apiClient.get(`/reactions/user`, {
                params: {
                    userId,
                    targetType: "COMMENT",
                    targetId: commentId,
                },
            });
            const data = response.data?.data ?? response.data;
            // Check if data is a valid reaction object with type property
            if (data && typeof data === 'object' && 'type' in data && data.type) {
                return { type: data.type };
            }
            return null;
        } catch {
            return null;
        }
    },
};
