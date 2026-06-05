import axiosClient from '../api/axiosClient';

const COMMENTS_BASE = '/comments';

interface Comment {
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

interface PaginatedResponse {
    data: Comment[];
    hasMore: boolean;
    nextCursor: string | null;
    totalCount: number;
}

interface ReactionSummaryItem {
    type: string;
    count: number;
}

interface ReactionSummary {
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
        const response = await axiosClient.get(`${COMMENTS_BASE}/root`, {
            params: { targetType, targetId, page, size },
        });
        return response.data.data;
    },

    /**
     * Get a specific comment with its initial replies
     * Replies sorted: cũ → mới, limit to 3
     */
    getCommentWithReplies: async (
        commentId: string,
        replyLimit = 3
    ): Promise<Comment> => {
        const response = await axiosClient.get(`${COMMENTS_BASE}/${commentId}/with-replies`, {
            params: { replyLimit },
        });
        return response.data.data;
    },

    /**
     * Get more replies using cursor-based pagination
     * Sorted: cũ → mới
     */
    getMoreReplies: async (
        parentId: string,
        cursor?: string | null,
        size = 10
    ): Promise<PaginatedResponse> => {
        const response = await axiosClient.get(`${COMMENTS_BASE}/${parentId}/replies`, {
            params: { cursor, size },
        });
        return response.data.data;
    },

    /**
     * Create a new comment or reply
     */
    createComment: async (
        targetType: string,
        targetId: string,
        content: string,
        userId: number,
        parentId: string | null = null,
        mentions: { userId: string; username: string }[] = []
    ): Promise<Comment> => {
        const response = await axiosClient.post(
            COMMENTS_BASE,
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
        return response.data.data;
    },

    /**
     * Delete a comment
     */
    deleteComment: async (commentId: string, userId: number): Promise<void> => {
        await axiosClient.delete(`${COMMENTS_BASE}/${commentId}`, {
            params: { userId },
        });
    },

    /**
     * Submit reaction on a comment
     */
    toggleCommentReaction: async (
        userId: string,
        commentId: string,
        reactionType: string
    ): Promise<any> => {
        const response = await axiosClient.post(`/reactions/toggle`, null, {
            params: {
                userId,
                targetType: "COMMENT",
                targetId: commentId,
                reactionType,
            },
        });
        return response.data.data;
    },

    /**
     * Fetch reaction summary for a comment (total count + top reaction types)
     */
    fetchCommentReactionSummary: async (
        commentId: string,
        top = 3
    ): Promise<ReactionSummary> => {
        const response = await axiosClient.get(`/reactions/summary`, {
            params: {
                targetType: "COMMENT",
                targetId: commentId,
                top,
            },
        });

        const data = response.data?.data;
        return {
            totalCount: Number(data?.totalCount || 0),
            topReactions: Array.isArray(data?.topReactions) ? data.topReactions : [],
        };
    },

    /**
     * Fetch reactions count for a comment
     */
    fetchCommentReactionsCount: async (commentId: string): Promise<number> => {
        const response = await axiosClient.get(`/reactions`, {
            params: { targetType: "COMMENT", targetId: commentId },
        });
        return response.data.data?.length || 0;
    },

    /**
     * Fetch user's reaction on a comment
     */
    fetchUserCommentReaction: async (
        userId: string,
        commentId: string
    ): Promise<{ type: string } | null> => {
        try {
            const response = await axiosClient.get(`/reactions/user`, {
                params: {
                    userId,
                    targetType: "COMMENT",
                    targetId: commentId,
                },
            });
            return response.data.data || null;
        } catch (error) {
            return null;
        }
    },
};

export type { Comment, PaginatedResponse, ReactionSummary, ReactionSummaryItem };