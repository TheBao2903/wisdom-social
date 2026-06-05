import { useState, useEffect } from "react";
import { X, Eye } from "lucide-react";
import { fetchStoryViewers } from "../../services/storyService";
import { buildS3Url } from "../../utils/s3";
import useRealtimeStory from "../../hooks/useRealtimeStory";

interface StoryViewersBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  viewCount: number;
  onViewersLoaded?: (count: number) => void;
}

interface ViewerInfo {
  viewerId: string;
  viewedAt: string;
  reaction?: string;
  username?: string;
  avatarUrl?: string;
}

export default function StoryViewersBottomSheet({
  isOpen,
  onClose,
  storyId,
  viewCount: _viewCount,
  onViewersLoaded,
}: StoryViewersBottomSheetProps) {
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadViewers = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await fetchStoryViewers(storyId);
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
        ? (data as any).data
        : [];
      setViewers(list);
      onViewersLoaded?.(list.length);
    } catch (err) {
      console.error("Failed to load story viewers:", err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !storyId) {
      setViewers([]);
      return;
    }
    loadViewers(true);
  }, [isOpen, storyId]);

  useRealtimeStory({
    storyId,
    enabled: !!(isOpen && storyId),
    onStoryUpdate: (event) => {
      if (event && event.storyId === storyId) {
        if (event.type === "STORY_VIEW" || event.type === "STORY_REACTION") {
          void loadViewers(false);
        }
      }
    },
  });

  if (!isOpen) return null;

  const formatViewedTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (isNaN(diffMins)) return "";
      if (diffMins < 1) return "Vừa xem";
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return new Date(dateStr).toLocaleDateString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const safeViewers = Array.isArray(viewers) ? viewers : [];

  return (
    <div
      className="absolute inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-end"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Backdrop click closer */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Main card panel */}
      <div className="relative w-full max-h-[60vh] bg-zinc-900/95 backdrop-blur-md rounded-t-2xl border-t border-white/10 p-5 pb-8 flex flex-col gap-4 shadow-2xl animate-slide-up z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 text-white">
            <Eye size={16} className="text-blue-400" />
            <h4 className="text-xs font-bold">
              Người xem ({safeViewers.length})
            </h4>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-white/5 p-1.5 rounded-full cursor-pointer transition-all duration-200"
          >
            <X size={14} />
          </button>
        </div>

        {/* Viewers list content container */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[40vh] pr-1 scrollbar-thin scrollbar-thumb-white/10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-[10px] text-white/40">
                Đang tải danh sách...
              </span>
            </div>
          ) : safeViewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Eye size={20} className="text-white/30" />
              </div>
              <p className="text-xs text-white/60 font-semibold mb-1">
                Chưa có người xem
              </p>
              <p className="text-[10px] text-white/40 max-w-[200px]">
                Khi có người xem tin của bạn, danh sách người xem sẽ xuất hiện
                tại đây.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {safeViewers.map((viewer, index) => {
                const avatar =
                  buildS3Url(viewer.avatarUrl) ||
                  viewer.avatarUrl ||
                  "https://i.pravatar.cc/150";
                const viewerIdStr = viewer.viewerId
                  ? String(viewer.viewerId)
                  : "";
                const displayId = viewerIdStr
                  ? viewerIdStr.substring(0, 6)
                  : `User-${index}`;
                return (
                  <div
                    key={viewer.viewerId || `viewer-${index}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar with potential floating reaction emoji badge */}
                      <div className="relative">
                        <img
                          src={avatar}
                          alt={viewer.username || "User"}
                          className="w-10 h-10 rounded-full object-cover border border-white/15"
                        />
                        {viewer.reaction && (
                          <div className="absolute -bottom-1 -right-1 bg-zinc-800 text-xs w-5 h-5 rounded-full flex items-center justify-center border border-white/20 shadow-md">
                            {viewer.reaction}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex flex-col">
                        <span className="text-white text-xs font-semibold">
                          {viewer.username || `Người dùng ${displayId}`}
                        </span>
                        <span className="text-white/40 text-[9px] mt-0.5">
                          {formatViewedTime(viewer.viewedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Reaction column */}
                    {viewer.reaction && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
                        <span className="text-sm">{viewer.reaction}</span>
                        <span className="text-[9px] text-white/50 font-medium">
                          Cảm xúc
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
