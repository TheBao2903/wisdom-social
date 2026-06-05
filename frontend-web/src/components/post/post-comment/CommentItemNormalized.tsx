import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Smile } from "lucide-react";
import useMentions from "../../../hooks/useMentions";
import { Theme } from "emoji-picker-react";
import { useAuth } from "../../../contexts/AuthContext";
import * as postApi from "../../../services/postService";
import { commentService } from "../../../services/commentService";
import type { Comment } from "../../../services/commentService";
import type { UserData } from "../../../types/post";
import IconModal from "../../icon-modal/IconModal";
import { getAvatarUrl } from "../../../utils/s3";

interface CommentItemNormalizedProps {
  commentId: string;
  commentsById: Record<string, Comment>;
  expandedMap: Record<string, boolean>;
  onToggleExpanded: (commentId: string) => void;
  onLoadMore: (commentId: string) => void;
  onDelete: (commentId: string, parentId?: string) => void;
  onCreateReply: (parentId: string, newComment: Comment) => void;
  onReplyClick?: (commentId: string, e: React.MouseEvent) => void;
  getDirectChildren: (commentId: string) => Comment[];
  hasMoreReplies: Record<string, boolean>;
  loadingMap: Record<string, boolean>;
  postId: string;
  level?: number;
  currentUserId?: string;
  allowComments?: boolean;
}

export default function CommentItemNormalized({
  commentId,
  commentsById,
  expandedMap,
  onToggleExpanded,
  onLoadMore,
  onDelete,
  onCreateReply,
  onReplyClick,
  getDirectChildren,
  hasMoreReplies,
  loadingMap,
  postId,
  level = 0,
  currentUserId,
  allowComments,
}: CommentItemNormalizedProps) {
  const comment = commentsById[commentId];
  if (!comment) return null;

  const expanded = expandedMap[commentId] || false;
  const loading = loadingMap[commentId] || false;

  const [commentUser, setCommentUser] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const { currentUser } = useAuth();
  const activeUserId = currentUserId || currentUser?.id?.toString() || "";

  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);
  const [replyEmojiPosition, setReplyEmojiPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [replyCursorPos, setReplyCursorPos] = useState(0);
  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const replyEmojiButtonRef = useRef<HTMLButtonElement | null>(null);

  // ============ MENTIONS HOOK ============
  const {
    mentionUsers,
    showMentionDropdown,
    handleTextChange: handleMentionChange,
    selectUser,
    getFinalMentions,
    mentionLoading,
    loadMoreMentions,
    setActiveMentions,
  } = useMentions(activeUserId);

  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [reactionSummary, setReactionSummary] = useState<{
    totalCount: number;
    topReactions: { type: string; count: number }[];
  }>({
    totalCount: Number(comment.reactCount || 0),
    topReactions: [],
  });
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionDetail, setReactionDetail] = useState<{
    totalCount: number;
    topReactions: { type: string; count: number }[];
  }>({
    totalCount: 0,
    topReactions: [],
  });
  const fetchReactionSummary = useCallback(async () => {
    try {
      const summary = await commentService.fetchCommentReactionSummary(
        comment.id
      );
      setReactionSummary(summary);
    } catch (error) {
      setReactionSummary((prev) => ({
        ...prev,
        totalCount: Number(comment.reactCount || 0),
      }));
    }
  }, [comment.id, comment.reactCount]);

  useEffect(() => {
    fetchReactionSummary();
  }, [fetchReactionSummary]);

  const [reactionTimeout, setReactionTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Fetch user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await postApi.fetchUserById(comment.userId);
        setCommentUser(user);
      } catch (error) {
        console.error("Error fetching comment user:", error);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, [comment.userId]);

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReplyClick) {
      onReplyClick(commentId, e);
      return;
    }

    if (!showReplyInput) {
      setShowReplyInput(true);
      // Auto-tag the user
      if (commentUser) {
        const tag = `@${commentUser.username} `;
        setReplyContent(tag);
        setReplyCursorPos(tag.length);
        
        // Track the mention
        setActiveMentions([{
          userId: commentUser.id.toString(),
          username: commentUser.username
        }]);
      }
      
      // Focus the input
      setTimeout(() => {
        if (replyInputRef.current) {
          replyInputRef.current.focus();
          const length = replyInputRef.current.value.length;
          replyInputRef.current.setSelectionRange(length, length);
        }
      }, 0);
    } else {
      setShowReplyInput(false);
    }
  };

  // Fetch user's reaction
  useEffect(() => {
    const fetchUserReaction = async () => {
      if (!activeUserId) return;

      try {
        const reaction = await commentService.fetchUserCommentReaction(
          activeUserId,
          comment.id
        );
        if (reaction) {
          setCurrentReaction(reaction.type);
        }
      } catch (error) {
        console.debug("No reaction found for comment:", comment.id);
      }
    };

    fetchUserReaction();
  }, [activeUserId, comment.id]);

  useEffect(() => {
    if (!showReplyEmojiPicker) return;

    const updatePickerPosition = () => {
      const buttonRect = replyEmojiButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      setReplyEmojiPosition({
        top: buttonRect.top - 8,
        left: Math.max(8, Math.min(buttonRect.left, window.innerWidth - 320)),
      });
    };

    updatePickerPosition();
    window.addEventListener("resize", updatePickerPosition);
    window.addEventListener("scroll", updatePickerPosition, true);

    return () => {
      window.removeEventListener("resize", updatePickerPosition);
      window.removeEventListener("scroll", updatePickerPosition, true);
    };
  }, [showReplyEmojiPicker]);

  const renderCommentContent = (content: string, mentions: { userId: string; username: string }[] = []) => {
    if (!mentions || mentions.length === 0) {
        return [content];
    }

    // Production-ready rendering using mentions list
    // Sort mentions by username length descending to avoid partial matches
    const sortedMentions = [...mentions].sort((a, b) => b.username.length - a.username.length);
    
    let parts: (string | React.ReactNode)[] = [content];
    
    sortedMentions.forEach(mention => {
        const mentionText = `@${mention.username}`;
        const newParts: (string | React.ReactNode)[] = [];
        
        parts.forEach(part => {
            if (typeof part === 'string') {
                const subParts = part.split(mentionText);
                subParts.forEach((subPart, i) => {
                    newParts.push(subPart);
                    if (i < subParts.length - 1) {
                        newParts.push(
                            <Link 
                                key={`${mention.userId}-${i}`} 
                                to={`/profile/${mention.username}`} 
                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                            >
                                {mentionText}
                            </Link>
                        );
                    }
                });
            } else {
                newParts.push(part);
            }
        });
        parts = newParts;
    });
    
    return parts;
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !activeUserId) return;

    setSubmittingReply(true);
    try {
      const finalMentions = getFinalMentions(replyContent);
      const newComment = await commentService.createComment(
        "POST",
        postId,
        replyContent,
        Number(activeUserId),
        comment.id,
        finalMentions
      );

      setReplyContent("");
      setShowReplyInput(false);
      onCreateReply(comment.id, newComment);
    } catch (error: any) {
      console.error("Error submitting reply:", error);
      alert(error?.response?.data?.message || "Failed to submit reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleInsertReplyEmoji = (emoji: string) => {
    const selectionPos = replyInputRef.current?.selectionStart;
    const safeCursorPos = Math.min(
      Math.max(selectionPos ?? replyCursorPos, 0),
      replyContent.length
    );
    const newValue =
      replyContent.slice(0, safeCursorPos) +
      emoji +
      replyContent.slice(safeCursorPos);
    const nextCursorPos = safeCursorPos + emoji.length;

    setReplyContent(newValue);
    setReplyCursorPos(nextCursorPos);
    setShowReplyEmojiPicker(false);

    requestAnimationFrame(() => {
      if (replyInputRef.current) {
        replyInputRef.current.focus();
        replyInputRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    });
  };

  const handleDeleteComment = () => {
    if (!activeUserId) return;

    // Parent handler (PostModal) is the single source of truth for delete API + state update.
    onDelete(comment.id, comment.parentId ?? undefined);
  };

  const handleReaction = async (reactionType: string) => {
    if (!activeUserId) {
      alert("Please login to react");
      return;
    }

    try {
      const reaction = await commentService.toggleCommentReaction(
        activeUserId,
        comment.id,
        reactionType
      );

      if (!reaction) {
        setCurrentReaction(null);
      } else {
        setCurrentReaction(reaction.type);
      }
      await fetchReactionSummary();
      setShowReactionPicker(false);
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const handleLikeClick = () => {
    if (currentReaction) {
      handleReaction(currentReaction);
    } else {
      handleReaction("LIKE");
    }
  };

  const handleReactionMouseEnter = () => {
    if (reactionTimeout) {
      clearTimeout(reactionTimeout);
      setReactionTimeout(null);
    }
    setShowReactionPicker(true);
  };

  const handleReactionMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowReactionPicker(false);
    }, 300);
    setReactionTimeout(timeout);
  };

  const fetchReactionDetail = useCallback(async () => {
    try {
      const summary = await commentService.fetchCommentReactionSummary(
        comment.id,
        6
      );
      setReactionDetail(summary);
    } catch (error) {
      console.error("Error fetching reaction detail:", error);
    }
  }, [comment.id]);

  const getReactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      LIKE: "Like",
      LOVE: "Love",
      HAHA: "Haha",
      WOW: "Wow",
      SAD: "Sad",
      ANGRY: "Angry",
    };
    return labels[type] || type;
  };

  const getReactionEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      LIKE: "👍",
      LOVE: "❤️",
      HAHA: "😂",
      WOW: "😮",
      SAD: "😢",
      ANGRY: "😡",
    };
    return emojis[type] || "👍";
  };

  if (userLoading || !commentUser) {
    return (
      <div className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
    );
  }

  // Get direct children for preview/expanded
  const directChildren = getDirectChildren(commentId);
  // FIX: When collapsed, show NO children (not preview). When expanded, show all.
  const visibleChildren = expanded ? directChildren : [];

  // FIX: Hidden count should be all children minus visible ones
  const hiddenChildrenCount = Math.max(
    0,
    comment.replyCount - (expanded ? directChildren.length : 0)
  );
  const showToggleButton = comment.replyCount > 0;

  const timeAgo = new Date(comment.createdAt).toLocaleDateString("vi-VN");
  const totalReactionCount = Number(reactionSummary.totalCount || 0);
  const topReactionIcons = (reactionSummary.topReactions || []).slice(0, 3);

  return (
    <div id={`comment-${commentId}`} className={level > 0 ? "ml-10" : ""}>
      <div className="flex gap-3 px-4">
        <Link to={`/profile/${commentUser.username}`}>
          <img
            src={commentUser.avatarUrl || "https://i.pravatar.cc/150?img=5"}
            alt={commentUser.username}
            className="w-8 h-8 rounded-full shrink-0 object-cover"
          />
        </Link>
        <div className="flex-1">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-2">
            <Link to={`/profile/${commentUser.username}`}>
              <p className="font-semibold text-sm dark:text-white hover:underline">
                {commentUser.username}
              </p>
            </Link>
            <p className="text-sm dark:text-white">
              {renderCommentContent(comment.content, comment.mentions)}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1 px-3 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {timeAgo}
            </span>

            {/* Reaction Button */}
            <div className="relative">
              <button
                onClick={handleLikeClick}
                onMouseEnter={handleReactionMouseEnter}
                onMouseLeave={handleReactionMouseLeave}
                className={`text-xs font-semibold hover:underline ${
                  currentReaction
                    ? "text-blue-500 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {currentReaction ? getReactionEmoji(currentReaction) : "Like"}
              </button>

              {showReactionPicker && (
                <div
                  onMouseEnter={handleReactionMouseEnter}
                  onMouseLeave={handleReactionMouseLeave}
                  className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-2 py-1 flex gap-1 z-10"
                >
                  {["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"].map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() => handleReaction(type)}
                        className="text-xl hover:scale-125 transition-transform"
                        title={type}
                      >
                        {getReactionEmoji(type)}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {allowComments !== false && (
              <button
                onClick={handleReplyClick}
                className="text-xs text-gray-500 dark:text-gray-400 font-semibold hover:underline"
              >
                Reply
              </button>
            )}

            {/* Delete Button */}
            {activeUserId && comment.userId === activeUserId && (
              <button
                onClick={handleDeleteComment}
                className="text-xs text-red-500 dark:text-red-400 font-semibold hover:underline"
              >
                Delete
              </button>
            )}

            {/* Reaction Count with Hover Dropdown */}
            {totalReactionCount > 0 && (
              <div className="relative ml-auto group">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex -space-x-1">
                    {(topReactionIcons.length > 0
                      ? topReactionIcons
                      : [{ type: "LIKE", count: totalReactionCount }]
                    ).map((reaction, index) => (
                      <span
                        key={`${reaction.type}-${index}`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
                        title={`${reaction.type}: ${reaction.count}`}
                      >
                        {getReactionEmoji(reaction.type)}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {totalReactionCount}
                  </span>
                </button>

                {/* Hover Dropdown */}
                <div
                  className="pointer-events-none absolute top-full right-0 z-50 mt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
                  onMouseEnter={fetchReactionDetail}
                >
                  <div className="w-44 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                      Chi tiết lượt react
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      {reactionDetail.topReactions.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-2">
                          No reactions yet
                        </div>
                      )}
                      {reactionDetail.topReactions.map((reaction, index) => (
                        <div
                          key={`${reaction.type}-${index}`}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm leading-none">
                              {getReactionEmoji(reaction.type)}
                            </span>
                            <span className="text-xs text-gray-700 dark:text-gray-300">
                              {getReactionLabel(reaction.type)}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {reaction.count}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-1.5 text-right text-xs text-gray-400 dark:text-gray-500">
                      Tổng: {reactionDetail.totalCount}
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute right-3 -top-1.5 flex justify-center">
                    <div className="h-3 w-3 rotate-45 border-t border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-2 flex gap-2 items-center">
              <div className="relative">
                <button
                  ref={replyEmojiButtonRef}
                  type="button"
                  onClick={() => setShowReplyEmojiPicker((prev) => !prev)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#363636] rounded-full"
                  aria-label="Insert emoji"
                  title="Insert emoji"
                >
                  <Smile
                    size={20}
                    className="text-gray-500 dark:text-gray-400"
                  />
                </button>

                <IconModal
                  open={showReplyEmojiPicker}
                  onClose={() => setShowReplyEmojiPicker(false)}
                  onEmojiClick={(emojiData) =>
                    handleInsertReplyEmoji(emojiData.emoji)
                  }
                  theme={
                    document.documentElement.classList.contains("dark")
                      ? Theme.DARK
                      : Theme.LIGHT
                  }
                  anchorRef={replyEmojiButtonRef}
                  containerClassName="fixed z-120"
                  containerStyle={
                    replyEmojiPosition
                      ? {
                          top: replyEmojiPosition.top,
                          left: replyEmojiPosition.left,
                          transform: "translateY(-100%)",
                        }
                      : undefined
                  }
                  pickerProps={{
                    height: 350,
                    width: 300,
                  }}
                />
              </div>

              <input
                ref={replyInputRef}
                type="text"
                value={replyContent}
                onChange={(e) => {
                  const value = e.target.value;
                  const cursorPos = e.target.selectionStart || 0;
                  setReplyContent(value);
                  setReplyCursorPos(cursorPos);
                  handleMentionChange(value, cursorPos);
                }}
                onClick={(e) => {
                  const pos = e.currentTarget.selectionStart || 0;
                  setReplyCursorPos(pos);
                  handleMentionChange(replyContent, pos);
                }}
                onKeyUp={(e) => {
                  const pos = e.currentTarget.selectionStart || 0;
                  setReplyCursorPos(pos);
                  handleMentionChange(replyContent, pos);
                }}
                onSelect={(e) => {
                  const pos = e.currentTarget.selectionStart || replyContent.length;
                  setReplyCursorPos(pos);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                placeholder={`Reply to ${commentUser.username}...`}
                className="flex-1 px-4 py-2 text-sm border-none dark:border-gray-600 rounded-2xl bg-gray-100 dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                disabled={submittingReply}
              />

              {/* Mention Dropdown for Reply */}
              {showMentionDropdown && (
                <div 
                  className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 max-h-60 overflow-y-auto z-[100] w-72 overflow-x-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 20) {
                      loadMoreMentions?.();
                    }
                  }}
                >
                  <div className="p-2 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Gợi ý bạn bè</p>
                  </div>
                  
                  <div className="py-1">
                    {mentionUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          const { newValue, newCursorPos } = selectUser(replyContent, user);
                          setReplyContent(newValue);
                          setReplyCursorPos(newCursorPos);
                          setTimeout(() => {
                            if (replyInputRef.current) {
                              replyInputRef.current.focus();
                              replyInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                            }
                          }, 0);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors border-b last:border-none dark:border-gray-700 group"
                      >
                        <div className="relative">
                          <img
                            src={getAvatarUrl(user.avatarUrl) || "https://i.pravatar.cc/150?img=5"}
                            alt={user.username}
                            className="w-9 h-9 rounded-full object-cover border dark:border-gray-700 group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold dark:text-white truncate group-hover:text-blue-500">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            @{user.username}
                          </p>
                        </div>
                      </button>
                    ))}

                    {mentionLoading && (
                      <div className="p-4 flex justify-center items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-gray-500">Đang tải...</span>
                      </div>
                    )}

                    {!mentionLoading && mentionUsers.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Không tìm thấy bạn bè nào</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || submittingReply}
                className="px-3 py-1.5 text-sm text-blue-500 font-semibold hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingReply ? "..." : "Post"}
              </button>
            </div>
          )}

          {/* Toggle Replies Button */}
          {showToggleButton && (
            <button
              onClick={() => {
                const nextExpanded = !expanded;
                onToggleExpanded(commentId);

                // Auto-load on first expand so level 2+ replies appear immediately.
                if (
                  nextExpanded &&
                  !loading &&
                  directChildren.length === 0 &&
                  comment.replyCount > 0
                ) {
                  onLoadMore(commentId);
                }
              }}
              className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-semibold hover:underline"
            >
              {expanded
                ? "Hide replies"
                : `View more replies${
                    hiddenChildrenCount > 0 ? ` (${hiddenChildrenCount})` : ""
                  }`}
            </button>
          )}
        </div>
      </div>

      {/* Render Direct Children (NO RECURSION) */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {visibleChildren.map((child) => (
            <CommentItemNormalized
              key={child.id}
              commentId={child.id}
              commentsById={commentsById}
              expandedMap={expandedMap}
              onToggleExpanded={onToggleExpanded}
              onLoadMore={onLoadMore}
              onDelete={onDelete}
              onCreateReply={onCreateReply}
              getDirectChildren={getDirectChildren}
              hasMoreReplies={hasMoreReplies}
              loadingMap={loadingMap}
              postId={postId}
              level={level + 1}
              currentUserId={activeUserId}
              allowComments={allowComments}
            />
          ))}

          {/* Show load-more even when current children is empty but replyCount > 0 */}
          {comment.replyCount > directChildren.length && (
            <button
              onClick={() => onLoadMore(commentId)}
              disabled={loading}
              className="ml-10 text-xs text-blue-500 hover:text-blue-600 font-semibold disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load more replies"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
