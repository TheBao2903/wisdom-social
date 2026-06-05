import { useRef, useEffect, useState } from "react";
import {
  ImagePlus,
  X,
  Globe,
  Lock,
  UserCheck,
  Users,
  ArrowLeft,
  Music,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { buildS3Url } from "../utils/s3";
import FriendSelectorModal from "../components/post/FriendSelectorModal";
import { stopAudioPreview } from "../services/musicService";
import StoryCanvas from "../components/story/StoryCanvas";
import StoryMusicPickerModal from "../components/story/StoryMusicPickerModal";
import { useStoryTextManager } from "../hooks/useStoryTextManager";
import { useStoryMusicSticker } from "../hooks/useStoryMusicSticker";
import { useStoryMedia } from "../hooks/useStoryMedia";
import { useStoryMediaDrag } from "../hooks/useStoryMediaDrag";
import { useStoryPrivacy } from "../hooks/useStoryPrivacy";
import { useStoryAdvancedSettings } from "../hooks/useStoryAdvancedSettings";
import { useStorySubmit } from "../hooks/useStorySubmit";

const BG_GRADIENTS = [
  "bg-gradient-to-br from-purple-600 via-pink-500 to-red-500",
  "bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400",
  "bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-300",
  "bg-gradient-to-br from-green-600 via-emerald-500 to-teal-400",
  "bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-400",
  "bg-gradient-to-br from-rose-500 via-red-400 to-orange-400",
  "bg-gradient-to-br from-slate-800 via-gray-700 to-zinc-600",
  "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600",
  "bg-gradient-to-br from-fuchsia-600 via-violet-500 to-indigo-400",
  "bg-gradient-to-br from-teal-600 via-emerald-400 to-lime-400",
];

export default function CreateStory() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const textManager = useStoryTextManager();
  const musicManager = useStoryMusicSticker();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Use custom hooks
  const media = useStoryMedia();
  const drag = useStoryMediaDrag(media.selectedMedia);
  const privacy = useStoryPrivacy();
  const settings = useStoryAdvancedSettings();
  const submit = useStorySubmit();

  const [videoMuted, setVideoMuted] = useState(false);

  // Audio cleanup
  useEffect(() => {
    return () => stopAudioPreview();
  }, []);

  // Attach wheel listener with passive: false for preventDefault
  useEffect(() => {
    const wheelHandler = (e: WheelEvent) => {
      if (!media.selectedMedia) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      drag.setMediaScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    };

    if (canvasRef.current) {
      canvasRef.current.addEventListener("wheel", wheelHandler, {
        passive: false,
      });
    }

    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener("wheel", wheelHandler);
      }
    };
  }, [media.selectedMedia, drag]);

  // Handle remove media - reset drag state
  const handleRemoveMedia = () => {
    media.handleRemoveMedia();
    // Reset drag state
    drag.handleResetMediaPosition();
    setVideoMuted(false);
  };

  const canSubmit =
    !submit.isSubmitting &&
    (textManager.layers.some((l) => l.text.trim()) ||
      media.selectedMedia !== null ||
      musicManager.sticker !== null);

  const handlePost = async () => {
    await submit.handlePost({
      textManager,
      musicManager,
      selectedMedia: media.selectedMedia,
      privacy: privacy.privacy,
      selectedBgIndex: media.selectedBgIndex,
      muteOriginal: videoMuted,
    });
  };

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/40 backdrop-blur-md border-b border-white/5 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Đóng</span>
        </button>

        <h2 className="text-white font-semibold text-sm tracking-wide">
          Tạo tin
        </h2>

        <button
          onClick={handlePost}
          disabled={!canSubmit}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
            canSubmit
              ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          {submit.isSubmitting ? "Đang chia sẻ..." : "Chia sẻ"}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-hidden group"
        >
          <StoryCanvas
            manager={textManager}
            musicManager={musicManager}
            backgroundUrl={media.mediaPreviewUrl || undefined}
            backgroundType={
              media.selectedMedia?.type.startsWith("video/") ? "video" : "image"
            }
            gradientClass={
              !media.selectedMedia
                ? BG_GRADIENTS[media.selectedBgIndex]
                : undefined
            }
            mediaOffsetX={drag.mediaPositionX}
            mediaOffsetY={drag.mediaPositionY}
            mediaScale={drag.mediaScale}
            onMediaMouseDown={drag.handleMediaMouseDown}
            onMediaTouchStart={drag.handleMediaTouchStart}
            videoMuted={videoMuted}
            onToggleMute={() => setVideoMuted((prev) => !prev)}
          />

          {/* Delete Media Button (Mobile Friendly) */}
          {media.selectedMedia && (
            <button
              onClick={handleRemoveMedia}
              className="absolute top-4 right-4 p-2.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full shadow-lg transition-all z-10 lg:hidden flex items-center justify-center"
              title="Xóa ảnh/video"
            >
              <X size={20} />
            </button>
          )}

          {/* Zoom Controls */}
          {media.selectedMedia && (
            <div className="absolute bottom-4 left-4 lg:left-auto lg:right-4 flex gap-2 bg-black/50 backdrop-blur-sm p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={drag.handleZoomOut}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="Thu nhỏ (-)20%"
              >
                <ZoomOut size={16} />
              </button>
              <div className="flex items-center justify-center px-2 text-xs text-white/70 min-w-[40px]">
                {Math.round(drag.mediaScale * 100)}%
              </div>
              <button
                onClick={drag.handleZoomIn}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="Phóng to (+)20%"
              >
                <ZoomIn size={16} />
              </button>
              <div className="w-px bg-white/10" />
              <button
                onClick={drag.handleResetMediaPosition}
                className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-xs font-medium"
                title="Đặt lại vị trí"
              >
                Reset
              </button>
            </div>
          )}

          {/* Drag Hint */}
          {media.selectedMedia && (
            <div className="absolute top-4 left-4 lg:top-auto lg:bottom-4 lg:left-4 text-xs text-white/40 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              Nhấn và kéo để di chuyển • Cuộn để phóng to/thu nhỏ
            </div>
          )}
        </div>

        {/* Right: Settings Sidebar */}
        {settings.showSidebar && (
          <div className="w-[320px] bg-[#0d0d0d] border-l border-white/5 flex flex-col overflow-hidden shrink-0 hidden lg:flex">
            <div
              className="flex-1 overflow-y-auto p-5 space-y-5"
              style={{ scrollbarGutter: "stable" }}
            >
              {/* User Info */}
              <div className="flex items-center gap-3">
                <img
                  src={
                    buildS3Url(currentUser?.avatarUrl || "") ||
                    "https://i.pravatar.cc/150?img=5"
                  }
                  alt={currentUser?.username || "User"}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10"
                />
                <div>
                  <p className="text-white text-sm font-semibold">
                    {currentUser?.fullName || currentUser?.username || "Bạn"}
                  </p>
                  <p className="text-white/40 text-[11px]">
                    @{currentUser?.username}
                  </p>
                </div>
              </div>

              {/* Background */}
              {!media.selectedMedia && (
                <div>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2.5">
                    Nền
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {BG_GRADIENTS.map((gradient, index) => (
                      <button
                        key={index}
                        onClick={() => media.setSelectedBgIndex(index)}
                        className={`w-8 h-8 rounded-full ${gradient} border-2 transition-all ${
                          media.selectedBgIndex === index
                            ? "border-blue-400 scale-110 shadow-lg shadow-blue-500/20"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Media */}
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2.5">
                  Ảnh / Video
                </p>
                {media.selectedMedia ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 min-w-0">
                      <ImagePlus size={14} className="shrink-0 text-white/40" />
                      <span className="text-white/60 text-xs truncate w-0">
                        {media.selectedMedia.name}
                      </span>
                    </div>
                    <button
                      onClick={handleRemoveMedia}
                      className="shrink-0 p-2 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => media.fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/15 hover:border-white/25 rounded-xl text-white/50 hover:text-white/70 text-xs font-medium transition-all"
                  >
                    <ImagePlus size={14} />
                    Tải lên ảnh hoặc video
                  </button>
                )}
              </div>

              {/* Video Settings (Mute Original) */}
              {media.selectedMedia?.type.startsWith("video/") && (
                <>
                  <div className="h-px bg-white/5" />
                  <div>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2.5">
                      Cài đặt video
                    </p>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] rounded-lg border border-white/5">
                      <span className="text-xs text-white/70 font-medium">Tắt tiếng video gốc</span>
                      <button
                        onClick={() => setVideoMuted((prev) => !prev)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          videoMuted ? "bg-blue-500" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                            videoMuted ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* Music */}
              <div>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Music size={11} /> Âm nhạc
                </p>
                {musicManager.sticker ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-end gap-[1px] h-3 shrink-0">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-[2px] bg-purple-400 rounded-full"
                            style={{
                              animation: `musicBar${i} 0.${
                                4 + i
                              }s ease-in-out infinite alternate`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-900 truncate">
                          {musicManager.sticker.music.title}
                        </p>
                        <p className="text-[9px] text-gray-400 truncate">
                          {musicManager.sticker.music.artist}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        musicManager.removeSticker();
                        stopAudioPreview();
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => settings.setShowMusicPicker(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-purple-400 rounded-xl text-gray-500 hover:text-purple-600 text-xs font-medium transition-all"
                  >
                    <Music size={14} />
                    Thêm nhạc vào story
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* Privacy */}
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2.5">
                  Quyền riêng tư
                </p>
                <div className="space-y-1.5">
                  {/* PUBLIC */}
                  <button
                    onClick={() => privacy.setPrivacy("PUBLIC")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                      privacy.privacy === "PUBLIC"
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe
                        size={15}
                        className={
                          privacy.privacy === "PUBLIC"
                            ? "text-blue-400"
                            : "text-white/40"
                        }
                      />
                      <span
                        className={`text-xs font-medium ${
                          privacy.privacy === "PUBLIC"
                            ? "text-blue-400"
                            : "text-white/70"
                        }`}
                      >
                        Công khai
                      </span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        privacy.privacy === "PUBLIC"
                          ? "border-blue-400"
                          : "border-white/20"
                      }`}
                    >
                      {privacy.privacy === "PUBLIC" && (
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      )}
                    </div>
                  </button>

                  {/* FRIENDS */}
                  <button
                    onClick={() => privacy.setPrivacy("FRIENDS")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                      privacy.privacy === "FRIENDS"
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck
                        size={15}
                        className={
                          privacy.privacy === "FRIENDS"
                            ? "text-blue-400"
                            : "text-white/40"
                        }
                      />
                      <span
                        className={`text-xs font-medium ${
                          privacy.privacy === "FRIENDS"
                            ? "text-blue-400"
                            : "text-white/70"
                        }`}
                      >
                        Bạn bè
                      </span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        privacy.privacy === "FRIENDS"
                          ? "border-blue-400"
                          : "border-white/20"
                      }`}
                    >
                      {privacy.privacy === "FRIENDS" && (
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      )}
                    </div>
                  </button>

                  {/* More options */}
                  <button
                    onClick={() =>
                      privacy.setShowPrivacyMenu(!privacy.showPrivacyMenu)
                    }
                    className="text-[10px] text-blue-400/70 hover:text-blue-400 px-1 py-1 font-medium transition-colors"
                  >
                    {privacy.showPrivacyMenu ? "Thu gọn ▲" : "Tùy chọn khác ▼"}
                  </button>

                  {privacy.showPrivacyMenu && (
                    <div className="space-y-1 pt-0.5 pl-3 border-l border-white/5 ml-1">
                      <button
                        onClick={() => {
                          privacy.setPrivacy("ONLY_ME");
                          privacy.setShowPrivacyMenu(false);
                        }}
                        className="flex items-center gap-2 text-[11px] text-white/50 py-1.5 hover:text-blue-400 transition-colors"
                      >
                        <Lock size={13} /> Chỉ mình tôi
                      </button>
                      <button
                        onClick={() => {
                          privacy.setPrivacy("SPECIFIC");
                          privacy.setShowSpecificModal(true);
                        }}
                        className="flex items-center gap-2 text-[11px] text-white/50 py-1.5 hover:text-blue-400 transition-colors"
                      >
                        <Users size={13} /> Bạn bè cụ thể...
                      </button>
                      <button
                        onClick={() => {
                          privacy.setPrivacy("EXCEPT");
                          privacy.setShowExcludedModal(true);
                        }}
                        className="flex items-center gap-2 text-[11px] text-white/50 py-1.5 hover:text-blue-400 transition-colors"
                      >
                        <UserCheck size={13} /> Bạn bè ngoại trừ...
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={media.fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={media.handleMediaSelect}
      />

      {/* Friend Selector Modals */}
      <FriendSelectorModal
        isOpen={privacy.showSpecificModal}
        onClose={() => privacy.setShowSpecificModal(false)}
        onConfirm={(selected) => privacy.setSpecificViewers(selected)}
        title="Ai có thể xem tin này?"
        description="Chỉ những người bạn được chọn mới có thể xem"
        initialSelected={privacy.specificViewers}
      />
      <FriendSelectorModal
        isOpen={privacy.showExcludedModal}
        onClose={() => privacy.setShowExcludedModal(false)}
        onConfirm={(selected) => privacy.setExcludedUsers(selected)}
        title="Ẩn với"
        description="Những người bạn được chọn sẽ không thể xem"
        initialSelected={privacy.excludedUsers}
      />

      {/* Music Picker Modal */}
      <StoryMusicPickerModal
        isOpen={settings.showMusicPicker}
        onClose={() => settings.setShowMusicPicker(false)}
        onSelect={(music) => {
          stopAudioPreview(); // Stop picker preview before sticker plays
          musicManager.addSticker(music);
          settings.setShowMusicPicker(false);
        }}
      />
    </div>
  );
}
