/**
 * Comment Helpers - Normalized Store
 * 
 * DEPRECATED: Old tree-based helpers (findCommentInTree, findCommentPath, 
 * appendReplyToComment, insertReplyToComment, deleteCommentFromTree, 
 * updateCommentPaginationInfo) have been removed as part of the migration
 * to the normalized flat-store architecture.
 * 
 * Only normalized store helpers remain below.
 */
import type { Comment } from '../services/commentService';

/**
 * ========== NORMALIZED STORE HELPERS ==========
 * For Facebook-style flat store architecture (useCommentsNormalized)
 */

/**
 * Flatten a tree into normalized store
 * Supports both root comments and nested replies
 * 
 * @param tree Comment array to flatten
 * @param initialParentId Parent ID to use for root of this tree (null for root comments, id for nested)
 * Returns: { commentsById, childrenByParentId, rootIds }
 */
export const flattenCommentTree = (tree: Comment[], initialParentId: string | null = null) => {
    const commentsById: Record<string, Comment> = {};
    const childrenByParentId: Record<string, string[]> = {};
    const rootIds: string[] = [];

    const traverse = (comments: Comment[], parentId: string | null = initialParentId) => {
        comments.forEach((comment) => {
            // Store in flat map (without replies to avoid nested data)
            commentsById[comment.id] = {
                ...comment,
                replies: [], // clear nested data in normalized store
            };

            // Track children relationship
            if (parentId === null) {
                rootIds.push(comment.id);
                childrenByParentId[null as any] =
                    childrenByParentId[null as any] || [];
                (childrenByParentId[null as any] as string[]).push(comment.id);
            } else {
                childrenByParentId[parentId] =
                    childrenByParentId[parentId] || [];
                childrenByParentId[parentId].push(comment.id);
            }

            // Recurse into replies (in case backend returns nested structure)
            if (comment.replies?.length) {
                traverse(comment.replies, comment.id);
            }
        });
    };

    traverse(tree, initialParentId);

    return { commentsById, childrenByParentId, rootIds };
};

/**
 * Get all descendants of a comment (for deletion cascade)
 */
export const getAllDescendants = (
    commentId: string,
    childrenByParentId: Record<string, string[]>
): string[] => {
    const descendants: string[] = [];
    const queue = [commentId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const children = childrenByParentId[current] || [];
        descendants.push(...children);
        queue.push(...children);
    }

    return descendants;
};
