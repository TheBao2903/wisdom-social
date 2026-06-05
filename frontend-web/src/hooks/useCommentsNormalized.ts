import { useState, useCallback, useEffect } from "react";
import { commentService } from "../services/commentService";
import type { Comment } from "../services/commentService";
import {
    flattenCommentTree,
    getAllDescendants,
} from "../utils/commentTreeHelpers";

interface UseCommentsParams {
    targetType: string;
    targetId: string;
}

/**
 * NORMALIZED Facebook-style comment hook
 * 
 * Core principle: Flat store with relationship metadata
 * NO nested tree rendering, NO recursive state mutations
 */
export const useCommentsNormalized = ({
    targetType,
    targetId,
}: UseCommentsParams) => {
    const sortIdsByCreatedAt = useCallback(
        (
            ids: string[],
            map: Record<string, Comment>,
            order: "asc" | "desc" = "asc"
        ) => {
            return [...ids].sort((a, b) => {
                const aTime = new Date(map[a]?.createdAt || 0).getTime();
                const bTime = new Date(map[b]?.createdAt || 0).getTime();
                return order === "asc" ? aTime - bTime : bTime - aTime;
            });
        },
        []
    );

    // ============ DATA LAYER ============
    // Flat normalized store (commentId -> Comment)
    const [commentsById, setCommentsById] = useState<Record<string, Comment>>(
        {}
    );

    // ============ RELATIONSHIP LAYER ============
    // Mapping: parentId -> [childIds]
    // Key: "null" for root comments, commentId for nested
    const [childrenByParentId, setChildrenByParentId] = useState<
        Record<string, string[]>
    >({});

    // Root level comment IDs
    const [rootIds, setRootIds] = useState<string[]>([]);

    // ============ UI STATE LAYER ============
    // Which comments are expanded (user clicked "View replies")
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    // Which comments are loading replies
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    // ============ PAGINATION LAYER ============
    // Cursor for loading more replies
    const [replyCursor, setReplyCursor] = useState<Record<string, string | null>>({});

    // Whether there are more replies to load
    const [hasMoreReplies, setHasMoreReplies] = useState<Record<string, boolean>>({});

    // Root pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [rootHasMore, setRootHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    /**
     * Reset ALL state when targetId (postId) changes
     * This ensures each post loads with fresh comments
     */
    useEffect(() => {
        setCommentsById({});
        setChildrenByParentId({});
        setRootIds([]);
        setExpandedMap({});
        setLoadingMap({});
        setReplyCursor({});
        setHasMoreReplies({});
        setCurrentPage(0);
        setRootHasMore(false);
        setTotalCount(0);
        setLoading(false);
    }, [targetId]);

    /**
     * Load root comments (page-based pagination)
     * Flattens tree + initializes all state maps
     */
    const loadRootComments = useCallback(
        async (page = 0) => {
            try {
                setLoading(true);
                const response = await commentService.getRootComments(
                    targetType,
                    targetId,
                    page,
                    15
                );

                if (page === 0) {
                    // First page: replace all
                    const { commentsById: newById, childrenByParentId: newChildren, rootIds: newRootIds } =
                        flattenCommentTree(response.data);

                    console.log(`📋 Root comments loaded:`, {
                        rootCount: newRootIds.length,
                        totalComments: Object.keys(newById).length,
                        relationshipsCreated: Object.keys(newChildren).length,
                        childrenByParent: newChildren,
                    });

                    setCommentsById(newById);
                    setChildrenByParentId(newChildren);
                    setRootIds(sortIdsByCreatedAt(newRootIds, newById, "desc"));

                    // Initialize expanded + pagination state for ALL comments, not just roots
                    // This ensures nested comments also have hasMoreReplies, etc.
                    const initialExpanded: Record<string, boolean> = {};
                    const initialCursor: Record<string, string | null> = {};
                    const initialHasMore: Record<string, boolean> = {};

                    Object.keys(newById).forEach((id) => {
                        const comment = newById[id];
                        initialExpanded[id] = false; // Start all collapsed
                        initialCursor[id] = null;
                        initialHasMore[id] = comment.hasMoreReplies || false;
                    });

                    setExpandedMap(initialExpanded);
                    setReplyCursor(initialCursor);
                    setHasMoreReplies(initialHasMore);
                } else {
                    // Subsequent pages: append with dedup
                    const { commentsById: newById, rootIds: newRootIds } =
                        flattenCommentTree(response.data);

                    setCommentsById((prev) => ({ ...prev, ...newById }));
                    setChildrenByParentId((prev) => {
                        const merged = { ...prev };
                        const existingRoot = new Set(merged["null"] || []);
                        newRootIds.forEach((id) => {
                            if (!existingRoot.has(id)) {
                                merged["null"] = [...(merged["null"] || []), id];
                                existingRoot.add(id);
                            }
                        });
                        return merged;
                    });
                    setRootIds((prev) => {
                        const seen = new Set(prev);
                        // Keep current order and append older page items at the bottom.
                        return [...prev, ...newRootIds.filter((id) => !seen.has(id))];
                    });

                    // Initialize state for new comments from page 2+
                    setExpandedMap((prev) => {
                        const next = { ...prev };
                        Object.keys(newById).forEach((id) => {
                            if (!next[id]) next[id] = false;
                        });
                        return next;
                    });
                    setReplyCursor((prev) => {
                        const next = { ...prev };
                        Object.keys(newById).forEach((id) => {
                            if (!next[id]) next[id] = null;
                        });
                        return next;
                    });
                    setHasMoreReplies((prev) => {
                        const next = { ...prev };
                        Object.keys(newById).forEach((id) => {
                            if (!next[id]) next[id] = newById[id].hasMoreReplies || false;
                        });
                        return next;
                    });
                }

                setRootHasMore(response.hasMore);
                setTotalCount(response.totalCount);
                setCurrentPage(page);
            } catch (error) {
                console.error("❌ Error loading root comments:", error);
            } finally {
                setLoading(false);
            }
        },
        [targetType, targetId]
    );

    /**
     * Load more replies for a specific comment
     * Only appends direct children, does NOT auto-expand
     */
    const loadMoreReplies = useCallback(
        async (commentId: string) => {
            if (loadingMap[commentId]) return; // prevent double-load

            try {
                setLoadingMap((prev) => ({ ...prev, [commentId]: true }));

                const comment = commentsById[commentId];
                if (!comment) {
                    console.warn(`Comment ${commentId} not found`);
                    return;
                }

                const response = await commentService.getMoreReplies(
                    commentId,
                    replyCursor[commentId] || undefined,
                    10
                );

                if (!response?.data || response.data.length === 0) {
                    console.warn(`⚠️ No replies returned for ${commentId}`, response);
                }

                // Flatten new replies - pass commentId as parentId so children link correctly
                const { commentsById: newById, childrenByParentId: newChildren } =
                    flattenCommentTree(response.data, commentId);
                const mergedCommentMap = { ...commentsById, ...newById };

                console.log(`📥 Load more replies for ${commentId}:`, {
                    newCommentsCount: Object.keys(newById).length,
                    newChildren,
                    responseData: response.data,
                    parentId: commentId,
                });

                // Merge into state
                setCommentsById((prev) => {
                    console.log(`💾 Merging ${Object.keys(newById).length} new comments into commentsById`, {
                        newIds: Object.keys(newById),
                        prevSize: Object.keys(prev).length,
                    });
                    return { ...prev, ...newById };
                });
                setChildrenByParentId((prev) => {
                    const merged = { ...prev };
                    Object.keys(newChildren).forEach((parentId) => {
                        const prevChildren = merged[parentId] || [];
                        const nextChildren = [
                            ...prevChildren,
                            ...newChildren[parentId],
                        ];
                        const uniqueChildren = Array.from(new Set(nextChildren));
                        merged[parentId] = sortIdsByCreatedAt(
                            uniqueChildren,
                            mergedCommentMap,
                            "desc"
                        );
                        console.log(`🔗 Updated childrenByParentId['${parentId}']:`, {
                            before: prevChildren.length,
                            added: newChildren[parentId].length,
                            after: merged[parentId].length,
                            childIds: merged[parentId],
                        });
                    });
                    return merged;
                });

                // FIX: Init expandedMap + loadingMap for newly loaded comments
                setExpandedMap((prev) => {
                    const next = { ...prev };
                    Object.keys(newById).forEach((id) => {
                        if (!next[id]) {
                            next[id] = false; // Start collapsed
                        }
                    });
                    return next;
                });

                setLoadingMap((prev) => {
                    const next = { ...prev };
                    Object.keys(newById).forEach((id) => {
                        if (!next[id]) {
                            next[id] = false;
                        }
                    });
                    return next;
                });

                // FIX: Init hasMoreReplies for newly loaded comments
                setHasMoreReplies((prev) => {
                    const next = { ...prev };
                    Object.keys(newById).forEach((id) => {
                        if (!next[id]) {
                            next[id] = newById[id].hasMoreReplies || false;
                        }
                    });
                    return next;
                });

                // Update pagination for this comment
                setReplyCursor((prev) => ({
                    ...prev,
                    [commentId]: response.nextCursor || null,
                }));
                setHasMoreReplies((prev) => ({
                    ...prev,
                    [commentId]: response.hasMore,
                }));
            } catch (error) {
                console.error(
                    `❌ Error loading more replies for ${commentId}:`,
                    error
                );
            } finally {
                setLoadingMap((prev) => ({ ...prev, [commentId]: false }));
            }
        },
        [commentsById, loadingMap, replyCursor]
    );

    /**
     * Toggle expand/collapse for a comment
     * Does NOT auto-load children on expand - user must click "Load more replies"
     */
    const toggleExpanded = useCallback((commentId: string) => {
        setExpandedMap((prev) => ({
            ...prev,
            [commentId]: !prev[commentId],
        }));
    }, []);

    /**
     * Create new reply (optimistic update)
     */
    const createReply = useCallback(
        (parentId: string | null, newComment: Comment) => {
            setCommentsById((prev) => {
                const next = {
                    ...prev,
                    [newComment.id]: newComment,
                };

                // Keep parent replyCount in sync so UI state and counters update immediately.
                if (parentId && next[parentId]) {
                    next[parentId] = {
                        ...next[parentId],
                        replyCount: (next[parentId].replyCount || 0) + 1,
                    };
                }

                return next;
            });

            setChildrenByParentId((prev) => {
                const key = parentId === null ? "null" : parentId;
                const nextIds = Array.from(
                    new Set([...(prev[key] || []), newComment.id])
                );
                const map = {
                    ...commentsById,
                    [newComment.id]: newComment,
                };
                return {
                    ...prev,
                    [key]:
                        key === "null"
                            ? sortIdsByCreatedAt(nextIds, map, "desc")
                            : sortIdsByCreatedAt(nextIds, map, "desc"),
                };
            });

            // If root comment, add to rootIds at top (newest first)
            if (parentId === null) {
                setRootIds((prev) =>
                    Array.from(new Set([newComment.id, ...prev]))
                );
            }

            // If replying to an existing comment, auto-expand parent so lv2 appears immediately.
            setExpandedMap((prev) => {
                const next = { ...prev, [newComment.id]: false };
                if (parentId) {
                    next[parentId] = true;
                }
                return next;
            });

            setLoadingMap((prev) => ({ ...prev, [newComment.id]: false }));
            setReplyCursor((prev) => ({ ...prev, [newComment.id]: null }));
            setHasMoreReplies((prev) => ({ ...prev, [newComment.id]: false }));
        },
        [commentsById, sortIdsByCreatedAt]
    );

    /**
     * Delete comment and all descendants
     */
    const deleteComment = useCallback((commentId: string, parentId?: string) => {
        // Get all descendants
        setChildrenByParentId((prevChildren) => {
            const descendants = getAllDescendants(commentId, prevChildren);
            const toDelete = new Set([commentId, ...descendants]);

            // Remove from commentsById
            setCommentsById((prev) => {
                const next = { ...prev };
                const resolvedParentId = parentId ?? prev[commentId]?.parentId ?? null;
                toDelete.forEach((id) => delete next[id]);

                // Keep parent direct-reply count in sync after deletion.
                if (resolvedParentId && next[resolvedParentId]) {
                    next[resolvedParentId] = {
                        ...next[resolvedParentId],
                        replyCount: Math.max(
                            0,
                            (next[resolvedParentId].replyCount || 0) - 1
                        ),
                    };
                }

                return next;
            });

            // Remove from childrenByParentId
            const nextChildren = { ...prevChildren };
            Object.keys(nextChildren).forEach((parentId) => {
                nextChildren[parentId] = nextChildren[parentId].filter(
                    (id) => !toDelete.has(id)
                );
            });

            // Remove from rootIds and check if rootHasMore needs update
            setRootIds((prev) => {
                const nextRootIds = prev.filter((id) => !toDelete.has(id));

                // FIX: Update rootHasMore if not enough root comments left
                // If we're on the first page and have fewer than 15 comments,
                // there's no more to load
                if (currentPage === 0 && nextRootIds.length < 15) {
                    setRootHasMore(false);
                    console.log(
                        `🔄 Updated rootHasMore to false after delete (rootIds: ${nextRootIds.length}, currentPage: ${currentPage})`
                    );
                }

                return nextRootIds;
            });

            // Clean up UI state
            setExpandedMap((prev) => {
                const next = { ...prev };
                toDelete.forEach((id) => delete next[id]);
                return next;
            });
            setReplyCursor((prev) => {
                const next = { ...prev };
                toDelete.forEach((id) => delete next[id]);
                return next;
            });
            setHasMoreReplies((prev) => {
                const next = { ...prev };
                toDelete.forEach((id) => delete next[id]);
                return next;
            });
            setLoadingMap((prev) => {
                const next = { ...prev };
                toDelete.forEach((id) => delete next[id]);
                return next;
            });

            return nextChildren;
        });
    }, [currentPage]);

    /**
     * Reset ALL state (for modal close)
     */
    const resetComments = useCallback(() => {
        setCommentsById({});
        setChildrenByParentId({});
        setRootIds([]);
        setExpandedMap({});
        setLoadingMap({});
        setReplyCursor({});
        setHasMoreReplies({});
        setCurrentPage(0);
        setRootHasMore(false);
        setTotalCount(0);
    }, []);

    /**
     * Get direct children of a comment (for rendering)
     */
    const getDirectChildren = useCallback(
        (commentId: string | null): Comment[] => {
            const key = commentId === null ? "null" : commentId;
            const childIds = childrenByParentId[key] || [];
            const sortedChildIds = sortIdsByCreatedAt(childIds, commentsById, "desc");
            const children = sortedChildIds
                .map((id) => commentsById[id])
                .filter(Boolean);

            // DEBUG: Log when children are empty but expected
            if (childIds.length > 0 && children.length === 0) {
                console.error(`⚠️ Missing children for ${commentId}:`, {
                    key,
                    childIds: sortedChildIds,
                    missingIds: sortedChildIds.filter((id) => !commentsById[id]),
                    availableInComments: sortedChildIds.filter(
                        (id) => commentsById[id]
                    ),
                });
            }

            return children;
        },
        [commentsById, childrenByParentId, sortIdsByCreatedAt]
    );

    /**
     * Update reaction count for a comment in realtime
     */
    const handleCommentReactionUpdate = useCallback((commentId: string, action: "REACT" | "UNREACT") => {
        setCommentsById(prev => {
            const comment = prev[commentId];
            if (!comment) return prev;
            return {
                ...prev,
                [commentId]: {
                    ...comment,
                    reactCount: action === "REACT" ? (comment.reactCount || 0) + 1 : Math.max(0, (comment.reactCount || 0) - 1)
                }
            };
        });
    }, []);

    return {
        // Data
        commentsById,
        childrenByParentId,
        rootIds,

        // UI state
        expandedMap,
        loadingMap,
        replyCursor,
        hasMoreReplies,

        // Pagination
        currentPage,
        rootHasMore,
        totalCount,
        loading,

        // Operations
        loadRootComments,
        loadMoreReplies,
        toggleExpanded,
        createReply,
        deleteComment,
        getDirectChildren,
        resetComments,
        handleCommentReactionUpdate,
    };
};

export default useCommentsNormalized;
