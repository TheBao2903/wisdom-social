import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Check, Search, Loader2, Edit2, Users } from "lucide-react";
import { buildS3Url } from "../../utils/s3";
import {
  getAllUserStories,
  updateHighlight,
  deleteHighlight,
  type HighlightStory,
} from "../../services/highlightService";

interface EditHighlightModalProps {
  userId: string;
  highlightId: string;
  highlightTitle: string;
  initialCoverImageUrl?: string;
  currentStoryIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditHighlightModal({
  userId,
  highlightId,
  highlightTitle,
  initialCoverImageUrl,
  currentStoryIds,
  isOpen,
  onClose,
  onUpdated,
}: EditHighlightModalProps) {
  const [stories, setStories] = useState<HighlightStory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(highlightTitle);
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl || "");
  const [showCoverSelector, setShowCoverSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeletingHighlight, setIsDeletingHighlight] = useState(false);
  const [search, setSearch] = useState("");

  // Snapshot the original story IDs when the modal opens so they stay stable
  const originalIdsRef = useRef<string[]>([]);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUserStories(userId);
      setStories(data);
    } catch (err) {
      console.error("Failed to fetch stories:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Only reset when isOpen transitions to true — NOT when currentStoryIds ref changes
  useEffect(() => {
    if (isOpen) {
      originalIdsRef.current = currentStoryIds;
      fetchStories();
      setSelectedIds(new Set(currentStoryIds));
      setTitle(highlightTitle);
      setCoverImageUrl(initialCoverImageUrl || "");
      setSearch("");
      setShowCoverSelector(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleSelect = useCallback((storyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      await updateHighlight(highlightId, {
        title: title.trim(),
        storyIds: Array.from(selectedIds),
        coverImageUrl: coverImageUrl,
      });
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to update highlight:", err);
      alert("Cập nhật tin nổi bật thất bại!");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHighlight = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tin nổi bật này không?")) return;
    setIsDeletingHighlight(true);
    try {
      await deleteHighlight(highlightId);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to delete highlight:", err);
      alert("Xóa tin nổi bật thất bại!");
    } finally {
      setIsDeletingHighlight(false);
    }
  };

  // Compare against the stable snapshot, not the prop (which changes every render)
  const originalSet = useMemo(() => new Set(originalIdsRef.current), [originalIdsRef.current]);
  const hasChanges = useMemo(() => {
    if (title.trim() !== highlightTitle) return true;
    if (coverImageUrl !== (initialCoverImageUrl || "")) return true;
    if (originalSet.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!originalSet.has(id)) return true;
    }
    return false;
  }, [selectedIds, originalSet, title, coverImageUrl, highlightTitle, initialCoverImageUrl]);

  const getStoryThumbnail = (story: HighlightStory) => {
    if (story.media?.thumbnailUrl) {
      return buildS3Url(story.media.thumbnailUrl);
    }
    if (story.media?.url) {
      return buildS3Url(story.media.url);
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const parseStoryContent = (text?: string) => {
    if (!text) return { cleanText: "", bgClass: "bg-gradient-to-br from-purple-500 to-blue-500" };
    let cleanText = text;
    let bgClass = "bg-gradient-to-br from-purple-500 to-blue-500";

    const bgMatch = text.match(/\[bg:(.*?)\]/);
    if (bgMatch) {
      bgClass = bgMatch[1];
      cleanText = text.replace(/\[bg:(.*?)\]/, "").trim();
    }

    return { cleanText, bgClass };
  };

  const selectedStories = stories.filter((s) => selectedIds.has(s.id));

  const filteredStories = search.trim()
    ? stories.filter(
        (s) =>
          s.text?.toLowerCase().includes(search.toLowerCase()) ||
          s.highlightCategory?.toLowerCase().includes(search.toLowerCase())
      )
    : stories;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#262626] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#363636] shrink-0">
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
          <h2 className="text-base font-semibold dark:text-white">
            Chỉnh sửa "{highlightTitle}"
          </h2>
          <button
            onClick={handleSave}
            disabled={selectedIds.size === 0 || saving || !hasChanges}
            className={`text-sm font-semibold px-3 py-1 rounded-lg transition-colors ${
              selectedIds.size > 0 && !saving && hasChanges
                ? "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              `Lưu (${selectedIds.size})`
            )}
          </button>
        </div>

        {/* Cover Image & Title Section */}
        <div className="flex flex-col items-center bg-gray-50/50 dark:bg-zinc-800/30 p-4 border-b border-gray-100 dark:border-[#363636] gap-3 shrink-0">
          {/* Cover circle preview */}
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-[#363636] flex items-center justify-center">
              {coverImageUrl ? (
                coverImageUrl.startsWith("text-story:") ? (
                  (() => {
                    const storyText = coverImageUrl.substring("text-story:".length);
                    const { cleanText, bgClass } = parseStoryContent(storyText);
                    return (
                      <div className={`w-full h-full ${bgClass} flex items-center justify-center p-1 text-center`}>
                        <span className="text-white text-[8px] line-clamp-3 leading-tight font-semibold">{cleanText}</span>
                      </div>
                    );
                  })()
                ) : (
                  <img
                    src={buildS3Url(coverImageUrl) || undefined}
                    alt="Ảnh bìa"
                    className="w-full h-full object-cover"
                  />
                )
              ) : selectedStories.length > 0 ? (
                (() => {
                  const firstStory = selectedStories[0];
                  const thumb = getStoryThumbnail(firstStory);
                  if (thumb) {
                    return <img src={thumb || undefined} alt="Ảnh bìa" className="w-full h-full object-cover" />;
                  }
                  const { cleanText, bgClass } = parseStoryContent(firstStory.text);
                  return (
                    <div className={`w-full h-full ${bgClass} flex items-center justify-center p-1 text-center`}>
                      <span className="text-white text-[8px] line-clamp-3 leading-tight font-semibold">{cleanText}</span>
                    </div>
                  );
                })()
              ) : (
                <Users size={32} className="text-gray-400" />
              )}
            </div>
          </div>

          <button
            onClick={() => setShowCoverSelector(!showCoverSelector)}
            className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
          >
            {showCoverSelector ? "Ẩn danh sách ảnh bìa" : "Chỉnh sửa ảnh bìa"}
          </button>

          {/* Cover Selector Carousel */}
          {showCoverSelector && (
            <div className="w-full flex flex-col gap-2 bg-white dark:bg-[#262626] border border-gray-100 dark:border-[#363636] rounded-xl p-3 shadow-inner">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left w-full">
                Chọn một story từ danh sách đã chọn làm ảnh bìa:
              </span>
              {selectedStories.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">Hãy chọn ít nhất một story bên dưới</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                   {selectedStories.map((story) => {
                    const rawUrl = story.media
                      ? (story.media.thumbnailUrl || story.media.url || "")
                      : `text-story:${story.text || ""}`;
                    const isCurrentCover =
                      (coverImageUrl && buildS3Url(coverImageUrl) === buildS3Url(rawUrl)) ||
                      (!coverImageUrl && selectedStories[0]?.id === story.id);
                    const thumbUrl = getStoryThumbnail(story);

                    return (
                      <button
                        type="button"
                        key={`cover-${story.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCoverImageUrl(rawUrl);
                        }}
                        className={`relative w-12 h-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                          isCurrentCover
                            ? "border-blue-500 scale-105 shadow-md shadow-blue-500/20"
                            : "border-transparent hover:opacity-85"
                        }`}
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl || undefined}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (() => {
                            const { cleanText, bgClass } = parseStoryContent(story.text);
                            return (
                              <div className={`w-full h-full ${bgClass} flex items-center justify-center p-1`}>
                                {cleanText && (
                                  <span className="text-white text-[6px] line-clamp-3 leading-tight">{cleanText}</span>
                                )}
                              </div>
                            );
                          })()
                        )}
                        {isCurrentCover && (
                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                            <span className="bg-blue-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">Bìa</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Title Edit Input with Pencil Icon */}
          <div className="w-full max-w-xs relative flex items-center">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên tin nổi bật..."
              className="w-full px-3 py-2 pr-9 bg-white dark:bg-[#363636] border border-gray-200 dark:border-[#464646] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-semibold text-center"
              maxLength={30}
            />
            <div className="absolute right-3 text-gray-400 pointer-events-none">
              <Edit2 size={14} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#363636] shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Tìm kiếm story..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-[#363636] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-400/40 transition-all"
            />
          </div>
        </div>

        {/* Story Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2
                size={32}
                className="animate-spin text-gray-400"
              />
            </div>
          ) : filteredStories.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 dark:text-gray-400">
                {search
                  ? "Không tìm thấy story nào"
                  : "Bạn chưa có story nào"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filteredStories.map((story) => {
                const isSelected = selectedIds.has(story.id);
                const isOriginal = originalSet.has(story.id);
                const thumbUrl = getStoryThumbnail(story);

                return (
                  <button
                    key={story.id}
                    onClick={() => toggleSelect(story.id)}
                    className={`relative aspect-[9/16] rounded-lg overflow-hidden group transition-all duration-150 ${
                      isSelected
                        ? "ring-3 ring-blue-500 ring-offset-2 dark:ring-offset-[#262626]"
                        : "hover:opacity-90"
                    }`}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl || undefined}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (() => {
                        const { cleanText, bgClass } = parseStoryContent(story.text);
                        return (
                          <div className={`w-full h-full ${bgClass} flex items-center justify-center`}>
                            {cleanText ? (
                              <p className="text-white text-[10px] px-2 text-center line-clamp-4 leading-tight">
                                {cleanText}
                              </p>
                            ) : (
                              <span className="text-white/60 text-xs">
                                Story
                              </span>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {/* Selection indicator */}
                    <div
                      className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-blue-500 border-blue-500"
                          : "border-white/80 bg-black/20 group-hover:bg-black/30"
                      }`}
                    >
                      {isSelected && (
                        <Check
                          size={14}
                          className="text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>

                    {/* Date overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                      <span className="text-[10px] text-white/90 font-medium">
                        {formatDate(story.createdAt)}
                      </span>
                    </div>

                    {/* Currently in highlight badge */}
                    {isOriginal && (
                      <div className="absolute top-1.5 left-1.5 bg-blue-500/90 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                        Đã chọn
                      </div>
                    )}

                    {/* Archived badge (only if not already showing "Đã chọn") */}
                    {!isOriginal && story.isArchived && (
                      <div className="absolute top-1.5 left-1.5 bg-yellow-500/90 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                        Lưu trữ
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Delete Button */}
        <div className="p-4 border-t border-gray-100 dark:border-[#363636] shrink-0 bg-gray-50/50 dark:bg-zinc-800/10">
          <button
            onClick={handleDeleteHighlight}
            disabled={isDeletingHighlight}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-2 border border-red-200/50 dark:border-red-900/30 cursor-pointer"
          >
            Xóa tin nổi bật
          </button>
        </div>
      </div>
    </div>
  );
}
