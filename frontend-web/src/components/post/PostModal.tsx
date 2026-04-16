import { useEffect, useRef, useState } from "react";
import { useNavigate as _useNavigate } from "react-router-dom";
import {
  X,
  Heart,
  Send,
  Bookmark,
  MoreHorizontal,
  Edit2,
  Trash2,
  Link as LinkIcon,
  MapPin,
  Users,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { buildS3Url } from "../../utils/s3";
import FriendSelectorModal from "./FriendSelectorModal";
import EditPostModal from "./EditPostModal";
import { useAuth } from "../../contexts/AuthContext";
import type {
  PostData,
  UserData,
  CommentData,
  PostModalProps,
} from "../../types/postType";
import * as postApi from "../../services/postService";

export default function PostModal({ postId, onClose }: PostModalProps) {
  const { currentUser } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [author, setAuthor] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<UserData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const reactionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [reactCount, setReactCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<UserData[]>([]);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [showSpecificModal, setShowSpecificModal] = useState(false);
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [specificViewers, setSpecificViewers] = useState<string[]>([]);
  const [excludedUsers, setExcludedUsers] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch post
        const postData = await postApi.fetchPostById(postId);
        setPost(postData);

        // Fetch author
        const author = await postApi.fetchUserById(postData.authorId);
        setAuthor(author);

        // Fetch tagged users
        if (postData.taggedUserIds && postData.taggedUserIds.length > 0) {
          const fetchedTaggedUsers = await postApi.fetchUsersByIds(
            postData.taggedUserIds
          );
          setTaggedUsers(fetchedTaggedUsers);
        }

        // Fetch comments
        const comments = await postApi.fetchPostComments(postId);
        setComments(comments);

        // Fetch reactions count
        const reactCount = await postApi.fetchPostReactionsCount(postId);
        setReactCount(reactCount);

        // Fetch saved status
        if (currentUser?.id) {
          const isSaved = await postApi.checkPostSaved(currentUser.id, postId);
          setIsSaved(isSaved);
        }

        console.log("✅ Post detail loaded successfully");
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.message || err.message || "Failed to load post";
        console.error("❌ Error fetching post:", errorMsg, err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, currentUser?.id]);

  // Fetch user's current reaction
  useEffect(() => {
    const fetchUserReaction = async () => {
      if (!currentUser?.id) return;

      try {
        const reaction = await postApi.fetchUserReaction(
          currentUser.id,
          postId
        );
        if (reaction) {
          setCurrentReaction(reaction.type);
        } else {
          setCurrentReaction(null);
        }
      } catch (error) {
        console.log("PostModal: Error fetching reaction:", error);
        setCurrentReaction(null);
      }
    };
    fetchUserReaction();
  }, [postId, currentUser]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowMenu(false);
    // Optional: Show toast notification
  };

  const handleEdit = () => {
    if (!post) return;
    setShowMenu(false);
    setIsEditing(true);
  };

  const handleChangePrivacy = async (newPrivacy: string) => {
    if (!post) return;

    try {
      if (!currentUser?.id) {
        alert("Please login to update privacy");
        return;
      }

      const updatedPost = await postApi.updatePostPrivacy(
        currentUser.id.toString(),
        postId,
        newPrivacy
      );

      setPost(updatedPost);
      setShowPrivacyMenu(false);
      setShowMenu(false);
      alert("Privacy updated successfully!");
    } catch (error) {
      console.error("Error updating privacy:", error);
      alert("Failed to update privacy.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc muốn xóa bài viết này?")) {
      setShowMenu(false);
      return;
    }

    try {
      await postApi.deletePost(postId, currentUser?.id || "");

      alert("Xóa bài viết thành công!");
      onClose(); // Close modal after successful deletion
      // TODO: Refresh post list in parent component
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Không thể xóa bài viết. Bạn chỉ có thể xóa bài viết của mình.");
      setShowMenu(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentInput.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      if (!currentUser?.id) {
        alert("Please login to comment");
        return;
      }

      const newComment = await postApi.submitComment(
        currentUser.id,
        postId,
        commentInput
      );

      // Add new comment to list
      setComments([newComment, ...comments]);
      setCommentInput("");
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (
      !confirm("Bạn có chắc muốn xóa bình luận này? (Tất cả replies sẽ bị xóa)")
    )
      return;

    try {
      if (!currentUser?.id) {
        alert("Please login to delete comment");
        return;
      }
      await postApi.deleteComment(commentId, currentUser.id);

      // Recursive function to remove comment and its replies from nested structure
      const removeCommentRecursive = (
        commentsList: CommentData[]
      ): CommentData[] => {
        return commentsList.filter((c) => {
          if (c.id === commentId) {
            return false; // Remove this comment
          }
          // Check replies if exists
          if (c.replies && c.replies.length > 0) {
            c.replies = removeCommentRecursive(c.replies);
          }
          return true;
        });
      };

      // Remove comment from main list (handles both top-level and nested)
      setComments(removeCommentRecursive(comments));
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Không thể xóa bình luận");
    }
  };

  const handleCommentInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCommentInput(value);
    setMentionCursorPos(cursorPos);

    // Check if user is typing a mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const afterAt = textBeforeCursor.substring(atIndex + 1);
      // Check if there's no space after @
      if (!afterAt.includes(" ")) {
        setShowMentionDropdown(true);

        // Search users if query is not empty
        if (afterAt.length > 0) {
          try {
            const mentionUsers = await postApi.searchUsers(
              currentUser?.id || "",
              afterAt
            );
            setMentionUsers(mentionUsers);
          } catch (error) {
            console.error("Error searching users:", error);
          }
        } else {
          setMentionUsers([]);
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleSelectMention = (user: UserData) => {
    const textBeforeCursor = commentInput.substring(0, mentionCursorPos);
    const textAfterCursor = commentInput.substring(mentionCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    const newValue =
      commentInput.substring(0, atIndex) +
      `@${user.username} ` +
      textAfterCursor;

    setCommentInput(newValue);
    setShowMentionDropdown(false);
    setMentionUsers([]);
  };

  const handleReaction = async (reactionType: string) => {
    if (!currentUser?.id) {
      alert("Please login to react");
      return;
    }

    try {
      const reaction = await postApi.togglePostReaction(
        currentUser.id,
        postId,
        reactionType
      );

      // If reaction was removed
      if (!reaction) {
        setCurrentReaction(null);
        setReactCount((prev) => Math.max(0, prev - 1));
      } else {
        const wasNewReaction = currentReaction === null;
        setCurrentReaction(reaction.type);
        if (wasNewReaction) {
          setReactCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const handleSave = async () => {
    if (!currentUser?.id) {
      alert("Please login to save posts");
      return;
    }

    try {
      await postApi.togglePostSaved(currentUser.id, postId);

      // Toggle saved state
      setIsSaved(!isSaved);
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
          <h2 className="text-xl font-bold text-red-600 mb-4">
            Error Loading Post
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!post || !author) {
    return null;
  }

  // Check if current user is the post owner
  const isOwnPost = currentUser?.id.toString() === post.authorId;

  const hasMedia = post.media && post.media.length > 0;
  const totalImages = post?.media?.length || 0;
  const timeAgo = new Date(post.createdAt).toLocaleDateString("vi-VN");

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Close button - outside the modal */}
      <button
        onClick={onClose}
        className="absolute right-8 top-8 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div className="relative bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] flex overflow-hidden shadow-2xl">
        {/* Left side - Media */}
        <div className="flex-1 bg-black flex items-center justify-center relative group">
          {hasMedia ? (
            <>
              <img
                src={
                  buildS3Url(post.media![currentImageIndex].url) ||
                  post.media![currentImageIndex].url
                }
                alt="Post content"
                className="max-h-[90vh] max-w-full object-contain"
              />
              {/* Navigation arrows - Only show if multiple images */}
              {totalImages > 1 && (
                <>
                  {/* Previous button */}
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>

                  {/* Next button */}
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight size={24} />
                  </button>

                  {/* Dots indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {post.media!.map((_, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCurrentImageIndex(index);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentImageIndex
                            ? "bg-blue-500 w-2.5 h-2.5"
                            : "bg-gray-300/70 hover:bg-gray-300"
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>

                  {/* Image counter */}
                  <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1.5 rounded-full z-10">
                    {currentImageIndex + 1} / {totalImages}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
              <p className="text-4xl font-bold text-gray-400 dark:text-gray-600 px-8 text-center">
                {post.content}
              </p>
            </div>
          )}
        </div>

        {/* Right side - Details */}
        <div className="w-[400px] flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={author.avatarUrl || "https://i.pravatar.cc/150?img=5"}
                alt={author.username}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold text-sm dark:text-white">
                  {author.username}
                </p>
                {post.privacy &&
                  (() => {
                    const isOwnPost = currentUser?.id === author.id.toString();

                    // Hiển thị cho chủ post
                    if (isOwnPost) {
                      return (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          {post.privacy === "PUBLIC" && (
                            <>
                              <Globe className="w-3 h-3 text-blue-500" />
                              <span className="font-medium">Public</span>
                            </>
                          )}
                          {post.privacy === "FRIENDS" && (
                            <>
                              <Users className="w-3 h-3 text-green-500" />
                              <span className="font-medium">Friends</span>
                            </>
                          )}
                          {post.privacy === "SPECIFIC" && (
                            <>
                              <Users className="w-3 h-3 text-purple-500" />
                              <span className="font-medium">
                                Specific friends
                              </span>
                            </>
                          )}
                          {post.privacy === "EXCEPT" && (
                            <>
                              <Users className="w-3 h-3 text-orange-500" />
                              <span className="font-medium">
                                Friends except
                              </span>
                            </>
                          )}
                          {post.privacy === "ONLY_ME" && (
                            <>
                              <Globe className="w-3 h-3 text-gray-500" />
                              <span className="font-medium">Only me</span>
                            </>
                          )}
                        </p>
                      );
                    }

                    // Hiển thị cho người khác - chỉ Public hoặc Friends
                    return (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        {post.privacy === "PUBLIC" && (
                          <>
                            <Globe className="w-3 h-3 text-blue-500" />
                            <span className="font-medium">Public</span>
                          </>
                        )}
                        {(post.privacy === "FRIENDS" ||
                          post.privacy === "SPECIFIC" ||
                          post.privacy === "EXCEPT") && (
                          <>
                            <Users className="w-3 h-3 text-green-500" />
                            <span className="font-medium">Friends</span>
                          </>
                        )}
                      </p>
                    );
                  })()}
                {post.location && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {typeof post.location === "string"
                      ? post.location
                      : post.location.name || post.location.address}
                  </p>
                )}
              </div>
            </div>
            {/* More options button with dropdown menu - Only show for post owner */}
            {isOwnPost && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-20 py-2 border dark:border-gray-700">
                      <button
                        onClick={handleEdit}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-white"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setShowPrivacyMenu(!showPrivacyMenu);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-white"
                      >
                        <Globe className="w-4 h-4" />
                        Change privacy
                      </button>
                      {showPrivacyMenu && (
                        <div className="px-2 py-1 space-y-1">
                          <button
                            onClick={() => handleChangePrivacy("PUBLIC")}
                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                          >
                            <Globe className="w-3 h-3" />
                            Public
                          </button>
                          <button
                            onClick={() => handleChangePrivacy("FRIENDS")}
                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                          >
                            <Users className="w-3 h-3" />
                            Friends
                          </button>
                          <button
                            onClick={() => handleChangePrivacy("ONLY_ME")}
                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                          >
                            <Globe className="w-3 h-3" />
                            Only me
                          </button>
                          <button
                            onClick={() => {
                              setShowPrivacyMenu(false);
                              setShowSpecificModal(true);
                            }}
                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                          >
                            <Users className="w-3 h-3" />
                            Specific friends
                          </button>
                          <button
                            onClick={() => {
                              setShowPrivacyMenu(false);
                              setShowExcludedModal(true);
                            }}
                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                          >
                            <Users className="w-3 h-3" />
                            Friends except
                          </button>
                        </div>
                      )}
                      <button
                        onClick={handleDelete}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-white"
                      >
                        <LinkIcon className="w-4 h-4" />
                        Copy link
                      </button>
                      <div className="border-t dark:border-gray-700 my-1" />
                      <button
                        onClick={() => setShowMenu(false)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Caption/Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex gap-3 mb-4">
              <img
                src={author.avatarUrl || "https://i.pravatar.cc/150?img=5"}
                alt={author.username}
                className="w-8 h-8 rounded-full shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm dark:text-white">
                  <span className="font-semibold mr-2">{author.username}</span>
                  {post.content.split(/(#\w+)/).map((part, index) => {
                    if (part.startsWith("#")) {
                      return (
                        <span key={index} className="text-blue-500">
                          {part}
                        </span>
                      );
                    }
                    return part;
                  })}
                </p>
                {/* Tagged users */}
                {taggedUsers.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>with </span>
                    {taggedUsers.map((user, index) => (
                      <span key={user.id}>
                        <span className="font-semibold hover:underline cursor-pointer">
                          {user.username}
                        </span>
                        {index < taggedUsers.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Time info */}
            <p className="text-xs text-gray-400 dark:text-gray-500 ml-11 mb-4">
              {timeAgo}
            </p>

            {/* Comments section */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No comments yet
                </p>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onDelete={handleDeleteComment}
                    postId={postId}
                  />
                ))
              )}
            </div>
          </div>

          {/* Actions bar */}
          <div className="border-t dark:border-gray-800">
            <div className="p-4 flex items-center justify-between">
              <div className="flex gap-4">
                {/* Reaction button with picker */}
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (reactionsTimeoutRef.current)
                      clearTimeout(reactionsTimeoutRef.current);
                    setShowReactions(true);
                  }}
                  onMouseLeave={() => {
                    reactionsTimeoutRef.current = setTimeout(
                      () => setShowReactions(false),
                      300
                    );
                  }}
                >
                  <button
                    onClick={() => {
                      if (!currentReaction) {
                        handleReaction("LIKE");
                      } else {
                        handleReaction(currentReaction);
                      }
                    }}
                    className="hover:scale-110 transition-transform"
                  >
                    {currentReaction === "LIKE" && (
                      <span className="text-2xl">👍</span>
                    )}
                    {currentReaction === "LOVE" && (
                      <span className="text-2xl">❤️</span>
                    )}
                    {currentReaction === "HAHA" && (
                      <span className="text-2xl">😂</span>
                    )}
                    {currentReaction === "WOW" && (
                      <span className="text-2xl">😮</span>
                    )}
                    {currentReaction === "SAD" && (
                      <span className="text-2xl">😢</span>
                    )}
                    {currentReaction === "ANGRY" && (
                      <span className="text-2xl">😡</span>
                    )}
                    {!currentReaction && (
                      <Heart className="w-6 h-6 dark:text-white" />
                    )}
                  </button>

                  {/* Reaction picker */}
                  {showReactions && (
                    <div className="absolute bottom-full left-0 mb-0 pb-2 bg-white dark:bg-gray-800 rounded-full shadow-2xl border dark:border-gray-700 px-4 py-3 flex gap-2 z-50 animate-in fade-in zoom-in duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction("LIKE");
                        }}
                        className="hover:scale-125 transition-transform text-3xl"
                        title="Thích"
                      >
                        👍
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction("LOVE");
                        }}
                        className="hover:scale-125 transition-transform text-3xl"
                        title="Yêu thích"
                      >
                        ❤️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction("HAHA");
                        }}
                        className="hover:scale-125 transition-transform text-3xl"
                        title="Haha"
                      >
                        😂
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction("WOW");
                        }}
                        className="hover:scale-125 transition-transform text-3xl"
                        title="Wow"
                      >
                        😮
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction("SAD");
                        }}
                        className="hover:scale-125 transition-transform text-3xl"
                        title="Buồn"
                      >
                        😢
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReaction("ANGRY");
                        }}
                        className="hover:scale-125 transition-transform text-3xl"
                        title="Phẫn nộ"
                      >
                        😡
                      </button>
                    </div>
                  )}
                </div>

                <button className="hover:opacity-70 transition-opacity">
                  <Send className="w-6 h-6 dark:text-white" />
                </button>
              </div>
              <button
                onClick={handleSave}
                className="hover:opacity-70 transition-opacity"
              >
                <Bookmark
                  className="w-6 h-6 dark:text-white"
                  fill={isSaved ? "currentColor" : "none"}
                />
              </button>
            </div>

            <div className="px-4 pb-2">
              <p className="font-semibold text-sm dark:text-white">
                {reactCount} lượt thích
              </p>
            </div>

            {/* Add comment input */}
            <div className="p-4 border-t dark:border-gray-800 relative">
              {/* Mention dropdown */}
              {showMentionDropdown && mentionUsers.length > 0 && (
                <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 max-h-60 overflow-y-auto z-50 w-64">
                  {mentionUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectMention(user)}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                    >
                      <img
                        src={
                          user.avatarUrl || "https://i.pravatar.cc/150?img=5"
                        }
                        alt={user.username}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <p className="text-sm font-semibold dark:text-white">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  {/* Highlighted text background layer */}
                  <div className="absolute inset-0 text-sm pointer-events-none whitespace-pre-wrap break-words dark:text-white opacity-0">
                    {commentInput
                      .split(/(@[a-zA-Z0-9_]+)/g)
                      .map((part, index) => {
                        if (part.match(/^@[a-zA-Z0-9_]+$/)) {
                          return (
                            <span
                              key={index}
                              className="text-blue-500 font-semibold opacity-100"
                            >
                              {part}
                            </span>
                          );
                        }
                        return (
                          <span key={index} className="opacity-100">
                            {part}
                          </span>
                        );
                      })}
                  </div>

                  {/* Transparent input layer */}
                  <input
                    type="text"
                    value={commentInput}
                    onChange={handleCommentInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                    }}
                    placeholder="Add a comment..."
                    className="relative w-full text-sm outline-none dark:bg-transparent bg-transparent caret-gray-900 dark:caret-white"
                    style={{
                      color: "transparent",
                      textShadow: "0 0 0 #000",
                      WebkitTextFillColor: "transparent",
                    }}
                    disabled={submittingComment}
                  />
                </div>
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentInput.trim() || submittingComment}
                  className="text-blue-500 font-semibold text-sm hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Friend Selector Modals */}
      <FriendSelectorModal
        isOpen={showSpecificModal}
        onClose={() => setShowSpecificModal(false)}
        onConfirm={(selected) => {
          setSpecificViewers(selected);
          handleChangePrivacy("SPECIFIC");
        }}
        title="Who can see this?"
        description="Only selected friends will be able to see this post"
        initialSelected={specificViewers}
      />

      <FriendSelectorModal
        isOpen={showExcludedModal}
        onClose={() => setShowExcludedModal(false)}
        onConfirm={(selected) => {
          setExcludedUsers(selected);
          handleChangePrivacy("EXCEPT");
        }}
        title="Hide from"
        description="Selected friends won't be able to see this post"
        initialSelected={excludedUsers}
      />

      {/* Edit Post Modal */}
      {isEditing && post && (
        <EditPostModal
          postId={postId}
          post={post}
          taggedUsers={taggedUsers}
          onClose={() => setIsEditing(false)}
          onSaved={(updatedPost) => {
            setPost(updatedPost as PostData);
            setIsEditing(false);
          }}
        />
      )}
    </div>
  );
}

// Comment Item Component
function CommentItem({
  comment,
  onDelete,
  postId,
  level = 0,
}: {
  comment: CommentData;
  onDelete: (commentId: string) => void;
  postId: string;
  level?: number;
}) {
  const [commentUser, setCommentUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Reply state
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replies, setReplies] = useState<CommentData[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyCount, setReplyCount] = useState(comment.replyCount || 0);

  // Reaction state
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [reactCount, setReactCount] = useState(comment.reactCount || 0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTimeout, setReactionTimeout] = useState<number | null>(null);

  const renderCommentContent = (content: string) => {
    // Split by mentions (@username) - match @ followed by word characters
    const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.match(/^@[a-zA-Z0-9_]+$/)) {
        return (
          <span key={index} className="text-blue-500 font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Fetch comment user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await postApi.fetchUserById(comment.userId);
        setCommentUser(user);
      } catch (error) {
        console.error("Error fetching comment user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [comment.userId]);

  // Fetch user's reaction on comment
  useEffect(() => {
    const fetchUserReaction = async () => {
      if (!currentUser?.id) return;

      try {
        const reaction = await postApi.fetchUserCommentReaction(
          currentUser.id,
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
  }, [currentUser, comment.id]);

  // Fetch replies
  const fetchReplies = async () => {
    if (replies.length > 0) {
      setShowReplies(!showReplies);
      return;
    }

    setLoadingReplies(true);
    try {
      const fetchedReplies = await postApi.fetchCommentReplies(comment.id);
      setReplies(fetchedReplies);
      setShowReplies(true);
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setLoadingReplies(false);
    }
  };

  // Handle reply submission
  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !currentUser?.id) return;

    setSubmittingReply(true);
    try {
      const newReply = await postApi.submitComment(
        currentUser.id,
        postId,
        replyContent
      );
      // Note: Backend needs to handle parentId param for reply structure

      setReplies([...replies, newReply]);
      setReplyContent("");
      setShowReplyInput(false);
      setShowReplies(true);

      // Update reply count
      setReplyCount((prev) => prev + 1);
    } catch (error) {
      console.error("Error submitting reply:", error);
      alert("Failed to submit reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Handle delete reply (also removes from local state)
  const handleDeleteReply = (commentId: string) => {
    // Call parent delete handler
    onDelete(commentId);

    // Also remove from local replies state
    const removeFromReplies = (repliesList: CommentData[]): CommentData[] => {
      return repliesList.filter((r) => {
        if (r.id === commentId) {
          // Decrease reply count when removing
          setReplyCount((prev) => Math.max(0, prev - 1));
          return false;
        }
        if (r.replies && r.replies.length > 0) {
          r.replies = removeFromReplies(r.replies);
        }
        return true;
      });
    };

    setReplies(removeFromReplies(replies));
  };

  // Handle reaction
  const handleReaction = async (reactionType: string) => {
    if (!currentUser?.id) {
      alert("Please login to react");
      return;
    }

    try {
      const reaction = await postApi.toggleCommentReaction(
        currentUser.id,
        comment.id,
        reactionType
      );

      if (!reaction) {
        // Reaction removed
        setCurrentReaction(null);
        setReactCount((prev) => Math.max(0, prev - 1));
      } else {
        // Reaction added or changed
        const wasNewReaction = currentReaction === null;
        setCurrentReaction(reaction.type);
        if (wasNewReaction) {
          setReactCount((prev) => prev + 1);
        }
        // If changing reaction type, count stays the same
      }
      setShowReactionPicker(false);
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const handleLikeClick = () => {
    if (currentReaction) {
      // If already has reaction, clicking again will remove it
      // Just call handleReaction with current reaction, backend will toggle it off
      handleReaction(currentReaction);
    } else {
      // Add like
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

  if (loading || !commentUser) {
    return (
      <div className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
    );
  }

  const timeAgo = new Date(comment.createdAt).toLocaleDateString("vi-VN");
  const maxLevel = 3; // Maximum nesting level for replies

  return (
    <div className={level > 0 ? "ml-10" : ""}>
      <div className="flex gap-3 px-4">
        <img
          src={commentUser.avatarUrl || "https://i.pravatar.cc/150?img=5"}
          alt={commentUser.username}
          className="w-8 h-8 rounded-full shrink-0"
        />
        <div className="flex-1">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-2">
            <p className="font-semibold text-sm dark:text-white">
              {commentUser.username}
            </p>
            <p className="text-sm dark:text-white">
              {renderCommentContent(comment.content)}
            </p>
          </div>

          <div className="flex items-center gap-4 mt-1 px-3">
            <button className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
              {timeAgo}
            </button>

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

              {/* Reaction Picker */}
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

            {/* Reply Button */}
            {level < maxLevel && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-xs text-gray-500 dark:text-gray-400 font-semibold hover:underline"
              >
                Reply
              </button>
            )}

            {/* Delete Button */}
            {currentUser && comment.userId === currentUser.id.toString() && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-red-500 dark:text-red-400 font-semibold hover:underline"
              >
                Delete
              </button>
            )}

            {/* Reaction Count */}
            {reactCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {reactCount} {reactCount === 1 ? "like" : "likes"}
              </span>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                placeholder={`Reply to ${commentUser.username}...`}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:border-blue-500"
                disabled={submittingReply}
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || submittingReply}
                className="px-3 py-1.5 text-sm text-blue-500 font-semibold hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingReply ? "..." : "Post"}
              </button>
            </div>
          )}

          {/* Show Replies Button */}
          {replyCount > 0 && (
            <button
              onClick={fetchReplies}
              className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-semibold hover:underline flex items-center gap-1"
              disabled={loadingReplies}
            >
              {loadingReplies ? (
                "Loading..."
              ) : showReplies ? (
                <>
                  Hide {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </>
              ) : (
                <>
                  View {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onDelete={handleDeleteReply}
              postId={postId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
