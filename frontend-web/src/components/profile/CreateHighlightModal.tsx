import { useState, useEffect, useCallback } from "react";
import { X, Check, Search, Loader2 } from "lucide-react";
import { buildS3Url } from "../../utils/s3";
import {
  getAllUserStories,
  createHighlight,
  type HighlightStory,
} from "../../services/highlightService";

interface CreateHighlightModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateHighlightModal({
  userId,
  isOpen,
  onClose,
  onCreated,
}: CreateHighlightModalProps) {
  const [stories, setStories] = useState<HighlightStory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"select" | "name">("select");

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

  useEffect(() => {
    if (isOpen) {
      fetchStories();
      setSelectedIds(new Set());
      setTitle("");
      setStep("select");
      setSearch("");
    }
  }, [isOpen, fetchStories]);

  const toggleSelect = (storyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (selectedIds.size === 0) return;
    setStep("name");
  };

  const handleCreate = async () => {
    if (!title.trim() || selectedIds.size === 0) return;
    setCreating(true);
    try {
      await createHighlight(title.trim(), Array.from(selectedIds));
      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create highlight:", err);
    } finally {
      setCreating(false);
    }
  };

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

  const filteredStories = search.trim()
    ? stories.filter(
        (s) =>
          s.text?.toLowerCase().includes(search.toLowerCase()) ||
          s.highlightCategory?.toLowerCase().includes(search.toLowerCase())
      )
    : stories;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#262626] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#363636] shrink-0">
          <button
            onClick={step === "name" ? () => setStep("select") : onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            {step === "name" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            ) : (
              <X size={20} />
            )}
          </button>
          <h2 className="text-base font-semibold dark:text-white">
            {step === "select"
              ? "Chọn story cho highlight"
              : "Đặt tên highlight"}
          </h2>
          {step === "select" ? (
            <button
              onClick={handleNext}
              disabled={selectedIds.size === 0}
              className={`text-sm font-semibold px-3 py-1 rounded-lg transition-colors ${
                selectedIds.size > 0
                  ? "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              Tiếp ({selectedIds.size})
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className={`text-sm font-semibold px-3 py-1 rounded-lg transition-colors ${
                title.trim() && !creating
                  ? "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Tạo"
              )}
            </button>
          )}
        </div>

        {step === "select" ? (
          <>
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
                            src={thumbUrl}
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

                        {/* Archived badge */}
                        {story.isArchived && (
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
          </>
        ) : (
          /* Name step */
          <div className="p-6 space-y-6">
            {/* Preview of selected stories */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from(selectedIds).map((id) => {
                const story = stories.find((s) => s.id === id);
                if (!story) return null;
                const thumbUrl = getStoryThumbnail(story);
                return (
                  <div
                    key={id}
                    className="w-14 h-20 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-[#363636]"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (() => {
                        const { cleanText, bgClass } = parseStoryContent(story.text);
                        return (
                          <div className={`w-full h-full ${bgClass} flex items-center justify-center p-1`}>
                            {cleanText && (
                              <p className="text-white text-[6px] text-center line-clamp-3 leading-none scale-90">
                                {cleanText}
                              </p>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                );
              })}
            </div>

            {/* Title input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tên highlight
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Du lịch, Ăn uống, Kỷ niệm..."
                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#363636] rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-400/40 text-sm transition-all"
                maxLength={30}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) {
                    handleCreate();
                  }
                }}
              />
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {title.length}/30 ký tự
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
