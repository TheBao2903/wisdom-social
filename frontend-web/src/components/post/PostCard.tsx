import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  Edit2,
  Trash2,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Post, PrivacyType } from "../../types";
import { buildS3Url } from "../../utils/s3";
import * as postApi from "../../services/postService";
import { useCurrentUser } from './../../hooks/useCurrentUser';

interface PostCardProps {
  post: Post;
}

const getPrivacyDisplay = (
  privacy?: PrivacyType,
  isOwnPost: boolean = false
) => {
  // Chủ post thấy đầy đủ thông tin
  if (isOwnPost) {
    switch (privacy) {
      case "PUBLIC":
        return { icon: Globe, text: "Public", color: "text-blue-500" };
      case "FRIENDS":
        return { icon: Users, text: "Friends", color: "text-green-500" };
      case "SPECIFIC":
        return {
          icon: Users,
          text: "Specific friends",
          color: "text-purple-500",
        };
      case "EXCEPT":
        return {
          icon: Users,
          text: "Friends except",
          color: "text-orange-500",
        };
      case "ONLY_ME":
        return { icon: Lock, text: "Only me", color: "text-gray-500" };
      default:
        return { icon: Globe, text: "Public", color: "text-blue-500" };
    }
  }

  // Người khác chỉ thấy Public hoặc Friends
  switch (privacy) {
    case "PUBLIC":
      return { icon: Globe, text: "Public", color: "text-blue-500" };
    case "FRIENDS":
    case "SPECIFIC":
    case "EXCEPT":
      return { icon: Users, text: "Friends", color: "text-green-500" };
    default:
      return { icon: Globe, text: "Public", color: "text-blue-500" };
  }
};

export default function PostCard({ post }: PostCardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser  = useCurrentUser();
  const isOwnPost = currentUser?.id === post.user.id;
  const privacyDisplay = getPrivacyDisplay(post.privacy, isOwnPost);

  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [showReactions, setShowReactions] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [hideTimeout, setHideTimeout] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const totalImages = post.images?.length || 0;

  // Fetch user's current reaction, total reaction count, and saved status
  useEffect(() => {
    const fetchReactionData = async () => {
      if (!currentUser?.id) return;

      try {
        // Fetch user's reaction
        const userReaction = await postApi.fetchUserReaction(
          currentUser.id,
          post.id
        );
        if (userReaction) {
          setCurrentReaction(userReaction.type);
          setIsLiked(true);
        } else {
          setCurrentReaction(null);
          setIsLiked(false);
        }

        // Fetch total reaction count
        const reactionsCount = await postApi.fetchPostReactionsCount(post.id);
        setLikesCount(reactionsCount);

        // Fetch saved status
        const isSaved = await postApi.checkPostSaved(currentUser.id, post.id);
        setIsSaved(isSaved);
      } catch (error) {
        console.debug("Error fetching reaction data for post:", post.id);
      }
    };

    fetchReactionData();
  }, [currentUser, post.id]);

  // Refetch when window gains focus (user returns from detail page)
  useEffect(() => {
    const handleFocus = () => {
      if (!currentUser?.id) return;

      // Refetch reaction data when returning to this page
      const fetchReactionData = async () => {
        try {
          const userReaction = await postApi.fetchUserReaction(
            currentUser.id,
            post.id
          );
          if (userReaction) {
            setCurrentReaction(userReaction.type);
            setIsLiked(true);
          } else {
            setCurrentReaction(null);
            setIsLiked(false);
          }

          const reactionsCount = await postApi.fetchPostReactionsCount(post.id);
          setLikesCount(reactionsCount);

          // Refetch saved status
          const isSaved = await postApi.checkPostSaved(currentUser.id, post.id);
          setIsSaved(isSaved);
        } catch (error) {
          console.debug("Error refetching reaction data");
        }
      };

      fetchReactionData();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentUser, post.id]);

  const handleMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    setShowReactions(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowReactions(false);
    }, 300); // Delay 300ms trước khi ẩn
    setHideTimeout(timeout);
  };

  const handleReaction = async (reactionType: string) => {
    try {
      if (!currentUser?.id) {
        alert("Please login to react");
        return;
      }

      const reaction = await postApi.togglePostReaction(
        currentUser.id,
        post.id,
        reactionType
      );

      // If clicking the same reaction, remove it
      if (!reaction) {
        setCurrentReaction(null);
        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        // If had no reaction before, increment count
        if (!currentReaction) {
          setLikesCount((prev) => prev + 1);
        }
        setCurrentReaction(reaction.type);
        setIsLiked(true);
      }
      setShowReactions(false);
    } catch (error) {
      console.error("Error reacting to post:", error);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentReaction) {
      // Remove reaction
      handleReaction(currentReaction);
    } else {
      // Add like
      handleReaction("LIKE");
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser?.id) {
      alert("Please login to save posts");
      return;
    }

    try {
      await postApi.togglePostSaved(currentUser.id, post.id);

      // Toggle saved state
      setIsSaved(!isSaved);
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/post/${post.id}`, { state: { from: location.pathname } });
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    setShowMenu(false);
    alert("Link copied to clipboard!");
  };

  const handleEdit = () => {
    setShowMenu(false);
    navigate(`/edit-post/${post.id}`);
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc muốn xóa bài viết này?")) {
      setShowMenu(false);
      return;
    }

    try {
      if (!currentUser?.id) {
        alert("Please login to delete posts");
        return;
      }

      await postApi.deletePost(currentUser.id, post.id);
      alert("Xóa bài viết thành công!");
      setShowMenu(false);
      // Refresh page to update post list
      window.location.reload();
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Không thể xóa bài viết. Bạn chỉ có thể xóa bài viết của mình.");
      setShowMenu(false);
    }
  };

  const handleChangePrivacy = async (newPrivacy: string) => {
    try {
      if (!currentUser?.id) {
        alert("Please login to update privacy");
        return;
      }

      await postApi.updatePostPrivacy(currentUser.id, post.id, newPrivacy);

      setShowPrivacyMenu(false);
      setShowMenu(false);
      alert("Privacy updated successfully!");
    } catch (error) {
      console.error("Error updating privacy:", error);
      alert("Failed to update privacy.");
    }
  };

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
    <article className="bg-white dark:bg-[#000] border-b border-gray-200 dark:border-[#262626] mb-5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-[14px]">
        <Link
          to={`/profile/${post.user.username}`}
          className="flex items-center gap-3"
        >
          <img
            src={post.user.avatar}
            alt={post.user.username}
            className="w-[32px] h-[32px] rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold dark:text-white">
              {post.user.username}
            </p>
            <div className="flex items-center gap-1">
              <privacyDisplay.icon
                size={12}
                className={`${privacyDisplay.color}`}
              />
              <span
                className={`text-[10px] ${privacyDisplay.color} font-medium`}
              >
                {privacyDisplay.text}
              </span>
            </div>
          </div>
        </Link>
        {/* More options button - Only show for post owner */}
        {isOwnPost && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-900 dark:text-white hover:text-gray-500 dark:hover:text-gray-400"
            >
              <MoreHorizontal size={24} />
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
                        <Lock className="w-3 h-3" />
                        Only me
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
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image Carousel */}
      {totalImages > 0 && (
        <div className="relative w-full group">
          <Link
            to={`/post/${post.id}`}
            state={{ from: location.pathname }}
            className="block w-full h-[500px] bg-black"
          >
            <img
              src={
                buildS3Url(post.images[currentImageIndex]) ||
                post.images[currentImageIndex]
              }
              alt={post.caption}
              className="w-full h-full object-contain cursor-pointer"
            />
          </Link>

          {/* Navigation arrows - Only show if multiple images */}
          {totalImages > 1 && (
            <>
              {/* Previous button */}
              <button
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>

              {/* Next button */}
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>

              {/* Dots indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {post.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      index === currentImageIndex
                        ? "bg-blue-500 w-2 h-2"
                        : "bg-gray-300/70 hover:bg-gray-300"
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>

              {/* Image counter */}
              <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                {currentImageIndex + 1} / {totalImages}
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4">
        <div className="flex items-center justify-between pt-1 pb-2">
          <div className="flex items-center gap-4">
            {/* Reaction button with picker */}
            <div
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={handleLike}
                className="hover:opacity-50 transition-opacity"
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
                  <Heart
                    size={27}
                    fill={isLiked ? "currentColor" : "none"}
                    strokeWidth={1.8}
                    className={isLiked ? "text-red-500" : ""}
                  />
                )}
              </button>

              {/* Reaction picker */}
              {showReactions && (
                <div
                  className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 rounded-full shadow-2xl border dark:border-gray-700 px-4 py-3 flex gap-2 z-50"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReaction("LIKE");
                    }}
                    className="hover:scale-125 transition-transform text-3xl"
                    title="Like"
                  >
                    👍
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReaction("LOVE");
                    }}
                    className="hover:scale-125 transition-transform text-3xl"
                    title="Love"
                  >
                    ❤️
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
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
                      e.preventDefault();
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
                      e.preventDefault();
                      e.stopPropagation();
                      handleReaction("SAD");
                    }}
                    className="hover:scale-125 transition-transform text-3xl"
                    title="Sad"
                  >
                    😢
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReaction("ANGRY");
                    }}
                    className="hover:scale-125 transition-transform text-3xl"
                    title="Angry"
                  >
                    😡
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleComment}
              className="hover:opacity-50 transition-opacity"
            >
              <MessageCircle size={27} strokeWidth={1.8} />
            </button>
            <button className="hover:opacity-50 transition-opacity">
              <svg
                width="27"
                height="27"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <button
            onClick={handleSave}
            className={`hover:opacity-50 transition-opacity ${
              isSaved ? "" : ""
            }`}
          >
            <Bookmark
              size={26}
              fill={isSaved ? "currentColor" : "none"}
              strokeWidth={1.8}
            />
          </button>
        </div>

        {/* Likes */}
        <button className="text-sm font-semibold mb-2 hover:opacity-50 block dark:text-white">
          {likesCount.toLocaleString()} likes
        </button>

        {/* Caption */}
        <div className="text-sm mb-1 leading-[18px]">
          <Link
            to={`/profile/${post.user.username}`}
            className="font-semibold hover:opacity-50 mr-1 dark:text-white"
          >
            {post.user.username}
          </Link>
          <span className="text-gray-900 dark:text-white">{post.caption}</span>
        </div>

        {/* Comments */}
        {post.comments.length > 0 && (
          <Link
            to={`/post/${post.id}`}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-400 dark:hover:text-gray-300 block mb-1"
          >
            View all {post.comments.length} comments
          </Link>
        )}

        {/* Time */}
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-3">
          {post.createdAt}
        </p>
      </div>
    </article>
  );
}
