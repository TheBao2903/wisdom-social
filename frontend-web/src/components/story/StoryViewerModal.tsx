import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { buildS3Url } from "../../utils/s3";
import { MUSIC_STICKER_STYLES, type MusicStickerStyle } from "../../types";
import {
  viewStory,
  deleteStory,
  updateStoryPrivacy,
  fetchStoryViewers,
} from "../../services/storyService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { musicFeedManager } from "../../services/MusicFeedManager";
import StoryOptionsBottomSheet from "./StoryOptionsBottomSheet";
import StoryReactionBar from "./StoryReactionBar";
import StoryViewersBottomSheet from "./StoryViewersBottomSheet";
import { removeStoriesFromHighlight } from "../../services/highlightService";
import HighlightOptionsBottomSheet from "./HighlightOptionsBottomSheet";
import EditHighlightModal from "./EditHighlightModal";
import useRealtimeStory from "../../hooks/useRealtimeStory";
import { useNavigate } from "react-router-dom";

export interface StoryGroup {
  userId: string;
  username: string;
  userAvatar: string;
  stories: any[];
}

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: StoryGroup[];
  initialGroupIdx?: number;
  initialStoryIdx?: number;
  onStoryViewed?: (storyId: string) => void;
  onGroupChanged?: (groupIdx: number) => void;
  highlightId?: string;
  highlightTitle?: string;
  highlightCoverImageUrl?: string;
  onStoryRemovedFromHighlight?: (storyId: string) => void;
  onHighlightUpdated?: () => void;
}

export default function StoryViewerModal({
  isOpen,
  onClose,
  groups,
  initialGroupIdx = 0,
  initialStoryIdx = 0,
  onStoryViewed,
  onGroupChanged: _onGroupChanged,
  highlightId,
  highlightTitle,
  highlightCoverImageUrl,
  onStoryRemovedFromHighlight,
  onHighlightUpdated,
}: StoryViewerModalProps) {
  const navigate = useNavigate();
  // Use groups directly — parent is responsible for keeping them stable
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [storyIdx, setStoryIdx] = useState(initialStoryIdx);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clamp indices to valid range
  const safeGroupIdx = Math.max(0, Math.min(groupIdx, groups.length - 1));
  const activeGroup = groups[safeGroupIdx];
  const safeStoryIdx = activeGroup
    ? Math.max(0, Math.min(storyIdx, activeGroup.stories.length - 1))
    : 0;
  const activeStory = activeGroup?.stories[safeStoryIdx];
  const currentUser = useCurrentUser();

  // Synchronous check against cached user in localStorage to prevent render flash
  const cachedUserStr = localStorage.getItem("current_user");
  let cachedUserId: string | null = null;
  if (cachedUserStr) {
    try {
      const parsed = JSON.parse(cachedUserStr);
      if (parsed && parsed.id) {
        cachedUserId = String(parsed.id);
      }
    } catch (e) {}
  }

  const isMyStory =
    activeGroup &&
    ((currentUser && String(currentUser.id) === String(activeGroup.userId)) ||
      (cachedUserId && String(cachedUserId) === String(activeGroup.userId)));

  // Sync state when modal is opened (reset to initial indices)
  useEffect(() => {
    if (isOpen) {
      setGroupIdx(initialGroupIdx);
      setStoryIdx(initialStoryIdx);
      setProgress(0);
      setIsFinished(false);
      setShowViewers(false);
      setShowHighlightOptions(false);
    }
  }, [isOpen]);

  // Close viewers sheet when story changes
  useEffect(() => {
    setShowViewers(false);
    setShowHighlightOptions(false);
  }, [groupIdx, storyIdx]);

  const [showOptions, setShowOptions] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showHighlightOptions, setShowHighlightOptions] = useState(false);
  const [showEditHighlight, setShowEditHighlight] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemovingHighlight, setIsRemovingHighlight] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [syncedViewCount, setSyncedViewCount] = useState<number | null>(null);

  const isModalOpen =
    showOptions || showViewers || showHighlightOptions || showEditHighlight;

  // Fetch real view count when story changes (owner only)
  useEffect(() => {
    if (isOpen && activeStory && isMyStory) {
      // Set to current viewCount initially
      setSyncedViewCount(activeStory.viewCount || 0);

      // Fetch fresh count from server
      fetchStoryViewers(activeStory.id)
        .then((viewersList) => {
          const count = Array.isArray(viewersList) ? viewersList.length : 0;
          setSyncedViewCount(count);
          // Update parent state directly by mutating model reference
          activeStory.viewCount = count;
        })
        .catch((err) => {
          console.error("Failed to sync story view count:", err);
        });
    } else {
      setSyncedViewCount(null);
    }
  }, [isOpen, activeStory?.id, isMyStory]);

  useRealtimeStory({
    storyId: activeStory?.id || "",
    enabled: !!(isOpen && activeStory?.id && isMyStory),
    onStoryUpdate: (event) => {
      if (event && event.type === "STORY_VIEW") {
        const newCount = event.data?.viewCount;
        if (typeof newCount === "number") {
          setSyncedViewCount(newCount);
          activeStory.viewCount = newCount;
        }
      }
    },
  });

  const handleDelete = async () => {
    if (!activeStory) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa tin này không?")) {
      setIsDeleting(true);
      try {
        await deleteStory(activeStory.id);

        // After deleting, advance to next story or close
        const group = groups[groupIdx];
        if (group) {
          const remainingStories = group.stories.filter(
            (s) => s.id !== activeStory.id
          );
          if (remainingStories.length === 0) {
            // No more stories in this group
            if (groupIdx < groups.length - 1) {
              setGroupIdx((prev) => prev + 1);
              setStoryIdx(0);
            } else {
              // Last group — close modal
              onClose();
              return;
            }
          } else if (storyIdx >= remainingStories.length) {
            // Was the last story in group, go to next group
            if (groupIdx < groups.length - 1) {
              setGroupIdx((prev) => prev + 1);
              setStoryIdx(0);
            } else {
              onClose();
              return;
            }
          }
        }

        setShowOptions(false);
        setIsPaused(false);
        setProgress(0);
      } catch (err) {
        alert("Xóa tin thất bại!");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleUpdatePrivacy = async (newPrivacy: string) => {
    if (!activeStory) return;
    setIsUpdating(true);
    try {
      await updateStoryPrivacy(activeStory.id, newPrivacy);
      // Mutate the story object directly so UI reflects change
      activeStory.privacy = newPrivacy;

      setShowOptions(false);
      setIsPaused(false);
    } catch (err) {
      alert("Cập nhật quyền riêng tư thất bại!");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveFromHighlight = async () => {
    if (!activeStory || !highlightId) return;
    if (window.confirm("Bạn có chắc chắn muốn gỡ tin này khỏi tin nổi bật?")) {
      setIsRemovingHighlight(true);
      try {
        await removeStoriesFromHighlight(highlightId, [activeStory.id]);

        // Notify parent to refresh highlights list
        onStoryRemovedFromHighlight?.(activeStory.id);

        // Advance to next story or close
        const group = groups[groupIdx];
        if (group) {
          const remainingStories = group.stories.filter(
            (s) => s.id !== activeStory.id
          );
          // Mutate local array reference
          group.stories = remainingStories;

          if (remainingStories.length === 0) {
            onClose();
            return;
          } else if (storyIdx >= remainingStories.length) {
            setStoryIdx(remainingStories.length - 1);
          }
        }

        setShowHighlightOptions(false);
        setIsPaused(false);
        setProgress(0);
      } catch (err) {
        alert("Gỡ tin nổi bật thất bại!");
      } finally {
        setIsRemovingHighlight(false);
      }
    }
  };

  // Record view on story active
  useEffect(() => {
    if (
      isOpen &&
      activeStory &&
      currentUser &&
      !activeStory.isViewed &&
      !isFinished
    ) {
      viewStory(activeStory.id).then(() => {
        activeStory.isViewed = true;
        onStoryViewed?.(activeStory.id);
      });
    }
  }, [isOpen, activeStory, currentUser, onStoryViewed, isFinished]);

  // Suspend any playing feed/post music when Story Modal is open
  useEffect(() => {
    if (isOpen) {
      musicFeedManager.setSuspended(true);
    }
    return () => {
      musicFeedManager.setSuspended(false);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsFinished(false);
    setProgress(0);
    setShowViewers(false);
    setIsPaused(false);
    onClose();
  };

  const handleOpenProfile = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!activeGroup?.username) return;
      handleClose();
      navigate(`/profile/${activeGroup.username}`);
    },
    [activeGroup?.username, navigate]
  );

  const handleNext = useCallback(() => {
    const group = groups[groupIdx];
    if (!group) return;

    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((prev) => prev + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((prev) => prev + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      setIsFinished(true);
    }
  }, [groupIdx, storyIdx, groups]);

  const handleNextRef = useRef(handleNext);
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handlePrev = useCallback(() => {
    if (isFinished) {
      setIsFinished(false);
      setProgress(0);
      return;
    }
    if (storyIdx > 0) {
      setStoryIdx((prev) => prev - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx((prev) => prev - 1);
      setStoryIdx(prevGroup ? prevGroup.stories.length - 1 : 0);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [groupIdx, storyIdx, groups, isFinished]);

  // Audio (music) player effect
  useEffect(() => {
    if (!isOpen || !activeStory || isFinished) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      return;
    }

    setProgress(0);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    let activeAudio: HTMLAudioElement | null = null;

    if (activeStory.music && activeStory.music.audioUrl) {
      const resolvedUrl =
        buildS3Url(activeStory.music.audioUrl) || activeStory.music.audioUrl;
      activeAudio = new Audio(resolvedUrl);
      activeAudio.volume = 0.8;
      activeAudio.loop = true;
      audioRef.current = activeAudio;

      if (!isPaused) {
        activeAudio
          .play()
          .catch((err) => console.log("Audio play blocked:", err));
      }
    }

    return () => {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.src = "";
      }
      if (audioRef.current === activeAudio) {
        audioRef.current = null;
      }
    };
  }, [isOpen, groupIdx, storyIdx, isFinished]);

  // Progress Timer Effect (only for non-video stories)
  const progressRef = useRef(0);
  useEffect(() => {
    if (!isOpen || isPaused || isInputFocused || !activeStory || isFinished)
      return;

    const isVideoStory = activeStory.media?.type?.toUpperCase() === "VIDEO";
    if (isVideoStory) return; // Handled by inline video element events

    const duration = activeStory.duration_ms || 5000;
    const step = 50;
    const increment = (step / duration) * 100;
    progressRef.current = 0;

    const intervalId = setInterval(() => {
      progressRef.current += increment;
      if (progressRef.current >= 100) {
        clearInterval(intervalId);
        setProgress(100);
        // Defer handleNext to avoid calling setProgress(0) while timer is still in-flight
        setTimeout(() => handleNextRef.current(), 0);
      } else {
        setProgress(progressRef.current);
      }
    }, step);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOpen, groupIdx, storyIdx, isPaused, isInputFocused, isFinished]);

  // Pause / Resume Effect
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (isPaused) {
      video?.pause();
      audio?.pause();
    } else {
      video?.play().catch(() => {});
      audio?.play().catch(() => {});
    }
  }, [isPaused]);

  if (!isOpen || groups.length === 0) return null;
  if (!isFinished && (!activeStory || !activeGroup)) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const parseStoryContent = (story: any) => {
    if (!story)
      return {
        cleanText: "",
        bgClass: "bg-gradient-to-br from-purple-600 via-pink-500 to-red-500",
      };
    const text = story.text || "";
    let cleanText = text;
    let bgClass = "bg-gradient-to-br from-purple-600 via-pink-500 to-red-500";

    const bgMatch = text.match(/\[bg:(.*?)\]/);
    if (bgMatch) {
      bgClass = bgMatch[1];
      cleanText = text.replace(/\[bg:(.*?)\]/, "").trim();
    }

    return { cleanText, bgClass };
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Vừa xong";
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ngày trước`;
    } catch {
      return "";
    }
  };

  const touchStartTimeRef = useRef<number>(0);

  const handleTouchStart = () => {
    touchStartTimeRef.current = Date.now();
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    const duration = Date.now() - touchStartTimeRef.current;
    if (duration < 250) {
      const touch = e.changedTouches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      if (x < rect.width * 0.3) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handleMouseDown = () => {
    touchStartTimeRef.current = Date.now();
    setIsPaused(true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPaused(false);
    const duration = Date.now() - touchStartTimeRef.current;
    if (duration < 250) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width * 0.3) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const renderStoryContent = (story: any) => {
    if (!story) return null;
    const { cleanText, bgClass } = parseStoryContent(story);
    const mediaUrl = story.media?.url
      ? buildS3Url(story.media.url) || story.media.url
      : null;

    if (mediaUrl) {
      const isVideo = story.media?.type?.toUpperCase() === "VIDEO";
      if (isVideo) {
        return (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full object-cover"
            playsInline
            autoPlay={!isPaused}
            muted={story.music?.muteOriginal ?? false}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              if (video.duration) {
                setProgress((video.currentTime / video.duration) * 100);
              }
            }}
            onEnded={handleNext}
          />
        );
      } else {
        return (
          <img
            src={mediaUrl}
            alt="Story content"
            className="w-full h-full object-cover"
            draggable={false}
          />
        );
      }
    }

    const hasTextLayers = story.text_layers && story.text_layers.length > 0;

    return (
      <div
        className={`w-full h-full ${bgClass} flex items-center justify-center p-8 text-center`}
      >
        {!hasTextLayers && cleanText && (
          <span className="text-white text-xl font-bold whitespace-pre-wrap leading-relaxed drop-shadow-md">
            {cleanText}
          </span>
        )}
      </div>
    );
  };

  const renderTextLayers = (story: any) => {
    if (!story?.text_layers || story.text_layers.length === 0) return null;

    const sorted = [...story.text_layers].sort(
      (a: any, b: any) => (a.z_index || 1) - (b.z_index || 1)
    );

    return (
      <>
        {sorted.map((layer: any) => (
          <div
            key={layer.id}
            className="absolute pointer-events-none"
            style={{
              left: `${(layer.x_pct || 0.5) * 100}%`,
              top: `${(layer.y_pct || 0.5) * 100}%`,
              transform: `translate(-50%, -50%) ${
                layer.style?.rotation
                  ? `rotate(${layer.style.rotation}deg)`
                  : ""
              }`,
              zIndex: layer.z_index || 1,
            }}
          >
            <span
              style={{
                color: layer.style?.color || "#FFFFFF",
                fontSize: `${layer.style?.fontSize || 16}px`,
                fontFamily: layer.style?.fontFamily || "Arial",
                fontWeight: layer.style?.bold ? "bold" : "normal",
                textAlign: layer.style?.align || "center",
                textShadow: layer.style?.shadow
                  ? "1px 1px 2px rgba(0, 0, 0, 0.5)"
                  : "none",
                display: "block",
                whiteSpace: "nowrap",
              }}
            >
              {layer.content}
            </span>
          </div>
        ))}
      </>
    );
  };

  const renderMusicStickers = (story: any) => {
    if (!story?.music_stickers || story.music_stickers.length === 0)
      return null;

    const sorted = [...story.music_stickers].sort(
      (a: any, b: any) => (a.z_index || 1) - (b.z_index || 1)
    );

    return (
      <>
        {sorted.map((sticker: any) => {
          const albumUrl = sticker.meta?.cover_url
            ? buildS3Url(sticker.meta.cover_url)
            : null;
          const style = (sticker.style ||
            MUSIC_STICKER_STYLES.rectangle) as MusicStickerStyle;

          // Render based on style variant
          let content;

          if (style === MUSIC_STICKER_STYLES.compact) {
            content = (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                <div className="flex items-end gap-[2px] h-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-white rounded-full"
                      style={{
                        height: !isPaused ? undefined : "4px",
                        animation: !isPaused
                          ? `musicBar${i} 0.${4 + i}s ease-in-out infinite alternate`
                          : "none",
                      }}
                    />
                  ))}
                </div>
                <div className="text-white min-w-0">
                  <p className="text-[11px] font-semibold truncate leading-tight">
                    {sticker.meta?.title}
                  </p>
                  <p className="text-[9px] text-white/60 truncate leading-tight">
                    {sticker.meta?.artist}
                  </p>
                </div>
              </div>
            );
          } else if (style === MUSIC_STICKER_STYLES.square) {
            content = (
              <div className="w-[150px] rounded-2xl overflow-hidden bg-black/60 backdrop-blur-xl border border-white/10 shadow-xl">
                <div className="w-full aspect-square relative">
                  {albumUrl ? (
                    <img
                      src={albumUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-4xl">♪</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {!isPaused && (
                    <div className="absolute bottom-2 left-2 flex items-end gap-[2px] h-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="w-[2px] bg-white rounded-full"
                          style={{
                            animation: `musicBar${i} 0.${3 + i}s ease-in-out infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="text-[11px] font-semibold text-white truncate">
                    {sticker.meta?.title}
                  </p>
                  <p className="text-[9px] text-white/50 truncate">
                    {sticker.meta?.artist}
                  </p>
                </div>
              </div>
            );
          } else if (style === MUSIC_STICKER_STYLES.vinyl) {
            content = (
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative w-[120px] h-[120px]">
                  <div
                    className="absolute inset-0 rounded-full bg-[#1a1a1a] shadow-[0_0_20px_rgba(0,0,0,0.4),inset_0_0_30px_rgba(0,0,0,0.3)]"
                    style={{
                      animation: !isPaused
                        ? "vinylSpin 3s linear infinite"
                        : "none",
                      background: `radial-gradient(circle at center,
                        transparent 22%,
                        #222 23%, #222 24%, #333 24.5%,
                        #222 25%, #222 35%, #333 35.5%,
                        #222 36%, #222 46%, #333 46.5%,
                        #222 47%, #1a1a1a 48%)`,
                    }}
                  >
                    <div className="absolute top-1/2 left-1/2 w-[50px] h-[50px] -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden border-2 border-white/10 shadow-inner">
                      {albumUrl ? (
                        <img
                          src={albumUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-white text-sm">♪</span>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-1/2 left-1/2 w-[8px] h-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a1a1a] border border-white/10" />
                  </div>
                  {/* Glow */}
                  {!isPaused && (
                    <div className="absolute inset-[-4px] rounded-full bg-purple-500/10 blur-md pointer-events-none animate-pulse" />
                  )}
                </div>
                <div className="text-center max-w-[130px]">
                  <p className="text-[10px] font-semibold text-white truncate">
                    {sticker.meta?.title}
                  </p>
                  <p className="text-[8px] text-white/50 truncate">
                    {sticker.meta?.artist}
                  </p>
                </div>
              </div>
            );
          } else if (style === MUSIC_STICKER_STYLES.hidden) {
            content = (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                  <span className="text-white text-[8px]">♪</span>
                </div>
                {!isPaused && (
                  <div className="flex items-end gap-[1.5px] h-2.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-[2px] bg-white/70 rounded-full"
                        style={{
                          animation: `musicBar${i} 0.${4 + i}s ease-in-out infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          } else {
            // Default: rectangle style
            content = (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 min-w-[200px] max-w-[260px] shadow-lg">
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
                  {albumUrl ? (
                    <img
                      src={albumUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-white text-lg">♪</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate leading-tight">
                    {sticker.meta?.title}
                  </p>
                  <p className="text-[10px] text-white/50 truncate leading-tight mt-0.5">
                    {sticker.meta?.artist}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={sticker.id}
              className="absolute pointer-events-none"
              style={{
                left: `${(sticker.x_pct || 0.5) * 100}%`,
                top: `${(sticker.y_pct || 0.5) * 100}%`,
                transform: `translate(-50%, -50%) ${
                  sticker.rotation_deg
                    ? `rotate(${sticker.rotation_deg}deg)`
                    : ""
                }`,
                zIndex: sticker.z_index || 1,
              }}
            >
              {content}
            </div>
          );
        })}
      </>
    );
  };

  const { cleanText } = activeStory
    ? parseStoryContent(activeStory)
    : { cleanText: "" };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center select-none">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 md:top-6 md:right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all duration-200 z-50 cursor-pointer"
        title="Đóng"
      >
        <X size={20} />
      </button>

      {/* Desktop Left navigation arrow */}
      {isFinished || groupIdx > 0 || storyIdx > 0 ? (
        <button
          onClick={handlePrev}
          className="hidden md:flex absolute left-8 lg:left-16 text-white/50 hover:text-white bg-white/5 hover:bg-white/15 p-4 rounded-full transition-all duration-200 hover:scale-105 z-50 cursor-pointer"
        >
          <ChevronLeft size={28} />
        </button>
      ) : null}

      {/* Main Story Container */}
      <div
        className="relative w-full h-full max-h-[85vh] md:max-h-[90vh] max-w-[420px] aspect-[9/16] md:rounded-2xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow-2xl ring-1 ring-white/10"
        onMouseDown={isFinished || isModalOpen ? undefined : handleMouseDown}
        onMouseUp={isFinished || isModalOpen ? undefined : handleMouseUp}
        onTouchStart={isFinished || isModalOpen ? undefined : handleTouchStart}
        onTouchEnd={isFinished || isModalOpen ? undefined : handleTouchEnd}
      >
        {isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950 text-white relative">
            {/* Animated glowing checkmark background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)] pointer-events-none" />

            <div
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6 scale-95 animate-bounce animate-duration-3000"
              style={{ animationDuration: "3s" }}
            >
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Bạn đã xem hết tất cả tin
            </h3>
            <p className="text-xs text-white/50 max-w-[240px] leading-relaxed mb-8">
              Hãy quay lại sau để cập nhật những khoảnh khắc mới nhất từ bạn bè.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-[200px] z-10">
              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-98 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setGroupIdx(0);
                  setStoryIdx(0);
                  setProgress(0);
                  setIsFinished(false);
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 active:scale-98 text-white/80 rounded-xl text-xs font-semibold border border-white/10 transition-all cursor-pointer"
              >
                Xem lại từ đầu
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top progress indicators and Header */}
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-40">
              {/* Progress bars */}
              <div className="flex gap-1 mb-3">
                {activeGroup?.stories?.map((_, i) => {
                  let widthPercent = 0;
                  if (i < storyIdx) widthPercent = 100;
                  else if (i === storyIdx) widthPercent = progress;
                  return (
                    <div
                      key={i}
                      className="flex-1 h-[2.5px] bg-white/30 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full bg-white transition-all duration-[50ms] ease-linear"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* User details */}
              <div className="flex items-center justify-between w-full pr-1">
                <div className="flex items-center gap-2.5">
                  {activeGroup && (
                    <button
                      type="button"
                      onClick={handleOpenProfile}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-full cursor-pointer"
                      title={`Xem profile ${activeGroup.username}`}
                    >
                      <img
                        src={
                          buildS3Url(activeGroup.userAvatar) ||
                          activeGroup.userAvatar ||
                          "https://i.pravatar.cc/150"
                        }
                        alt={activeGroup.username}
                        className="w-9 h-9 rounded-full object-cover border border-white/20 hover:opacity-90 transition-opacity"
                      />
                    </button>
                  )}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={handleOpenProfile}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      className="text-left text-white text-xs font-bold leading-tight hover:underline cursor-pointer"
                    >
                      {activeGroup?.username}
                    </button>
                    <span className="text-white/50 text-[10px] leading-tight mt-0.5">
                      {activeStory?.createdAt
                        ? formatTimeAgo(activeStory.createdAt)
                        : ""}
                    </span>
                  </div>
                </div>

                {/* 3-dots menu for own stories */}
                {isMyStory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPaused(true);
                      setShowOptions(true);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all duration-200 cursor-pointer z-50 flex items-center justify-center"
                    title="Tùy chọn tin"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Main content body */}
            <div className="flex-1 w-full h-full relative">
              {renderStoryContent(activeStory)}
              {/* Text layers overlay */}
              {renderTextLayers(activeStory)}
              {/* Music stickers overlay */}
              {renderMusicStickers(activeStory)}
            </div>

            {/* Text Overlay for media stories */}
            {activeStory?.media?.url && cleanText && (!activeStory.text_layers || activeStory.text_layers.length === 0) && (
              <div
                className={`absolute inset-x-4 bg-black/45 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/10 text-center pointer-events-none z-30 ${
                  isMyStory
                    ? "bottom-20"
                    : !isMyStory &&
                      (activeStory?.allowReactions !== false ||
                        activeStory?.allowReplies !== false)
                    ? "bottom-28"
                    : "bottom-8"
                }`}
              >
                <p className="text-white text-xs font-medium whitespace-pre-wrap leading-snug drop-shadow-sm">
                  {cleanText}
                </p>
              </div>
            )}

            {/* Reaction & Reply Bar (for non-owner viewers) */}
            {activeStory && (
              <StoryReactionBar
                storyId={activeStory.id}
                storyOwnerId={activeGroup?.userId || ""}
                isMyStory={!!isMyStory}
                allowReactions={activeStory.allowReactions !== false}
                allowReplies={activeStory.allowReplies !== false}
                onFocus={() => {
                  setIsPaused(true);
                  setIsInputFocused(true);
                }}
                onBlur={() => {
                  setIsPaused(false);
                  setIsInputFocused(false);
                }}
              />
            )}

            {/* View Count for Owner */}
            {isMyStory && activeStory && (
              <div
                className="absolute bottom-0 left-0 right-0 h-28 z-40 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {/* Activity / Viewers button */}
                <button
                  onClick={() => {
                    setIsPaused(true);
                    setShowViewers(true);
                  }}
                  className="absolute left-6 bottom-5 flex flex-col items-center gap-1.5 hover:scale-105 active:scale-95 text-white/80 hover:text-white cursor-pointer transition-all duration-200 pointer-events-auto"
                  title="Hoạt động"
                >
                  <Users size={20} className="text-white drop-shadow-xs" />
                  <span className="text-[10px] font-bold font-sans tracking-wide">
                    Hoạt động ({syncedViewCount ?? activeStory.viewCount ?? 0})
                  </span>
                </button>

                {/* More Options button for Highlights */}
                {highlightId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPaused(true);
                      setShowHighlightOptions(true);
                    }}
                    className="absolute right-6 bottom-5 flex flex-col items-center gap-1.5 hover:scale-105 active:scale-95 text-white/80 hover:text-white cursor-pointer transition-all duration-200 pointer-events-auto"
                    title="Tùy chọn tin nổi bật"
                  >
                    <MoreHorizontal
                      size={20}
                      className="text-white drop-shadow-xs"
                    />
                    <span className="text-[10px] font-bold font-sans tracking-wide">
                      Xem thêm
                    </span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {/* Premium Options Menu Bottom Sheet */}
        <StoryOptionsBottomSheet
          isOpen={showOptions}
          onClose={() => {
            setShowOptions(false);
            setIsPaused(false);
          }}
          activeStory={activeStory}
          isDeleting={isDeleting}
          isUpdating={isUpdating}
          onDelete={handleDelete}
          onUpdatePrivacy={handleUpdatePrivacy}
        />

        {/* Story Viewers list Bottom Sheet */}
        {activeStory && (
          <StoryViewersBottomSheet
            isOpen={showViewers}
            onClose={() => {
              setShowViewers(false);
              setIsPaused(false);
            }}
            storyId={activeStory.id}
            viewCount={activeStory.viewCount || 0}
            onViewersLoaded={(count) => {
              setSyncedViewCount(count);
            }}
          />
        )}

        {/* Highlight Options list Bottom Sheet */}
        {activeStory && highlightId && (
          <HighlightOptionsBottomSheet
            isOpen={showHighlightOptions}
            onClose={() => {
              setShowHighlightOptions(false);
              setIsPaused(false);
            }}
            onEdit={() => {
              setShowHighlightOptions(false);
              setShowEditHighlight(true);
            }}
            onRemove={handleRemoveFromHighlight}
            isRemoving={isRemovingHighlight}
          />
        )}

        {/* Edit Highlight Modal */}
        {highlightId && activeGroup && (
          <EditHighlightModal
            userId={activeGroup.userId}
            highlightId={highlightId}
            highlightTitle={highlightTitle || "Tin nổi bật"}
            initialCoverImageUrl={highlightCoverImageUrl}
            currentStoryIds={activeGroup.stories.map((s: any) => s.id)}
            isOpen={showEditHighlight}
            onClose={() => {
              setShowEditHighlight(false);
              setIsPaused(false);
            }}
            onUpdated={() => {
              onHighlightUpdated?.();
              onClose();
            }}
          />
        )}
      </div>

      {/* Desktop Right navigation arrow */}
      {!isFinished &&
      activeGroup &&
      (groupIdx < groups.length - 1 ||
        storyIdx < activeGroup.stories.length - 1) ? (
        <button
          onClick={handleNext}
          className="hidden md:flex absolute right-8 lg:right-16 text-white/50 hover:text-white bg-white/5 hover:bg-white/15 p-4 rounded-full transition-all duration-200 hover:scale-105 z-50 cursor-pointer"
        >
          <ChevronRight size={28} />
        </button>
      ) : null}
    </div>
  );
}
