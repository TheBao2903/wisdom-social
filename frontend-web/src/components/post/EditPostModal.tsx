import { useState, useRef, useEffect } from "react";
import {
  X,
  ImagePlus,
  MapPin,
  Users,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Play,
  Plus,
  Smile,
  Settings2,
  Maximize2
} from "lucide-react";
import * as postApi from "../../services/postService";
import { useAuth } from "../../contexts/AuthContext";
import { buildS3Url } from "../../utils/s3";
import type { NoteMusic } from "../../types/note";
import {
  enforceVideoAudioState,
  getVideoAudioState,
} from "../../utils/postVideoAudio";
import FriendSelectorModal from "./FriendSelectorModal";
import IconModal from "../icon-modal/IconModal";
import { Theme } from "emoji-picker-react";
import NoteMusicPicker from "../profile/note-modal/NoteMusicPicker";
import { 
  playAudioPreview, 
  stopAudioPreview, 
  subscribeToPlayback, 
  type MusicMetadata 
} from "../../services/musicService";

interface MediaItem {
  url: string;
  type?: string;
  order?: number;
}

interface UserData {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string;
}

interface PostData {
  id: string;
  authorId?: string;
  content?: string;
  caption?: string;
  privacy?: string;
  media?: MediaItem[];
  images?: string[];
  mediaList?: MediaItem[];
  location?:
    | string
    | { name: string; address?: string; latitude?: number; longitude?: number };
  taggedUserIds?: string[];
  allowComments?: boolean;
  allowShares?: boolean;
  music?: NoteMusic;
}

interface EditPostModalProps {
  postId: string;
  post: PostData;
  taggedUsers: UserData[];
  onClose: () => void;
  onSaved: (updatedPost: PostData) => void;
}

const PRIVACY_OPTIONS = [
  { value: "PUBLIC", label: "Công khai", Icon: Globe, desc: "Anyone can see" },
  {
    value: "FRIENDS",
    label: "Bạn bè",
    Icon: Users,
    desc: "Your friends only",
  },
  { value: "ONLY_ME", label: "Chỉ mình tôi", Icon: Lock, desc: "Just you" },
  {
    value: "SPECIFIC",
    label: "Bạn bè cụ thể...",
    Icon: UserCheck,
    desc: "Choose people",
  },
  {
    value: "EXCEPT",
    label: "Bạn bè ngoại trừ...",
    Icon: Users,
    desc: "Friends except...",
  },
];

export default function EditPostModal({
  postId,
  post,
  taggedUsers: initialTaggedUsers,
  onClose,
  onSaved,
}: EditPostModalProps) {
  const { currentUser } = useAuth();

  // Edit state — pre-filled from post
  const [editContent, setEditContent] = useState(
    post.caption || post.content || ""
  );
  const [editPrivacy, setEditPrivacy] = useState(post.privacy || "PUBLIC");
  const [editLocation, setEditLocation] = useState(
    typeof post.location === "string"
      ? post.location
      : post.location?.name || ""
  );
  const [editExistingMedia, setEditExistingMedia] = useState<MediaItem[]>(
    (post.media || post.images || post.mediaList || []).map((item: any) => ({
      url: typeof item === "string" ? item : item.url,
      type: item.type,
      order: item.order,
    }))
  );
  const [newImages, setNewImages] = useState<File[]>([]);
  const [editTaggedUsers, setEditTaggedUsers] = useState<UserData[]>(
    initialTaggedUsers || []
  );
  const [showTagModal, setShowTagModal] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [editAllowComments, setEditAllowComments] = useState(
    post.allowComments !== false
  );
  const [editAllowShares, setEditAllowShares] = useState(
    post.allowShares !== false
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showLocationInput, setShowLocationInput] = useState(!!editLocation);

  // Music state
  const [selectedMusic, setSelectedMusic] = useState<MusicMetadata | null>(
    post.music ? {
      id: post.music.trackId || "",
      title: post.music.title,
      artist: post.music.artist,
      imageUrl: post.music.thumbnail || post.music.coverUrl || "",
      audioUrl: post.music.audioUrl,
      duration: post.music.duration || 0,
      createdAt: ""
    } : null
  );
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  // Sync with global playback state
  useEffect(() => {
    return subscribeToPlayback((url) => {
      setPlayingUrl(url);
    });
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudioPreview();
    };
  }, []);

  const togglePreview = (url: string) => {
    if (!url) return;
    if (playingUrl === url) {
      stopAudioPreview();
      setPlayingUrl(null);
    } else {
      stopAudioPreview();
      playAudioPreview(url, {
        onEnded: () => setPlayingUrl(null),
      });
      setPlayingUrl(url);
    }
  };

  // ── Dirty-check: compare current state against the original post values ──
  const originalLocation =
    typeof post.location === "string"
      ? post.location
      : post.location?.name || "";
  const originalMediaCount = (post.media || post.mediaList || []).length;
  const originalTaggedIds = (initialTaggedUsers || [])
    .map((u) => u.id)
    .sort()
    .join(",");

  // Refs for DOM behaviors
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const privacyMenuRef = useRef<HTMLDivElement>(null);

  // Search location suggestions with debounce
  useEffect(() => {
    const searchLocations = async () => {
      if (!editLocation || editLocation.length < 3) {
        setLocationSuggestions([]);
        return;
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            editLocation
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              "User-Agent": "WisdomSocial/1.0",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setLocationSuggestions(data);
        }
      } catch (error) {
        console.error("Error fetching locations:", error);
        setLocationSuggestions([]);
      }
    };

    const timeoutId = setTimeout(searchLocations, 500);
    return () => clearTimeout(timeoutId);
  }, [editLocation]);

  // Privacy menu click-outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        privacyMenuRef.current &&
        !privacyMenuRef.current.contains(event.target as Node)
      ) {
        setShowPrivacyMenu(false);
      }
    };

    if (showPrivacyMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPrivacyMenu]);

  // Sync form fields when post prop changes
  useEffect(() => {
    const syncedContent = post.caption || post.content || "";
    const syncedPrivacy = post.privacy || "PUBLIC";
    const syncedLocation =
      typeof post.location === "string"
        ? post.location
        : post.location?.name || "";

    setEditContent(syncedContent);
    setEditPrivacy(syncedPrivacy);
    setEditLocation(syncedLocation);
    setEditAllowComments(post.allowComments !== false);
    setEditAllowShares(post.allowShares !== false);
    setEditExistingMedia(
      (post.media || post.images || post.mediaList || []).map((item: any) => ({
        url: typeof item === "string" ? item : item.url,
        type: item.type,
        order: item.order,
      }))
    );
  }, [
    post.id,
    post.caption,
    post.content,
    post.privacy,
    post.location,
    post.media,
    post.images,
    post.mediaList,
    post.allowComments,
    post.allowShares,
  ]);

  const isDirty =
    editContent !== (post.caption || post.content || "") ||
    editPrivacy !== (post.privacy || "PUBLIC") ||
    editLocation !== originalLocation ||
    editAllowComments !== (post.allowComments !== false) ||
    editAllowShares !== (post.allowShares !== false) ||
    newImages.length > 0 ||
    editExistingMedia.length !== originalMediaCount ||
    (editTaggedUsers || [])
      .map((u) => u.id)
      .sort()
      .join(",") !== originalTaggedIds ||
    (selectedMusic?.id !== post.music?.trackId);

  const hasAnyMedia = editExistingMedia.length > 0 || newImages.length > 0;
  const canSave = isDirty && (editContent.trim().length > 0 || hasAnyMedia);

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const resolveMediaUrl = (rawUrl: string) => {
    if (!rawUrl) return "";
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (rawUrl.includes("/")) return buildS3Url(rawUrl) || rawUrl;
    if (post.authorId) {
      const key = `posts/${post.authorId}/images/${rawUrl}`;
      return buildS3Url(key) || rawUrl;
    }
    return buildS3Url(rawUrl) || rawUrl;
  };

  // Image viewer state — combines existing + new file previews
  const allImages: {
    url: string;
    isNew: boolean;
    idx: number;
    isVideo: boolean;
  }[] = [
    ...editExistingMedia.map((m, i) => ({
      url: resolveMediaUrl(m.url),
      isNew: false,
      idx: i,
      isVideo: postApi.isVideoMedia(m.url, m.type),
    })),
    ...newImages.map((f, i) => ({
      url: URL.createObjectURL(f),
      isNew: true,
      idx: i,
      isVideo: f.type.startsWith("video/"),
    })),
  ];
  const [viewIdx, setViewIdx] = useState(0);
  const safeViewIdx = Math.min(viewIdx, Math.max(0, allImages.length - 1));

  const removeImage = (isNew: boolean, idx: number) => {
    if (isNew) {
      setNewImages((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setEditExistingMedia((prev) => prev.filter((_, i) => i !== idx));
    }
    setViewIdx(0);
  };

  const handleSave = async () => {
    if (!canSave || !currentUser?.id) return;
    try {
      setIsUpdating(true);
      const postData = {
        content: editContent.trim(),
        privacy: editPrivacy,
        location: editLocation || null,
        taggedUserIds: (editTaggedUsers || []).map((u) => u.id.toString()),
        existingMediaUrls: editExistingMedia.map((m) => m.url),
        allowComments: editAllowComments,
        allowShares: editAllowShares,
        music: selectedMusic ? {
          trackId: selectedMusic.id,
          title: selectedMusic.title,
          artist: selectedMusic.artist,
          thumbnail: selectedMusic.imageUrl,
          audioUrl: selectedMusic.audioUrl,
          duration: selectedMusic.duration
        } : null
      };

      const updatedPost = await postApi.updatePost(
        currentUser.id,
        postId,
        postData,
        newImages
      );

      onSaved(updatedPost);
      onClose();
    } catch (error: any) {
      console.error("❌ Error updating post:", error);
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update post";
      alert(errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setEditContent((prev) => prev + emoji);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="relative bg-white dark:bg-[#262626] rounded-xl max-w-5xl w-full max-h-[92vh] flex flex-col md:flex-row overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Mobile Only or as top bar */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b dark:border-[#363636] shrink-0">
          <button onClick={handleClose} className="text-sm font-semibold dark:text-white">Hủy</button>
          <h2 className="text-base font-semibold dark:text-white">Chỉnh sửa bài viết</h2>
          <button
            onClick={handleSave}
            disabled={isUpdating || !canSave}
            className={`text-sm font-semibold ${canSave && !isUpdating ? "text-[#3b5998]" : "text-gray-400"}`}
          >
            {isUpdating ? "Đang lưu..." : "Lưu"}
          </button>
        </div>

        {/* ── LEFT: image panel ── */}
        <div className="w-full md:w-[55%] bg-black flex flex-col relative group">
          <div className="flex-1 relative flex items-center justify-center min-h-[300px] md:min-h-0 bg-black">
            {allImages.length > 0 ? (
              <>
                <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden">
                  {allImages[safeViewIdx].isVideo ? (
                    <video
                      src={allImages[safeViewIdx].url}
                      className="w-full h-full object-contain"
                      muted={getVideoAudioState(selectedMusic || post.music).shouldMuteOriginal}
                      controls={!getVideoAudioState(selectedMusic || post.music).locked}
                      onLoadedMetadata={(e) => {
                        enforceVideoAudioState(
                          e.currentTarget,
                          getVideoAudioState(selectedMusic || post.music)
                        );
                      }}
                      onVolumeChange={(e) => {
                        enforceVideoAudioState(
                          e.currentTarget,
                          getVideoAudioState(selectedMusic || post.music)
                        );
                      }}
                      onPlay={(e) => {
                        enforceVideoAudioState(
                          e.currentTarget,
                          getVideoAudioState(selectedMusic || post.music)
                        );
                      }}
                    />
                  ) : (
                    <img
                      src={allImages[safeViewIdx].url}
                      alt="Post"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                
                {/* Remove current image */}
                <button
                  onClick={() => removeImage(allImages[safeViewIdx].isNew, allImages[safeViewIdx].idx)}
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors z-10"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Navigation arrows */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setViewIdx((p) => p === 0 ? allImages.length - 1 : p - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setViewIdx((p) => p === allImages.length - 1 ? 0 : p + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Maximize Icon Overlay */}
                <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-black/60 p-2 rounded-lg text-black dark:text-white shadow-sm">
                  <Maximize2 size={16} />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center flex-col gap-3 text-gray-500">
                <ImagePlus className="w-16 h-16" />
                <p className="text-sm">Chưa có ảnh/video nào</p>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {allImages.length > 0 && (
            <div className="px-2 py-3 border-t border-gray-800 flex gap-2 overflow-x-auto bg-[#1a1a1a]">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setViewIdx(idx)}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === safeViewIdx ? "border-blue-500" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  {img.isVideo ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">
                      <Play size={16} fill="currentColor" />
                    </div>
                  ) : (
                    <img src={img.url} className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
              <label className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer hover:border-gray-500 hover:bg-gray-800 transition-colors text-gray-500">
                <Plus size={20} />
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) {
                      setNewImages((prev) => [...prev, ...files]);
                      setViewIdx(allImages.length);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {/* ── RIGHT: edit form ── */}
        <div className="w-full md:w-[45%] flex flex-col min-h-0 bg-white dark:bg-[#262626]">
          {/* Header Desktop */}
          <div className="hidden md:flex items-center justify-between px-4 py-3 border-b dark:border-[#363636] shrink-0">
            <button onClick={handleClose} className="text-sm font-semibold hover:text-gray-600 dark:text-white dark:hover:text-gray-300">Hủy</button>
            <h2 className="text-base font-semibold dark:text-white">Chỉnh sửa bài viết</h2>
            <button
              onClick={handleSave}
              disabled={isUpdating || !canSave}
              className={`text-sm font-semibold transition-colors ${
                canSave && !isUpdating ? "text-[#3b5998] hover:text-[#2d4373]" : "text-gray-300 cursor-not-allowed"
              }`}
            >
              {isUpdating ? "Đang lưu..." : "Lưu"}
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-4">
              <img
                src={currentUser?.avatarUrl || "https://i.pravatar.cc/150?img=5"}
                alt={currentUser?.username}
                className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-800"
              />
              <div>
                <p className="text-sm font-semibold dark:text-white">
                  {currentUser?.name || currentUser?.username}
                </p>
                <p className="text-xs text-gray-500">Đang chỉnh sửa...</p>
              </div>
            </div>

            {/* Caption */}
            <div className="mb-4">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Viết chú thích..."
                className="w-full p-0 border-none outline-none resize-none bg-transparent dark:text-white placeholder-gray-400 text-sm min-h-[120px]"
                maxLength={2200}
              />
              <div className="flex justify-between items-center mt-2 border-b border-gray-100 dark:border-[#363636] pb-3">
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <Smile size={20} />
                  </button>
                  <IconModal
                    open={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiClick={(emojiData) => handleEmojiClick(emojiData.emoji)}
                    theme={document.documentElement.classList.contains("dark") ? Theme.DARK : Theme.LIGHT}
                    containerClassName="absolute top-8 left-0 z-50 shadow-xl rounded-xl"
                    pickerProps={{ height: 300, width: 280 }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-medium">{editContent.length}/2200</span>
              </div>
            </div>

            {/* Options List */}
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => setShowTagModal(true)}
                className="w-full flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 font-medium">
                  <Users size={20} className="text-gray-500" />
                  Gắn thẻ người dùng
                </div>
                <span className="text-gray-400">&rsaquo;</span>
              </button>
              {editTaggedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                  {editTaggedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                      <span>@{user.username}</span>
                      <button onClick={() => setEditTaggedUsers(prev => prev.filter(u => u.id !== user.id))} className="hover:text-blue-800 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowLocationInput(!showLocationInput)}
                className="w-full flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 font-medium">
                  <MapPin size={20} className="text-gray-500" />
                  Thêm vị trí
                </div>
                <span className="text-gray-400">&rsaquo;</span>
              </button>
              {showLocationInput && (
                <div className="relative px-2 pb-2">
                  <div className="flex items-center bg-gray-50 dark:bg-[#1a1a1a] rounded-lg px-3 py-2 border border-gray-200 dark:border-[#363636]">
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Tìm kiếm vị trí..."
                      className="flex-1 bg-transparent text-sm outline-none dark:text-white"
                    />
                    {editLocation && (
                      <button onClick={() => { setEditLocation(""); setLocationSuggestions([]); }} className="text-gray-400">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-2 right-2 mt-1 bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#363636] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {locationSuggestions.map((place: any) => (
                        <button
                          key={place.place_id}
                          onClick={() => { setEditLocation(place.display_name); setLocationSuggestions([]); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#363636] text-left border-b border-gray-100 dark:border-[#363636] last:border-0"
                        >
                          <MapPin size={16} className="text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium dark:text-white truncate">{place.name || place.display_name.split(",")[0]}</p>
                            <p className="text-[11px] text-gray-500 truncate">{place.display_name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Music Section */}
            <div className="mt-4 px-2">
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Âm thanh</p>
              <NoteMusicPicker
                selectedMusic={selectedMusic}
                playingUrl={playingUrl}
                onTogglePreview={togglePreview}
                onClearSelection={() => {
                  setSelectedMusic(null);
                  stopAudioPreview();
                  setPlayingUrl(null);
                }}
                onSelectMusic={(music) => {
                  setSelectedMusic(music);
                  stopAudioPreview();
                  setPlayingUrl(null);
                }}
              />
            </div>

            {/* Privacy Section */}
            <div className="mt-4 px-2">
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Quyền riêng tư</p>
              <div className="space-y-2">
                <button
                  onClick={() => { setEditPrivacy("PUBLIC"); setShowPrivacyMenu(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    editPrivacy === "PUBLIC" ? "border-[#3b5998] bg-blue-50/30 dark:bg-blue-900/10" : "border-gray-200 dark:border-[#363636]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Globe size={18} className={editPrivacy === "PUBLIC" ? "text-[#3b5998]" : "text-gray-500"} />
                    <span className={`text-sm font-medium ${editPrivacy === "PUBLIC" ? "text-[#3b5998] dark:text-blue-400" : "dark:text-white"}`}>Công khai</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editPrivacy === "PUBLIC" ? "border-[#3b5998]" : "border-gray-300"}`}>
                    {editPrivacy === "PUBLIC" && <div className="w-2 h-2 bg-[#3b5998] rounded-full" />}
                  </div>
                </button>
                
                <button
                  onClick={() => { setEditPrivacy("FRIENDS"); setShowPrivacyMenu(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    editPrivacy === "FRIENDS" ? "border-[#3b5998] bg-blue-50/30 dark:bg-blue-900/10" : "border-gray-200 dark:border-[#363636]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className={editPrivacy === "FRIENDS" ? "text-[#3b5998]" : "text-gray-500"} />
                    <span className={`text-sm font-medium ${editPrivacy === "FRIENDS" ? "text-[#3b5998] dark:text-blue-400" : "dark:text-white"}`}>Bạn bè</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editPrivacy === "FRIENDS" ? "border-[#3b5998]" : "border-gray-300"}`}>
                    {editPrivacy === "FRIENDS" && <div className="w-2 h-2 bg-[#3b5998] rounded-full" />}
                  </div>
                </button>

                <button
                  onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                  className="text-xs text-[#3b5998] hover:underline px-1 py-1 font-medium"
                >
                  {showPrivacyMenu ? "Thu gọn ▲" : "Tùy chọn khác ▼"}
                </button>

                {showPrivacyMenu && (
                  <div className="space-y-2 pt-1 pl-4 border-l-2 border-gray-100 dark:border-[#363636] ml-2">
                    {PRIVACY_OPTIONS.filter(o => !["PUBLIC", "FRIENDS"].includes(o.value)).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setEditPrivacy(opt.value); setShowPrivacyMenu(false); }}
                        className={`flex items-center gap-2 text-sm py-1.5 hover:text-[#3b5998] transition-colors ${
                          editPrivacy === opt.value ? "text-[#3b5998] font-medium" : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <opt.Icon size={16} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="mt-auto px-2 pt-6">
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="w-full flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors border-t border-gray-100 dark:border-[#363636]"
              >
                <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 font-medium">
                  <Settings2 size={18} className="text-gray-500" />
                  Cài đặt nâng cao
                </div>
                <span className={`text-gray-400 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`}>▼</span>
              </button>
              {showAdvancedSettings && (
                <div className="pt-3 pb-2 space-y-4 px-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cho phép bình luận</span>
                    <button onClick={() => setEditAllowComments(!editAllowComments)} className={`relative w-11 h-6 rounded-full transition-colors ${editAllowComments ? "bg-[#3b5998]" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${editAllowComments ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cho phép chia sẻ</span>
                    <button onClick={() => setEditAllowShares(!editAllowShares)} className={`relative w-11 h-6 rounded-full transition-colors ${editAllowShares ? "bg-[#3b5998]" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${editAllowShares ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discard changes dialog */}
      {showDiscardConfirm && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-[#262626] rounded-xl shadow-2xl w-[320px] overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <h3 className="text-base font-semibold dark:text-white mb-2">Hủy chỉnh sửa?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nếu bạn rời đi ngay bây giờ, các thay đổi sẽ bị mất.</p>
            </div>
            <div className="border-t dark:border-[#363636] flex">
              <button onClick={() => setShowDiscardConfirm(false)} className="flex-1 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">Tiếp tục chỉnh sửa</button>
              <button onClick={onClose} className="flex-1 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-l dark:border-[#363636]">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* Friend Selector Modal */}
      <FriendSelectorModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onConfirm={(_usernames, selectedFriends) => {
          const convertedUsers: UserData[] = selectedFriends.map((f) => ({
            id: Number(f.id),
            username: f.username,
            name: f.fullName,
            avatarUrl: f.avatar,
          }));
          setEditTaggedUsers(convertedUsers);
        }}
        title="Gắn thẻ bạn bè"
        description="Tìm kiếm bạn bè để gắn thẻ"
        initialSelected={editTaggedUsers.map((u) => u.username)}
      />
    </div>
  );
}
