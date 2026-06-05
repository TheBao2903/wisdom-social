import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as postApi from "../../../services/postService";
import { buildS3Url } from "../../../utils/s3";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import useVideoAutoplay from "../../../hooks/useVideoAutoplay";
import useMusicAutoplay from "../../../hooks/useMusicAutoplay";
import useCommentsNormalized from "../../../hooks/useCommentsNormalized";
import useRealtimeComments from "../../../hooks/useRealtimeComments";
import useRealtimeReactions from "../../../hooks/useRealtimeReactions";
import { commentService } from "../../../services/commentService";
import toast from "react-hot-toast";
import EditPostModal from "../EditPostModal";
import type { PostData } from "../../../types/post";
import { getPrivacyDisplay } from "./privacy";
import type { PostCardProps } from "./types";
import PostCardHeader from "./PostCardHeader";
import PostCardMedia from "./PostCardMedia";
import PostCardActions from "./PostCardActions";
import PostCardCommentsPreview from "./PostCardCommentsPreview";
import PostCardCommentInput from "./PostCardCommentInput";

export default function PostCard({ post }: PostCardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isOwnPost = currentUser?.id === post.user.id;
  const privacyDisplay = getPrivacyDisplay(post.privacy, isOwnPost);
  const authorAvatarUrl =
    buildS3Url(post.user.avatarUrl) ||
    post.user.avatarUrl ||
    "https://i.pravatar.cc/150?img=5";
  const currentUserAvatarUrl =
    buildS3Url(currentUser?.avatarUrl) ||
    currentUser?.avatarUrl ||
    "https://i.pravatar.cc/150?img=5";

  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [showReactions, setShowReactions] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showFullCommentsPreview, setShowFullCommentsPreview] = useState(false);
  const [recentCommentIds, setRecentCommentIds] = useState<string[]>([]);
  const fullCommentsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<any[]>([]);
  const [displayPost, setDisplayPost] = useState(post);

  useEffect(() => {
    setDisplayPost(post);
  }, [post]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [displayPost.images?.length]);

  useEffect(() => {
    if ((post as any).taggedUserIds && (post as any).taggedUserIds.length > 0) {
      const fetchTaggedUsers = async () => {
        try {
          const taggedUsersResponses = await Promise.all(
            (post as any).taggedUserIds.map((userId: string) =>
              postApi.fetchUserById(userId).catch(() => null)
            )
          );
          const filteredUsers = taggedUsersResponses.filter(
            (user) => user !== null
          );
          setTaggedUsers(filteredUsers);
        } catch (error) {
          console.error("Error fetching tagged users:", error);
        }
      };
      fetchTaggedUsers();
    }
  }, [isEditing, post]);

  const {
    commentsById,
    rootIds,
    expandedMap,
    loadingMap,
    totalCount,
    createReply,
    deleteComment,
    getDirectChildren,
    loadRootComments,
    handleCommentReactionUpdate,
  } = useCommentsNormalized({
    targetType: "POST",
    targetId: post.id,
  });

  useRealtimeComments({
    postId: post.id,
    commentsById,
    createReply,
    deleteComment,
    viewerId: currentUser?.id?.toString() || "",
    onCommentReceived: (newComment) => {
      if (!newComment.parentId) {
        setRecentCommentIds((prev) => [newComment.id, ...prev]);
        if (fullCommentsTimeoutRef.current) {
          clearTimeout(fullCommentsTimeoutRef.current);
        }
        setShowFullCommentsPreview(true);
        fullCommentsTimeoutRef.current = setTimeout(() => {
          setShowFullCommentsPreview(false);
          setRecentCommentIds([]);
        }, 5000);
      }
    },
    onCommentDeleted: (commentId) => {
      setRecentCommentIds((prev) => prev.filter((id) => id !== commentId));
    },
  });

  useRealtimeReactions({
    postId: post.id,
    onReactionUpdate: (event) => {
      // Don't update for own actions (already handled optimistically)
      if (event.userId === currentUser?.id?.toString()) return;

      if (event.targetType === "POST" && event.targetId === post.id) {
        setLikesCount((prev) =>
          event.action === "REACT" ? prev + 1 : Math.max(0, prev - 1)
        );
      } else if (event.targetType === "COMMENT") {
        handleCommentReactionUpdate(event.targetId, event.action);
      }
    },
  });

  const commentsCount =
    totalCount ||
    (Array.isArray((post as any).comments)
      ? (post as any).comments.length
      : Number((post as any).comments || 0));

  const totalImages = displayPost.images?.length || 0;
  const currentMedia = displayPost.media?.[currentImageIndex];
  const currentMediaUrl = displayPost.images[currentImageIndex] || "";
  const isCurrentMediaVideo = postApi.isVideoMedia(
    currentMediaUrl,
    currentMedia?.type
  );
  const shouldMuteOriginal =
    displayPost.music?.muteOriginal === true ||
    Boolean(displayPost.music?.audioUrl);
  const currentMediaDuration =
    typeof currentMedia?.duration === "number" ? currentMedia.duration : null;
  const videoInstanceId = `${displayPost.id}-${currentImageIndex}`;

  const { containerRef, videoRef } = useVideoAutoplay({
    videoId: videoInstanceId,
    enabled: isCurrentMediaVideo,
    focusRatio: 0.7,
    maxPlaySeconds: 15,
  });

  const musicUniqueId = `post-card-music-${displayPost.id}`;
  const {
    containerRef: musicContainerRef,
    playingUrl: musicPlayingUrl,
    audioUrl: musicAudioUrl,
    togglePlay: handleToggleMusic,
  } = useMusicAutoplay({
    musicId: musicUniqueId,
    audioPath: displayPost.music?.audioUrl,
    enabled: Boolean(displayPost.music?.audioUrl) && shouldMuteOriginal,
    focusRatio: 0.65,
    autoPlayOnFocus: false,
  });
  const isMusicPlaying = Boolean(musicAudioUrl && musicPlayingUrl === musicAudioUrl);

  useEffect(() => {
    const fetchReactionData = async () => {
      if (!currentUser?.id) return;

      try {
        const userReaction = await postApi.fetchUserReaction(
          String(currentUser.id),
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

        const saved = await postApi.checkPostSaved(
          String(currentUser.id),
          post.id
        );
        setIsSaved(saved);
      } catch (error) {
        console.debug("Error fetching reaction data for post:", post.id);
      }
    };

    fetchReactionData();
  }, [currentUser, post.id]);

  useEffect(() => {
    loadRootComments(0);
  }, [post.id, loadRootComments]);

  useEffect(() => {
    setShowFullCommentsPreview(false);
    if (fullCommentsTimeoutRef.current) {
      clearTimeout(fullCommentsTimeoutRef.current);
      fullCommentsTimeoutRef.current = null;
    }
  }, [post.id]);

  // ============ EFFECT: Listen to post-update events from other components ============
  useEffect(() => {
    const handlePostUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { postId: eventPostId, type, reactionType, likesCount: newLikesCount, isSaved: newIsSaved } = customEvent.detail;
      if (eventPostId !== post.id) return;

      if (type === "reaction") {
        setCurrentReaction(reactionType);
        setIsLiked(reactionType !== null);
        if (typeof newLikesCount === "number") {
          setLikesCount(newLikesCount);
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
  }, [post.id]);

  useEffect(() => {
    const handleFocus = () => {
      if (!currentUser?.id) return;

      const fetchReactionData = async () => {
        try {
          const userReaction = await postApi.fetchUserReaction(
            String(currentUser.id),
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

          const saved = await postApi.checkPostSaved(
            String(currentUser.id),
            post.id
          );
          setIsSaved(saved);
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
    }, 300);
    setHideTimeout(timeout);
  };

  const handleReaction = async (reactionType: string) => {
    try {
      if (!currentUser?.id) {
        alert("Please login to react");
        return;
      }

      const reaction = await postApi.togglePostReaction(
        String(currentUser.id),
        post.id,
        reactionType
      );

      let nextReaction: string | null = null;
      let nextLikesCount = likesCount;

      if (!reaction) {
        nextReaction = null;
        setIsLiked(false);
        nextLikesCount = Math.max(0, likesCount - 1);
      } else {
        const wasNewReaction = currentReaction === null;
        nextReaction = reaction.type;
        setIsLiked(true);
        if (wasNewReaction) {
          nextLikesCount = likesCount + 1;
        }
      }

      setCurrentReaction(nextReaction);
      setLikesCount(nextLikesCount);

      // Dispatch event to sync other components
      window.dispatchEvent(
        new CustomEvent("post-update", {
          detail: {
            postId: post.id,
            type: "reaction",
            reactionType: nextReaction,
            likesCount: nextLikesCount,
          },
        })
      );

      setShowReactions(false);
    } catch (error) {
      console.error("Error reacting to post:", error);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Like button should always toggle LIKE specifically
    handleReaction("LIKE");
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser?.id) {
      alert("Please login to save posts");
      return;
    }

    try {
      await postApi.togglePostSaved(String(currentUser.id), post.id);
      const nextSaved = !isSaved;
      setIsSaved(nextSaved);

      // Dispatch event to sync other components
      window.dispatchEvent(
        new CustomEvent("post-update", {
          detail: {
            postId: post.id,
            type: "save",
            isSaved: nextSaved,
          },
        })
      );
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/post/${post.id}`, { state: { from: location.pathname } });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser?.id) {
      toast.error("Vui lòng đăng nhập để chia sẻ bài viết");
      return;
    }

    try {
      await postApi.sharePost(post.id);
      toast.success("Đã chia sẻ bài viết thành công!");
    } catch (error) {
      console.error("Error sharing post:", error);
      toast.error("Không thể chia sẻ bài viết");
    }
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    setShowMenu(false);
    alert("Link copied to clipboard!");
  };

  const handleEdit = () => {
    setShowMenu(false);
    setIsEditing(true);
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

      await postApi.deletePost(post.id, String(currentUser.id));
      alert("Xóa bài viết thành công!");
      setShowMenu(false);
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

  const handleSelectImage = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  const handleSubmitComment = async (mentions: any[] = []) => {
    if (!commentInput.trim() || !currentUser?.id) return;

    setSubmittingComment(true);
    try {
      const newComment = await commentService.createComment(
        "POST",
        post.id,
        commentInput,
        currentUser.id,
        undefined,
        mentions
      );

      createReply(null, newComment);
      setCommentInput("");
      setRecentCommentIds((prev) => [newComment.id, ...prev]);

      if (fullCommentsTimeoutRef.current) {
        clearTimeout(fullCommentsTimeoutRef.current);
      }

      setShowFullCommentsPreview(true);
      fullCommentsTimeoutRef.current = setTimeout(() => {
        setShowFullCommentsPreview(false);
        setRecentCommentIds([]);
      }, 5000);
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      alert(error?.response?.data?.message || "Failed to submit comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const navigateToPost = () => {
    navigate(`/post/${post.id}`, {
      state: { backgroundLocation: location },
    });
  };

  const navigateToPostWithExpand = (commentId: string) => {
    navigate(`/post/${post.id}`, {
      state: {
        backgroundLocation: location,
        expandCommentId: commentId,
      },
    });
  };

  const handleCreateReplyPreview = () => {
    if (fullCommentsTimeoutRef.current) {
      clearTimeout(fullCommentsTimeoutRef.current);
    }
    setShowFullCommentsPreview(true);
    fullCommentsTimeoutRef.current = setTimeout(() => {
      setShowFullCommentsPreview(false);
      setRecentCommentIds([]);
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (fullCommentsTimeoutRef.current) {
        clearTimeout(fullCommentsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <article className="bg-white dark:bg-black border-b border-gray-200 dark:border-[#262626] mb-5">
      <PostCardHeader
        post={post}
        displayPost={displayPost}
        authorAvatarUrl={authorAvatarUrl}
        isOwnPost={isOwnPost}
        privacyDisplay={privacyDisplay}
        showMenu={showMenu}
        showPrivacyMenu={showPrivacyMenu}
        onToggleMenu={() => setShowMenu(!showMenu)}
        onCloseMenu={() => setShowMenu(false)}
        onTogglePrivacyMenu={() => setShowPrivacyMenu(!showPrivacyMenu)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCopyLink={handleCopyLink}
        onChangePrivacy={handleChangePrivacy}
        taggedUsers={taggedUsers}
      />

      {displayPost.caption || (displayPost as any).content ? (
        <div className="px-4 py-2 w-full overflow-x-hidden">
          <div
            className="text-sm leading-relaxed w-full"
            style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
          >
            <span className="text-gray-900 dark:text-white">
              {displayPost.caption || (displayPost as any).content}
            </span>
          </div>
        </div>
      ) : (
        ""
      )}

      <div ref={musicContainerRef}>
        <PostCardMedia
          displayPost={displayPost}
          totalImages={totalImages}
          currentImageIndex={currentImageIndex}
          currentMediaUrl={currentMediaUrl}
          currentMediaDuration={currentMediaDuration}
          isCurrentMediaVideo={isCurrentMediaVideo}
          locationPathname={location.pathname}
          onPrevImage={handlePrevImage}
          onNextImage={handleNextImage}
          onSelectImage={handleSelectImage}
          onToggleMusic={handleToggleMusic}
          containerRef={containerRef}
          videoRef={videoRef}
          hasMusic={Boolean(displayPost.music?.audioUrl)}
          isMusicPlaying={isMusicPlaying}
        />
      </div>

      <div className="px-4">
        <PostCardActions
          currentReaction={currentReaction}
          isLiked={isLiked}
          showReactions={showReactions}
          isSaved={isSaved}
          likesCount={likesCount}
          onLike={handleLike}
          onComment={handleComment}
          onSave={handleSave}
          onReaction={(reactionType, e) => {
            e.preventDefault();
            e.stopPropagation();
            handleReaction(reactionType);
          }}
          onReactionMouseEnter={handleMouseEnter}
          onReactionMouseLeave={handleMouseLeave}
          onShare={handleShare}
          allowComments={post.allowComments}
          allowShares={post.allowShares}
        />

        <PostCardCommentsPreview
          rootIds={rootIds}
          commentsCount={commentsCount}
          showFullCommentsPreview={showFullCommentsPreview}
          recentCommentIds={recentCommentIds}
          commentsById={commentsById}
          expandedMap={expandedMap}
          loadingMap={loadingMap}
          postId={post.id}
          getDirectChildren={getDirectChildren}
          onNavigateToPost={navigateToPost}
          onNavigateToPostWithExpand={navigateToPostWithExpand}
          onCreateReply={handleCreateReplyPreview}
          allowComments={post.allowComments}
        />

        {post.allowComments !== false && (
          <PostCardCommentInput
            currentUserAvatarUrl={currentUserAvatarUrl}
            commentInput={commentInput}
            submittingComment={submittingComment}
            onChangeCommentInput={setCommentInput}
            onSubmitComment={handleSubmitComment}
            currentUserId={currentUser?.id?.toString()}
          />
        )}

        <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-3">
          {post.createdAt && !isNaN(Date.parse(post.createdAt))
            ? new Date(post.createdAt).toLocaleString("vi-VN")
            : post.createdAt || "Vừa xong"}
        </p>
      </div>

      {isEditing && (
        <>
          {console.log(
            "🖼️ [DEBUG] Rendering EditPostModal with displayPost:",
            displayPost
          )}
          {console.log(
            "📍 [DEBUG] displayPost.location being passed:",
            (displayPost as any).location
          )}
          <EditPostModal
            postId={post.id}
            post={displayPost as unknown as PostData}
            taggedUsers={taggedUsers}
            onClose={() => setIsEditing(false)}
            onSaved={(updatedPost: any) => {
              let newImages: string[] = [];

              if (updatedPost.images && Array.isArray(updatedPost.images)) {
                newImages = updatedPost.images;
              } else if (
                updatedPost.media &&
                Array.isArray(updatedPost.media)
              ) {
                newImages = updatedPost.media.map((m: any) => {
                  const url = m.url || "";
                  return url.startsWith("http") ? url : buildS3Url(url);
                });
              } else if (
                updatedPost.mediaList &&
                Array.isArray(updatedPost.mediaList)
              ) {
                newImages = updatedPost.mediaList.map((m: any) => {
                  const url = typeof m === "string" ? m : m.url || "";
                  return url.startsWith("http") ? url : buildS3Url(url);
                });
              }

              if (newImages.length === 0) {
                newImages = (displayPost as any).images || [];
              }

              console.log("✅ [DEBUG] newImages after mapping:", newImages);
              console.log(
                "📊 [DEBUG] displayPost.images before update:",
                (displayPost as any).images
              );

              setDisplayPost({
                ...displayPost,
                caption: updatedPost.content || updatedPost.caption,
                content: updatedPost.content,
                privacy: updatedPost.privacy,
                location: updatedPost.location,
                images: newImages,
                media:
                  updatedPost.media ||
                  updatedPost.mediaList ||
                  (displayPost as any).media,
              } as any);

              console.log(
                "🔄 [DEBUG] displayPost state will update with newImages:",
                newImages
              );

              setCurrentImageIndex(0);
              setIsEditing(false);
            }}
          />
        </>
      )}
    </article>
  );
}
