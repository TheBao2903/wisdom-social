/**
 * 📌 PostComments Component (MOST IMPORTANT)
 *
 * Responsibility:
 * - Manage entire comment tree lifecycle using useCommentsNormalized hook
 * - Handle:
 *   - Comments loading (paginated)
 *   - Lazy-loading replies for nested comments
 *   - Expansion of comment chains (including hidden replies)
 *   - Comment input and submission
 *   - Comment deletion
 *   - Mention handling in input
 * - Auto-expand Correct comment chain when navigating from PostCard
 * - Scroll to target comment with highlight effect
 *
 * Why:
 * - Comment logic is complex and critical for user experience
 * - Isolating here makes debugging easier (all comment state in one component)
 * - Ensures laser-focused responsibility
 * - Centralizes async expansion logic with error handling
 *
 * Props:
 * - postId: string
 * - currentUser: UserData | undefined
 *
 * State Management (from useCommentsNormalized hook):
 * - commentsById: Record<string, Comment> (normalized flat store)
 * - rootIds: string[] (root-level comment IDs)
 * - expandedMap: Record<string, boolean> (which comments are expanded)
 * - loadingMap: Record<string, boolean> (which are loading replies)
 * - hasMoreReplies: Record<string, boolean> (pagination state)
 * - pendingExpandId: string | null (comment to auto-expand from navigation)
 * - commentsLoaded: boolean (initial load complete)
 *
 * Critical Features:
 * 1. Auto-Expand On Navigation:
 *    - Detects expandCommentId from location.state
 *    - If target not loaded, searches for parent with hasMoreReplies
 *    - Recursively loads missing parents until target found
 *    - Expands full chain only after target confirmed in commentsById
 *    - Can abort expansion if user closes modal
 *
 * 2. Lazy-Load Hidden Replies:
 *    - Comment replies only fetch when user clicks expand
 *    - If target is nested deep, auto-loads parent replies
 *    - Uses AbortController to prevent race conditions
 *
 * 3. Comment Input:
 *    - Handles @mention autocomplete
 *    - Submits new comments as root replies
 *    - Clears input on success
 *
 * 4. Comment Deletion:
 *    - Removes from normalized store
 *    - Also removes all descendants
 *    - Optimistic update
 *
 * Side Effects:
 * - useEffect: Watch for expandCommentId in location.state
 * - useEffect: Auto-expand when target appears in commentsById
 * - useEffect: Auto-load comments when modal opens
 * - useEffect: Cleanup on close (abort expansion, reset state)
 *
 * Notes:
 * - CRITICAL: Must handle race conditions (multiple expanding at once)
 * - CRITICAL: Must not load same parent twice (duplicate API calls)
 * - Must preserve all comment state safely on navigation
 * - Mentions are highlighted but not yet linked (prepared for future)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import useCommentsNormalized from "../../../../hooks/useCommentsNormalized";
import { commentService } from "../../../../services/commentService";
import type { Comment } from "../../../../services/commentService";
import type { UserData, PostData } from "../../../../types/post";
import CommentItemNormalized from "../../post-comment/CommentItemNormalized";
import CommentInput from "./CommentInput";
import useRealtimeComments from "../../../../hooks/useRealtimeComments";
import useRealtimeReactions from "../../../../hooks/useRealtimeReactions";
import useMentions from "../../../../hooks/useMentions";

interface PostCommentsProps {
  postId: string;
  viewerId: string;
  allowComments?: boolean;
  post: PostData;
}

const PostComments: React.FC<PostCommentsProps> = ({ postId, viewerId, allowComments, post }) => {
  const location = useLocation();
  const commentInputRef = useRef<HTMLInputElement>(null);

  // ============ MENTIONS HOOK ============
  const {
    mentionUsers,
    showMentionDropdown,
    handleTextChange: handleMentionChange,
    selectUser,
    getFinalMentions,
    mentionLoading,
    mentionHasMore,
    loadMoreMentions,
  } = useMentions(viewerId);

  // ============ COMMENT STATE ============
  const {
    commentsById,
    rootIds,
    expandedMap,
    loadingMap,
    hasMoreReplies,
    currentPage,
    rootHasMore,
    loadRootComments,
    loadMoreReplies,
    toggleExpanded,
    createReply,
    deleteComment,
    getDirectChildren,
    resetComments,
    handleCommentReactionUpdate,
  } = useCommentsNormalized({
    targetType: "POST",
    targetId: postId,
  });

  // ============ REALTIME COMMENTS ============
  useRealtimeComments({
    postId,
    commentsById,
    createReply,
    deleteComment,
    viewerId,
  });

  // ============ REALTIME REACTIONS ============
  useRealtimeReactions({
    postId,
    onReactionUpdate: (event) => {
      // Don't update for own actions
      if (event.userId === viewerId) return;

      if (event.targetType === "COMMENT") {
        handleCommentReactionUpdate(event.targetId, event.action);
      }
      // Post reactions in modal? Currently handled by parent usually, 
      // but if we want it here we'd need a setLikesCount prop
    }
  });

  // ============ UI STATE ============
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [pendingExpandId, setPendingExpandId] = useState<string | null>(null);
  const expandableAbortRef = useRef<AbortController | null>(null);

  // ============ COMMENT INPUT STATE ============
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const commentsByIdRef = useRef(commentsById);

  // Update ref whenever commentsById changes
  useEffect(() => {
    commentsByIdRef.current = commentsById;
  }, [commentsById]);

  // ============ EFFECT: Update pending expand ID on navigation ============
  useEffect(() => {
    const expandCommentId = location.state?.expandCommentId;
    if (expandCommentId && expandCommentId !== pendingExpandId) {
      setPendingExpandId(expandCommentId);
      // Cancel any previous expansion
      if (expandableAbortRef.current) {
        expandableAbortRef.current.abort();
      }
      expandableAbortRef.current = new AbortController();
    }
  }, [location.state?.expandCommentId]);

  // ============ Async Expansion: Build parent chain ============
  const getCommentChainPath = (commentId: string): string[] => {
    const path: string[] = [commentId];
    let current = commentsByIdRef.current[commentId];

    while (current?.parentId && commentsByIdRef.current[current.parentId]) {
      path.unshift(current.parentId);
      current = commentsByIdRef.current[current.parentId];
    }

    return path;
  };

  // ============ Async Expansion: Load + Expand ============
  const expandCommentChainAsync = useCallback(
    async (targetCommentId: string, signal: AbortSignal) => {
      try {
        // Check if comment exists using ref to avoid dependency loop
        if (!commentsByIdRef.current[targetCommentId]) {
          console.warn(
            `⚠️ Target comment ${targetCommentId} not found in commentsById. ` +
              `Checking for parents with unloaded replies...`
          );

          // Find root with unloaded replies that might contain target
          let loadedFromParent = false;
          for (const rootId of rootIds) {
            if (signal.aborted) break;
            if (hasMoreReplies[rootId]) {
              console.log(`📥 Loading more replies from root ${rootId}...`);
              await loadMoreReplies(rootId);
              loadedFromParent = true;
              if (commentsById[targetCommentId]) {
                console.log(
                  `✅ Found target ${targetCommentId} after loading from ${rootId}`
                );
                break;
              }
            }
          }

          if (!loadedFromParent) {
            console.warn(
              `⚠️ Could not locate parent replies. ` +
                `Try passing parentCommentId in location.state.expandParentId.`
            );
          }

          if (!commentsById[targetCommentId]) {
            console.warn(
              `❌ Target comment ${targetCommentId} still not found after loading`
            );
            return;
          }
        }

        const chain = getCommentChainPath(targetCommentId);
        console.log(
          `🔗 Expanding chain for ${targetCommentId}:`,
          chain.length > 1 ? chain.slice(0, -1).join(" → ") + " → " : "",
          targetCommentId
        );

        for (const commentId of chain) {
          if (signal.aborted) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
          toggleExpanded(commentId);
        }

        // Scroll + highlight
        if (!signal.aborted) {
          setTimeout(() => {
            const el = document.getElementById(`comment-${targetCommentId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-blue-400", "rounded");
              setTimeout(
                () => el.classList.remove("ring-2", "ring-blue-400", "rounded"),
                2000
              );
              console.log(
                `✅ Expanded and scrolled to comment ${targetCommentId}`
              );
            }
          }, 150);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log(`🛑 Expansion cancelled for ${targetCommentId}`);
        }
      }
    },
    [rootIds, hasMoreReplies, loadMoreReplies, toggleExpanded]
  );

  // ============ EFFECT: Auto-expand when comments load ============
  useEffect(() => {
    if (!pendingExpandId || !commentsLoaded) {
      return;
    }

    const signal = expandableAbortRef.current?.signal;
    if (signal && !signal.aborted) {
      expandCommentChainAsync(pendingExpandId, signal).then(() => {
        // Only clear if comment was found
        if (commentsByIdRef.current[pendingExpandId]) {
          setPendingExpandId(null);
        }
      });
    }
  }, [pendingExpandId, commentsLoaded]); // Removed commentsById and expandCommentChainAsync

  // ============ EFFECT: Load root comments on mount ============
  useEffect(() => {
    const loadInitialComments = async () => {
      try {
        await loadRootComments(0);
        setCommentsLoaded(true);
        console.log("✅ Initial comments loaded");
      } catch (error) {
        console.error("❌ Error loading initial comments:", error);
      }
    };

    loadInitialComments();
  }, [postId, loadRootComments]);

  // ============ Cleanup: On unmount or postId change ============
  useEffect(() => {
    return () => {
      if (expandableAbortRef.current) {
        expandableAbortRef.current.abort();
      }
      resetComments();
      setCommentsLoaded(false);
      setPendingExpandId(null);
    };
  }, [postId, resetComments]);

  // ============ Comment Input: Handle change + mention search ============
  const handleCommentInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCommentInput(value);
    setMentionCursorPos(cursorPos);
    
    handleMentionChange(value, cursorPos);
  };

  // ============ Comment Input: Handle mention selection ============
  const handleSelectMention = (user: UserData) => {
    const { newValue, newCursorPos } = selectUser(commentInput, user);

    setCommentInput(newValue);
    setMentionCursorPos(newCursorPos);
    
    // Refocus and set cursor
    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        commentInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleCommentCursorChange = (cursorPos: number) => {
    setMentionCursorPos(cursorPos);
  };

  const handleInsertEmoji = (emoji: string) => {
    const safeCursorPos = Math.min(
      Math.max(mentionCursorPos, 0),
      commentInput.length
    );
    const newValue =
      commentInput.slice(0, safeCursorPos) +
      emoji +
      commentInput.slice(safeCursorPos);

    setCommentInput(newValue);
    setMentionCursorPos(safeCursorPos + emoji.length);
  };

  // ============ Comment Input: Submit new comment ============
  const handleSubmitComment = async () => {
    if (!commentInput.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      if (!viewerId) {
        alert("Please login to comment");
        return;
      }

      const finalMentions = getFinalMentions(commentInput);
      const newComment = await commentService.createComment(
        "POST",
        postId,
        commentInput,
        Number(viewerId),
        undefined,
        finalMentions
      );

      createReply(null, newComment);
      setCommentInput("");
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      alert(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to submit comment"
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  // ============ Comment: Handle delete ============
  const handleDeleteComment = async (commentId: string, parentId?: string) => {
    if (
      !confirm("Bạn có chắc muốn xóa bình luận này? (Tất cả replies sẽ bị xóa)")
    )
      return;

    try {
      if (!viewerId) {
        alert("Please login to delete comment");
        return;
      }
      await commentService.deleteComment(commentId, Number(viewerId));
      deleteComment(commentId, parentId);
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Không thể xóa bình luận");
    }
  };

  // ============ Comment: Handle reply created ============
  const handleReplyCreated = (parentId: string | null, newReply: Comment) => {
    createReply(parentId, newReply);
  };

  return (
    <>
      {/* Comments List Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Post Caption as the first "Comment" */}
          <div className="flex flex-col gap-3 pb-4">
            <div className="flex-1 space-y-2">
              <div className="text-sm">
                <span className="dark:text-gray-200 whitespace-pre-wrap">{post.content}</span>
              </div>
            </div>
          </div>

          {rootIds.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No comments yet
            </p>
          ) : (
            <>
              {/* Render Root Comments */}
              {rootIds.map((commentId) => (
                <CommentItemNormalized
                  key={commentId}
                  commentId={commentId}
                  commentsById={commentsById}
                  expandedMap={expandedMap}
                  onToggleExpanded={toggleExpanded}
                  onLoadMore={loadMoreReplies}
                  onDelete={handleDeleteComment}
                  onCreateReply={handleReplyCreated}
                  getDirectChildren={getDirectChildren}
                  hasMoreReplies={hasMoreReplies}
                  loadingMap={loadingMap}
                  postId={postId}
                  currentUserId={viewerId}
                  allowComments={allowComments}
                />
              ))}

              {/* Load More Comments Button */}
              {rootHasMore && (
                <div className="w-full flex justify-center pt-2">
                  <button
                    onClick={() => loadRootComments(currentPage + 1)}
                    className="px-3 py-1 text-sm text-blue-500 hover:text-blue-600 font-semibold"
                  >
                    See more comments
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Comment Input Section */}
      {allowComments !== false && (
        <CommentInput
          inputRef={commentInputRef}
          commentInput={commentInput}
          submittingComment={submittingComment}
          showMentionDropdown={showMentionDropdown}
          mentionUsers={mentionUsers}
          mentionLoading={mentionLoading}
          mentionHasMore={mentionHasMore}
          onLoadMoreMentions={loadMoreMentions}
          onCommentChange={handleCommentInputChange}
          onCursorChange={handleCommentCursorChange}
          onInsertEmoji={handleInsertEmoji}
          onSelectMention={handleSelectMention}
          onSubmitComment={handleSubmitComment}
        />
      )}
    </>
  );
};

export default PostComments;
