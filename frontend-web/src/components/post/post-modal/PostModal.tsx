/**
 * 📌 PostModal Container Component
 *
 * Responsibility:
 * - Fetch post data and author info
 * - Track global modal state (edit mode, menus, image index)
 * - Orchestrate child components
 * - Handle modal close
 *
 * Why:
 * - Container pattern: Keeps logic separate from view
 * - PostModal focuses on data fetching and composition
 * - Delegates UI rendering to specialized child components
 * - Easy to trace data flow top-down
 *
 * Props:
 * - postId: string
 * - onClose: () => void
 *
 * State:
 * - post: PostData (fetched)
 * - author: UserData (fetched)
 * - loading: boolean
 * - error: string | null
 * - isEditing: boolean
 * - currentImageIndex: number
 * - transformedMediaUrls: string[]
 * - Menu states (showMenu, showPrivacyMenu, etc.)
 * - Action states (currentReaction, reactCount, isSaved)
 *
 * Child Components:
 * - PostHeader: Avatar, username, privacy, menu
 * - PostMediaViewer: Images/videos/slider
 * - PostComments: All comment logic
 * - PostActions: Reactions, save
 *
 * Features:
 * - Close on backdrop click
 * - Edit mode with EditPostModal
 * - Privacy modals (specific friends, excluded)
 * - Fetch post on mount
 * - Refetch reactions/saved on focus
 *
 * Notes:
 * - Does NOT contain comment logic (delegated to PostComments)
 * - Does NOT render comment tree (delegated to PostComments)
 * - Simply composes and coordinates child components
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Music } from "lucide-react";
import FriendSelectorModal from "../FriendSelectorModal";
import EditPostModal from "../EditPostModal";
import PostHeader from "./PostHeader";
import PostMediaViewer from "./PostMediaViewer";
import PostActions from "./PostActions";
import PostComments from "./post-comment/PostComments";
import { useAuth } from "../../../contexts/AuthContext";
import * as postApi from "../../../services/postService";
import useMusicAutoplay from "../../../hooks/useMusicAutoplay";
import toast from "react-hot-toast";
import type {
  PostData,
  UserData,
  PostModalProps,
} from "../../../types/post";

export default function PostModal({ postId, onClose }: PostModalProps) {
  const location = useLocation();
  const { currentUser } = useAuth();

  const normalizeId = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  const isSameUserId = (
    first: string | number | null | undefined,
    second: string | number | null | undefined
  ): boolean => {
    const firstId = normalizeId(first);
    const secondId = normalizeId(second);
    return Boolean(firstId) && Boolean(secondId) && firstId === secondId;
  };

  const getPostOwnerId = (postData: PostData | null): string => {
    if (!postData) return "";
    return normalizeId(postData.authorId);
  };

  // ============ POST DATA STATES ============
  const [post, setPost] = useState<PostData | null>(null);
  const [author, setAuthor] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<UserData[]>([]);

  // ============ MEDIA STATES ============
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [transformedMediaUrls, setTransformedMediaUrls] = useState<string[]>(
    []
  );
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  // ============ MENU STATES ============
  const [showMenu, setShowMenu] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [showSpecificModal, setShowSpecificModal] = useState(false);
  const [showExcludedModal, setShowExcludedModal] = useState(false);

  // ============ ACTION STATES ============
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [reactCount, setReactCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const reactionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [viewerId, setViewerId] = useState("");

  // ============ EDIT STATE ============
  const [isEditing, setIsEditing] = useState(false);

  // ============ HELPER FUNCTIONS ============
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  const handleCloseModal = () => {
    onClose();
  };

  // ============ EFFECT: Sync viewer identity from backend ============
  useEffect(() => {
    setViewerId(normalizeId(currentUser?.id));

    const syncViewerIdentity = async () => {
      try {
        const meId = normalizeId(await postApi.fetchCurrentViewerId());
        if (meId) {
          setViewerId(meId);
        }
      } catch {
        // Fallback to AuthContext id if /auth/me is unavailable.
      }
    };

    syncViewerIdentity();
  }, [currentUser?.id]);

  // ============ EFFECT: Auto-open edit mode for post owner ============
  useEffect(() => {
    const shouldOpenEdit = Boolean((location.state as any)?.openEdit);
    if (!shouldOpenEdit || !post || !viewerId) {
      return;
    }

    if (isSameUserId(viewerId, getPostOwnerId(post))) {
      setIsEditing(true);
    }
  }, [location.state, post, viewerId]);

  // ============ EFFECT: Fetch post data ============
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);

        const postData = await postApi.fetchPostById(postId);
        setPost(postData);

        const authorData = postData.authorSummary || await postApi.fetchPostAuthorById(postData.authorId);
        setAuthor(authorData);

        if (postData.taggedUserIds && postData.taggedUserIds.length > 0) {
          const taggedUsersData = await postApi.fetchUsersByIds(
            postData.taggedUserIds
          );
          setTaggedUsers(taggedUsersData);
        }

        const reactCountData = await postApi.fetchPostReactionsCount(postId);
        setReactCount(reactCountData);

        if (viewerId) {
          const savedStatus = await postApi.checkPostSaved(viewerId, postId);
          setIsSaved(savedStatus);
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
  }, [postId, viewerId]);

  // ============ EFFECT: Fetch user's reaction ============
  useEffect(() => {
    const fetchUserReaction = async () => {
      if (!viewerId) return;

      try {
        const reaction = await postApi.fetchUserReaction(viewerId, postId);
        setCurrentReaction(reaction?.type || null);
      } catch (error) {
        console.log("PostModal: Error fetching reaction:", error);
        setCurrentReaction(null);
      }
    };
    fetchUserReaction();
  }, [postId, viewerId]);

  // ============ EFFECT: Transform media URLs ============
  useEffect(() => {
    if (!post || !post.media || post.media.length === 0) {
      setTransformedMediaUrls([]);
      setCurrentImageIndex(0);
      return;
    }

    const urls = postApi.transformMediaToS3Urls(
      post.media,
      post.authorId || ""
    );
    setTransformedMediaUrls(urls);
    setCurrentImageIndex((prev) =>
      Math.min(prev, Math.max(0, urls.length - 1))
    );
  }, [post]);

  // ============ EFFECT: Refetch on window focus ============
  useEffect(() => {
    const handleFocus = () => {
      if (!viewerId) return;

      const refetchData = async () => {
        try {
          const reaction = await postApi.fetchUserReaction(viewerId, postId);
          setCurrentReaction(reaction?.type || null);

          const count = await postApi.fetchPostReactionsCount(postId);
          setReactCount(count);

          const saved = await postApi.checkPostSaved(viewerId, postId);
          setIsSaved(saved);
        } catch (error) {
          console.debug("Error refetching data:", error);
        }
      };

      refetchData();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [viewerId, postId]);

  // ============ EFFECT: Listen to post-update events from other components ============
  useEffect(() => {
    const handlePostUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { postId: eventPostId, type, reactionType, likesCount, isSaved: newIsSaved } = customEvent.detail;
      if (eventPostId !== postId) return;

      if (type === "reaction") {
        setCurrentReaction(reactionType);
        if (typeof likesCount === "number") {
          setReactCount(likesCount);
        }
      } else if (type === "save") {
        if (typeof newIsSaved === "boolean") {
          setIsSaved(newIsSaved);
        }
      }
    };

    window.addEventListener("post-update", handlePostUpdate);
    return () => {
      window.removeEventListener("post-update", handlePostUpdate);
    };
  }, [postId]);

  // ============ HANDLERS: Menu & Privacy ============
  const handleEdit = () => {
    if (!post) return;
    setShowMenu(false);
    setIsEditing(true);
  };

  const handleChangePrivacy = async (newPrivacy: string) => {
    if (!post) return;

    try {
      if (!viewerId) {
        alert("Please login to update privacy");
        return;
      }

      const updatedPost = await postApi.updatePostPrivacy(
        viewerId,
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
      if (!viewerId) {
        alert("Please login to delete post");
        return;
      }
      await postApi.deletePost(postId, viewerId);
      alert("Xóa bài viết thành công!");
      handleCloseModal();
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Không thể xóa bài viết. Bạn chỉ có thể xóa bài viết của mình.");
      setShowMenu(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowMenu(false);
  };

  // ============ HANDLERS: Actions (Reaction, Save) ============
  const handleReaction = async (reactionType: string) => {
    if (!viewerId) {
      alert("Please login to react");
      return;
    }

    try {
      const reaction = await postApi.togglePostReaction(
        viewerId,
        postId,
        reactionType
      );

      let nextReaction: string | null = null;
      let nextReactCount = reactCount;

      if (!reaction) {
        nextReaction = null;
        nextReactCount = Math.max(0, reactCount - 1);
      } else {
        const wasNewReaction = currentReaction === null;
        nextReaction = reaction.type;
        if (wasNewReaction) {
          nextReactCount = reactCount + 1;
        }
      }

      setCurrentReaction(nextReaction);
      setReactCount(nextReactCount);

      // Dispatch event to sync other components
      window.dispatchEvent(
        new CustomEvent("post-update", {
          detail: {
            postId,
            type: "reaction",
            reactionType: nextReaction,
            likesCount: nextReactCount,
          },
        })
      );
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const handleSave = async () => {
    if (!viewerId) {
      alert("Please login to save posts");
      return;
    }

    try {
      await postApi.togglePostSaved(viewerId, postId);
      const nextSaved = !isSaved;
      setIsSaved(nextSaved);

      // Dispatch event to sync other components
      window.dispatchEvent(
        new CustomEvent("post-update", {
          detail: {
            postId,
            type: "save",
            isSaved: nextSaved,
          },
        })
      );
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  const handleShare = async () => {
    if (!viewerId) {
      toast.error("Vui lòng đăng nhập để chia sẻ bài viết");
      return;
    }

    try {
      await postApi.sharePost(postId);
      toast.success("Đã chia sẻ bài viết thành công!");
    } catch (error) {
      console.error("Error sharing post:", error);
      toast.error("Không thể chia sẻ bài viết");
    }
  };

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  // ============ ERROR STATE ============
  if (error) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleCloseModal}
      >
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
          <h2 className="text-xl font-bold text-red-600 mb-4">
            Error Loading Post
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={handleCloseModal}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const isOwnPost = isSameUserId(viewerId, getPostOwnerId(post));

  // ============ RENDER ============
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Close Button */}
      <button
        onClick={handleCloseModal}
        className="absolute right-8 top-8 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div className="relative bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
        {/* Left: Media */}
        <PostMediaViewer
          post={post}
          currentImageIndex={currentImageIndex}
          transformedMediaUrls={transformedMediaUrls}
          modalVideoRef={modalVideoRef}
          onImageChange={setCurrentImageIndex}
        />

        {/* Right: Details */}
        <div className="w-full md:w-[450px] flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <PostHeader
            post={post}
            author={author}
            currentUser={currentUser}
            isOwnPost={isOwnPost}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
            showPrivacyMenu={showPrivacyMenu}
            setShowPrivacyMenu={setShowPrivacyMenu}
            onEdit={handleEdit}
            onChangePrivacy={handleChangePrivacy}
            onDelete={handleDelete}
            onCopyLink={handleCopyLink}
            taggedUsers={taggedUsers}
            musicScopeId={`post-modal-music-${post.id}`}
            musicAutoPlayEnabled={true}
          />

          {/* Music Bar - above comments */}
          {post.music && (
            <div className="px-4 py-2 border-b dark:border-[#363636]">
              <MusicBar
                music={post.music}
                scopeId={`post-modal-music-${post.id}`}
                autoPlayEnabled={true}
              />
            </div>
          )}

          {/* Comments */}
          <PostComments 
            postId={postId} 
            viewerId={viewerId} 
            allowComments={post.allowComments}
            post={post}
          />

          {/* Actions & Reactions */}
          <PostActions
            currentReaction={currentReaction}
            reactCount={reactCount}
            isSaved={isSaved}
            showReactions={showReactions}
            setShowReactions={setShowReactions}
            onReaction={handleReaction}
            onSave={handleSave}
            onShare={handleShare}
            reactionsTimeoutRef={reactionsTimeoutRef}
            allowShares={post.allowShares}
          />
        </div>
      </div>

      {/* Privacy Modals */}
      <FriendSelectorModal
        isOpen={showSpecificModal}
        onClose={() => setShowSpecificModal(false)}
        onConfirm={() => {
          handleChangePrivacy("SPECIFIC");
        }}
        title="Who can see this?"
        description="Only selected friends will be able to see this post"
        initialSelected={[]}
      />

      <FriendSelectorModal
        isOpen={showExcludedModal}
        onClose={() => setShowExcludedModal(false)}
        onConfirm={() => {
          handleChangePrivacy("EXCEPT");
        }}
        title="Hide from"
        description="Selected friends won't be able to see this post"
        initialSelected={[]}
      />

      {/* Edit Modal */}
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

// Music Bar Component for PostModal
const MusicBar: React.FC<{
  music: any;
  scopeId: string;
  autoPlayEnabled: boolean;
}> = ({ music, scopeId, autoPlayEnabled }) => {
  const {
    containerRef,
    playingUrl,
    audioUrl,
    togglePlay: handleToggle,
  } = useMusicAutoplay({
    musicId: scopeId,
    audioPath: music?.audioUrl,
    enabled: Boolean(autoPlayEnabled && music?.audioUrl),
    focusRatio: 0.65,
  });

  return (
    <div ref={containerRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="relative flex items-center justify-center">
          <Music
            size={14}
            className={`shrink-0 ${
              playingUrl === audioUrl ? "text-blue-500 animate-pulse" : ""
            }`}
          />
          {playingUrl === audioUrl && (
            <div className="absolute -inset-1 bg-blue-500/10 rounded-full animate-ping" />
          )}
        </div>
        <span className="truncate flex-1 text-left">
          {music.title} • {music.artist}
        </span>
        {playingUrl === audioUrl ? (
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>
    </div>
  );
};
