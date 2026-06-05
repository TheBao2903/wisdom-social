import { useState, useEffect, useRef } from "react";
import {
  ImagePlus,
  MapPin,
  Smile,
  X,
  Users,
  Lock,
  Globe,
  UserCheck,
  Settings2,
  ArrowLeft,
  Music,
  Settings,
  VolumeX,
  Volume2,
  Maximize2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Theme } from "emoji-picker-react";
import { useAuth } from "../contexts/AuthContext";
import { createPost, createPagePost } from "../services/postService";
import pageService from "../services/pageService";
import FriendSelectorModal from "../components/post/FriendSelectorModal";
import IconModal from "../components/icon-modal/IconModal";
import NoteMusicPicker from "../components/profile/note-modal/NoteMusicPicker";
import {
  playAudioPreview,
  stopAudioPreview,
  subscribeToPlayback,
  type MusicMetadata,
} from "../services/musicService";

type PrivacyType =
  | "PUBLIC"
  | "FRIENDS"
  | "ONLY_ME"
  | "SPECIFIC"
  | "EXCEPT";

export default function CreatePost() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  // Page mode: when rendered under /pages/:pageId/create-post the post is
  // submitted to the page (with approval flow) instead of the user's wall.
  const { pageId } = useParams();
  const numericPageId = pageId ? Number(pageId) : null;
  const isPageMode = !!numericPageId && Number.isFinite(numericPageId);
  const [pageName, setPageName] = useState("");
  const [step, setStep] = useState(1);
  const [caption, setCaption] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [location, setLocation] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacyType>("PUBLIC");
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowShares, setAllowShares] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [specificViewers, setSpecificViewers] = useState<string[]>([]);
  const [excludedUsers, setExcludedUsers] = useState<string[]>([]);
  const [showSpecificModal, setShowSpecificModal] = useState(false);
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Video/Audio settings state
  const [muteOriginal, setMuteOriginal] = useState(false);
  const [musicVolume, setMusicVolume] = useState(75);
  const [selectedMusic, setSelectedMusic] = useState<MusicMetadata | null>(
    null
  );
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [isVideo2Playing, setIsVideo2Playing] = useState(false);
  const [isVideo3Playing, setIsVideo3Playing] = useState(false);
  const [finalPreviewIndex, setFinalPreviewIndex] = useState(0);

  const videoRef2 = useRef<HTMLVideoElement>(null);
  const videoRef3 = useRef<HTMLVideoElement>(null);

  const enforceLockedMute = (video: HTMLVideoElement | null) => {
    if (!video || !muteOriginal) return;
    video.muted = true;
    video.volume = 0;
  };

  const handleToggleMuteOriginal = () => {
    setMuteOriginal((prev) => !prev);
  };

  const handleVideoAudioGuard = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    enforceLockedMute(e.currentTarget);
  };

  const toggleVideoPlayback = (
    videoRef: React.RefObject<HTMLVideoElement | null>
  ) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  // Load page name for the header when posting to a page
  useEffect(() => {
    if (!numericPageId) return;
    let cancelled = false;
    pageService
      .getPageById(numericPageId)
      .then((p) => {
        if (!cancelled) setPageName(p?.name || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [numericPageId]);

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


  useEffect(() => {
    if (!muteOriginal) return;
    enforceLockedMute(videoRef2.current);
    enforceLockedMute(videoRef3.current);
  }, [muteOriginal, step, imagePreviewUrls]);

  useEffect(() => {
    setFinalPreviewIndex((current) =>
      Math.min(current, Math.max(0, selectedImages.length - 1))
    );
    setIsVideo3Playing(false);
  }, [selectedImages.length]);

  // Search location suggestions with debounce
  useEffect(() => {
    const searchLocations = async () => {
      if (location.length < 3) {
        setLocationSuggestions([]);
        return;
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            location
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
  }, [location]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      processFiles(files);
    }
    e.target.value = "";
  };

  const processFiles = (files: FileList) => {
    const newFiles: File[] = [];
    const newPreviewUrls: string[] = [];
    let videoCount = selectedImages.filter((f) =>
      f.type.startsWith("video/")
    ).length;
    let hasError = false;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`Ảnh ${file.name} vượt quá giới hạn 10MB.`);
          hasError = true;
          return;
        }
      } else if (file.type.startsWith("video/")) {
        if (file.size > 100 * 1024 * 1024) {
          alert(`Video ${file.name} vượt quá giới hạn 100MB.`);
          hasError = true;
          return;
        }
        if (videoCount >= 2) {
          alert(`Bạn chỉ có thể tải lên tối đa 2 video.`);
          hasError = true;
          return;
        }
        videoCount++;
      } else {
        return;
      }

      if (selectedImages.length + newFiles.length >= 10) {
        if (!hasError) {
          alert("Bạn chỉ có thể tải lên tối đa 10 media.");
          hasError = true;
        }
        return;
      }

      newFiles.push(file);
      newPreviewUrls.push(URL.createObjectURL(file));
    });

    if (newFiles.length > 0) {
      setSelectedImages((prev) => [...prev, ...newFiles]);
      setImagePreviewUrls((prev) => [...prev, ...newPreviewUrls]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreviewUrls(imagePreviewUrls.filter((_, i) => i !== index));
    if (selectedImages.length === 1) {
      setStep(1); // Go back if no images left
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTaggedUsers(taggedUsers.filter((t) => t !== tag));
  };

  const handleEmojiClick = (emoji: string) => {
    setCaption((prev) => prev + emoji);
  };

  const handlePost = async () => {
    try {
      if (!currentUser?.id) {
        alert("Please login to create post");
        return;
      }

      if (isLoading) return;
      setIsLoading(true);

      // Page posts inherit the page's visibility, so per-post privacy /
      // specific-viewer settings don't apply — always submit as PUBLIC.
      const effectivePrivacy = isPageMode ? "PUBLIC" : privacy;

      const postData = {
        content: caption,
        privacy: effectivePrivacy,
        location: location || null,
        taggedUsernames: taggedUsers,
        specificViewerUsernames:
          effectivePrivacy === "SPECIFIC" ? specificViewers : [],
        excludedUsernames:
          effectivePrivacy === "EXCEPT" ? excludedUsers : [],
        allowComments: allowComments,
        allowShares: allowShares,
        music: selectedMusic
          ? {
              trackId: selectedMusic.id,
              title: selectedMusic.title,
              artist: selectedMusic.artist,
              thumbnail: selectedMusic.imageUrl,
              audioUrl: selectedMusic.audioUrl,
              duration: selectedMusic.duration,
              muteOriginal,
              originalVolume: muteOriginal ? 0 : 100,
              musicVolume,
            }
          : null,
      };

      if (isPageMode && numericPageId) {
        await createPagePost(numericPageId, postData, selectedImages);
        navigate(`/pages/${numericPageId}`, {
          state: { pagePostCreated: true },
        });
        return;
      }

      console.log("Creating post...", {
        ...postData,
        muteOriginal,
        musicVolume,
      });

      const newPost = await createPost(
        currentUser.id,
        postData,
        selectedImages
      );

      const createdPostId = String(
        newPost?.id ?? (newPost as any)?._id ?? ""
      ).trim();

      alert("Bài viết đã được tạo thành công!");
      if (createdPostId) {
        sessionStorage.setItem("homeBoostPostId", createdPostId);
      }
      navigate("/", { state: { boostPostId: createdPostId || undefined } });
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#363636] shadow-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#363636] bg-white dark:bg-[#262626] z-20">
            {step === 1 ? (
              <button
                onClick={() => navigate(-1)}
                className="text-sm font-semibold hover:text-gray-600 dark:text-white dark:hover:text-gray-300"
              >
                Hủy
              </button>
            ) : (
              <button
                onClick={() => {
                  if (step === 3 && selectedImages.length === 0) {
                    setStep(1);
                  } else if (step === 3 && !selectedImages.some(f => f.type.startsWith('video/'))) {
                    setStep(1);
                  } else {
                    setStep(step - 1);
                  }
                }}
                className="text-sm font-semibold hover:text-gray-600 dark:text-white dark:hover:text-gray-300 flex items-center"
              >
                <ArrowLeft size={20} className="mr-1" />
              </button>
            )}

            <h2 className="text-base font-semibold dark:text-white flex items-center gap-2">
              {step === 1 && "Tạo bài viết mới"}
              {step === 2 && "Chỉnh sửa video"}
              {step === 3 && "Tạo bài viết mới"}
              {step === 2 && (
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">
                  Bước 2/3
                </span>
              )}
            </h2>

            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !selectedImages.some(f => f.type.startsWith('video/'))) {
                    setStep(3);
                  } else {
                    setStep(step + 1);
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors bg-[#3b5998] hover:bg-[#2d4373] text-white"
              >
                Tiếp tục
              </button>
            ) : (
              <button
                onClick={handlePost}
                disabled={
                  (!caption.trim() && selectedImages.length === 0) || isLoading
                }
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  (!caption.trim() && selectedImages.length === 0) || isLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-[#363636] dark:text-gray-600"
                    : "bg-[#3b5998] hover:bg-[#2d4373] text-white"
                }`}
              >
                {isLoading ? "Đang chia sẻ..." : "Chia sẻ"}
              </button>
            )}
          </div>

          <div className="p-0 sm:p-4">
            {/* Step 1: Media Selection */}
            {step === 1 && (
              <div className="flex flex-col items-center justify-center min-h-[500px]">
                {selectedImages.length === 0 ? (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-gray-300 dark:border-[#363636] rounded-xl p-12 text-center w-full max-w-lg mx-auto hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-gray-50 dark:bg-[#1a1a1a]"
                  >
                    <ImagePlus
                      size={64}
                      className="text-gray-400 dark:text-gray-500 mb-4 mx-auto"
                    />
                    <p className="text-xl font-medium mb-2 dark:text-white">
                      Thêm ảnh và video
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Kéo thả hoặc nhấn vào nút bên dưới để tải lên.
                      <br />
                      <span className="text-xs mt-1 block">
                        Tối đa 10 file (Ảnh &lt; 10MB, Video &lt; 100MB, tối đa
                        2 video)
                      </span>
                    </p>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <label
                      htmlFor="image-upload"
                      className="inline-block px-6 py-2.5 bg-[#3b5998] hover:bg-[#2d4373] text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                    >
                      Chọn từ thiết bị
                    </label>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1 overflow-y-auto min-h-[400px] p-2">
                      {imagePreviewUrls.map((imgUrl, index) => (
                        <div
                          key={index}
                          className="relative aspect-square bg-black rounded-lg overflow-hidden group"
                        >
                          {selectedImages[index]?.type?.startsWith("video/") ? (
                            <video
                              src={imgUrl}
                              className="w-full h-full object-cover"
                              controls
                            />
                          ) : (
                            <img
                              src={imgUrl}
                              alt={`Selected ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {selectedImages.length < 10 && (
                        <label
                          htmlFor="image-upload-more"
                          className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 dark:border-[#363636] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                        >
                          <ImagePlus
                            size={24}
                            className="text-gray-400 dark:text-gray-500 mb-2"
                          />
                          <span className="text-sm text-gray-500 font-medium">
                            Thêm nữa
                          </span>
                          <input
                            id="image-upload-more"
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            className="hidden"
                            onChange={handleImageSelect}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Media Editing */}
            {step === 2 && (
              <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
                {/* Left Side: Preview */}
                <div className="w-full md:w-[60%] bg-black rounded-xl flex items-center justify-center overflow-hidden relative shadow-inner">
                  <div className="absolute top-4 left-4 bg-black/60 text-white/90 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 z-10 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>{" "}
                    PREVIEW
                  </div>
                  {selectedImages[0]?.type.startsWith("video/") ? (
                    <>
                      <video
                        ref={videoRef2}
                        src={imagePreviewUrls[0]}
                        className="w-full h-full object-contain"
                        controls={!muteOriginal}
                        muted={muteOriginal}
                        onLoadedMetadata={handleVideoAudioGuard}
                        onVolumeChange={handleVideoAudioGuard}
                        onPlay={() => setIsVideo2Playing(true)}
                        onPause={() => setIsVideo2Playing(false)}
                      />
                      {muteOriginal && (
                        <button
                          type="button"
                          onClick={() => toggleVideoPlayback(videoRef2)}
                          className="absolute bottom-16 left-4 bg-black/70 text-white p-2 rounded-lg backdrop-blur-sm"
                          aria-label={isVideo2Playing ? "Pause video" : "Play video"}
                        >
                          {isVideo2Playing ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                      )}
                    </>
                  ) : (
                    <img
                      src={imagePreviewUrls[0]}
                      className="w-full h-full object-contain"
                    />
                  )}
                  {/* Timeline mock at bottom */}
                  <div className="absolute bottom-4 left-4 right-4 h-8 bg-white/10 rounded flex gap-0.5 p-0.5 backdrop-blur-md">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className={`h-full flex-1 rounded-sm ${
                          i === 2 ? "bg-blue-400/60" : "bg-white/30"
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Settings */}
                <div className="w-full md:w-[40%] flex flex-col gap-4 overflow-y-auto">
                  {/* Âm thanh */}
                  <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#363636] rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-4 dark:text-white">
                      <Music size={16} className="text-[#3b5998]" /> Âm thanh
                    </h3>

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

                  {/* Cài đặt âm thanh */}
                  <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#363636] rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-5 dark:text-white">
                      <Settings size={16} className="text-[#3b5998]" /> Cài đặt
                      âm thanh
                    </h3>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-sm font-medium dark:text-white">
                        Tắt tiếng video gốc
                      </span>
                      <button
                        onClick={handleToggleMuteOriginal}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          muteOriginal
                            ? "bg-[#3b5998]"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                            muteOriginal ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-3">
                        <span className="font-medium dark:text-white">
                          Âm lượng nhạc nền
                        </span>
                        <span className="text-[#3b5998] font-bold">
                          {musicVolume}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <VolumeX size={16} className="text-gray-400" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={musicVolume}
                          onChange={(e) =>
                            setMusicVolume(Number(e.target.value))
                          }
                          className="flex-1 h-1.5 bg-gray-200 dark:bg-[#363636] rounded-lg appearance-none cursor-pointer accent-[#3b5998]"
                        />
                        <Volume2 size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Info Cards */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-[#363636]">
                      <p className="text-[11px] text-gray-500 mb-0.5 uppercase tracking-wide font-medium">
                        Chế độ xuất video
                      </p>
                      <p className="text-sm font-semibold dark:text-white">
                        Full HD (1080p)
                      </p>
                    </div>
                    <div className="flex-1 bg-green-100/40 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-900/30">
                      <p className="text-[11px] text-green-700 dark:text-green-500 mb-0.5 uppercase tracking-wide font-medium">
                        Thời lượng gợi ý
                      </p>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                        00:30 Giây
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Post Details */}
            {step === 3 && (
              <div className="flex flex-col md:flex-row gap-6 p-2 md:p-0 min-h-[500px]">
                {/* Mini Preview Left - only show when there are images */}
                {selectedImages.length > 0 && (
                <div className="w-full md:w-1/2">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/5] shadow-sm">
                    {selectedImages[finalPreviewIndex]?.type.startsWith("video/") ? (
                      <>
                        <video
                          key={imagePreviewUrls[finalPreviewIndex]}
                          ref={videoRef3}
                          src={imagePreviewUrls[finalPreviewIndex]}
                          className="w-full h-full object-cover"
                          controls={!muteOriginal}
                          muted={muteOriginal}
                          onLoadedMetadata={handleVideoAudioGuard}
                          onVolumeChange={handleVideoAudioGuard}
                          onPlay={() => setIsVideo3Playing(true)}
                          onPause={() => setIsVideo3Playing(false)}
                        />
                        {muteOriginal && (
                          <button
                            type="button"
                            onClick={() => toggleVideoPlayback(videoRef3)}
                            className="absolute bottom-3 right-3 bg-black/70 text-white p-2 rounded-lg backdrop-blur-sm"
                            aria-label={isVideo3Playing ? "Pause video" : "Play video"}
                          >
                            {isVideo3Playing ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                        )}
                      </>
                    ) : (
                      <img
                        src={imagePreviewUrls[finalPreviewIndex]}
                        alt={`Xem trước media ${finalPreviewIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button className="absolute bottom-3 left-3 bg-white/90 dark:bg-black/60 p-2 rounded-lg text-black dark:text-white shadow-sm hover:bg-white transition-colors">
                      <Maximize2 size={16} />
                    </button>
                    {selectedImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setFinalPreviewIndex((current) =>
                              current === 0 ? selectedImages.length - 1 : current - 1
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm hover:bg-black/80"
                          aria-label="Media trước"
                        >
                          <ChevronLeft size={22} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFinalPreviewIndex((current) =>
                              current === selectedImages.length - 1 ? 0 : current + 1
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm hover:bg-black/80"
                          aria-label="Media tiếp theo"
                        >
                          <ChevronRight size={22} />
                        </button>
                        <div className="absolute top-3 right-3 bg-black/60 px-2 py-1 rounded text-white text-xs font-semibold backdrop-blur-sm">
                          {finalPreviewIndex + 1}/{selectedImages.length}
                        </div>
                        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                          {selectedImages.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setFinalPreviewIndex(index)}
                              className={`h-1.5 rounded-full transition-all ${
                                index === finalPreviewIndex
                                  ? "w-5 bg-white"
                                  : "w-1.5 bg-white/60 hover:bg-white/80"
                              }`}
                              aria-label={`Xem media ${index + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                )}

                {/* Form Right */}
                <div className={`w-full ${selectedImages.length > 0 ? 'md:w-1/2' : 'md:w-full'} flex flex-col pt-2`}>
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={
                        currentUser?.avatarUrl ||
                        "https://i.pravatar.cc/150?img=5"
                      }
                      alt={currentUser?.username || "User"}
                      className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-800"
                    />
                    <div>
                      <p className="text-sm font-semibold dark:text-white">
                        {currentUser?.name || currentUser?.username || "User"}
                      </p>
                      {isPageMode ? (
                        <p className="text-xs text-gray-500">
                          Đăng lên trang{" "}
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {pageName || "..."}
                          </span>
                          <span className="ml-1 text-yellow-600 dark:text-yellow-400">
                            · có thể cần được duyệt
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">Viết chú thích...</p>
                      )}
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="mb-4">
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Viết chú thích cho bài viết của bạn..."
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
                          onEmojiClick={(emojiData) =>
                            handleEmojiClick(emojiData.emoji)
                          }
                          theme={
                            document.documentElement.classList.contains("dark")
                              ? Theme.DARK
                              : Theme.LIGHT
                          }
                          containerClassName="absolute top-8 left-0 z-50 shadow-xl rounded-xl"
                          pickerProps={{ height: 350, width: 300 }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        {caption.length}/2200
                      </span>
                    </div>
                  </div>

                  {/* Music */}
                  <div className="mb-4 rounded-xl border border-gray-200 dark:border-[#363636] bg-gray-50/70 dark:bg-[#1a1a1a] p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                      <Music size={16} className="text-[#3b5998]" />
                      <span>Âm thanh</span>
                    </div>
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

                  {/* Options List */}
                  <div className="flex flex-col space-y-1">
                    {/* Tag People */}
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
                    {taggedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-2 pb-2">
                        {taggedUsers.map((tag) => (
                          <div
                            key={tag}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium"
                          >
                            <span>@{tag}</span>
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-blue-800 dark:hover:text-blue-200"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Location */}
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
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Tìm kiếm vị trí..."
                            className="flex-1 bg-transparent text-sm outline-none dark:text-white"
                          />
                          {location && (
                            <button
                              onClick={() => {
                                setLocation("");
                                setLocationSuggestions([]);
                              }}
                              className="text-gray-400"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        {locationSuggestions.length > 0 && (
                          <div className="absolute top-full left-2 right-2 mt-1 bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#363636] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {locationSuggestions.map((place: any) => (
                              <button
                                key={place.place_id}
                                onClick={() => {
                                  setLocation(place.display_name);
                                  setLocationSuggestions([]);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#363636] text-left border-b border-gray-100 dark:border-[#363636] last:border-0"
                              >
                                <MapPin
                                  size={16}
                                  className="text-gray-400 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium dark:text-white truncate">
                                    {place.name ||
                                      place.display_name.split(",")[0]}
                                  </p>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {place.display_name}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Privacy — not applicable to page posts */}
                  {!isPageMode && (
                  <div className="mt-4 px-2">
                    <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                      Quyền riêng tư
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setPrivacy("PUBLIC");
                          setShowPrivacyMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          privacy === "PUBLIC"
                            ? "border-[#3b5998] bg-blue-50/30 dark:bg-blue-900/10"
                            : "border-gray-200 dark:border-[#363636]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Globe
                            size={18}
                            className={
                              privacy === "PUBLIC"
                                ? "text-[#3b5998]"
                                : "text-gray-500"
                            }
                          />
                          <span
                            className={`text-sm font-medium ${
                              privacy === "PUBLIC"
                                ? "text-[#3b5998] dark:text-blue-400"
                                : "dark:text-white"
                            }`}
                          >
                            Công khai
                          </span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            privacy === "PUBLIC"
                              ? "border-[#3b5998]"
                              : "border-gray-300"
                          }`}
                        >
                          {privacy === "PUBLIC" && (
                            <div className="w-2 h-2 bg-[#3b5998] rounded-full" />
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setPrivacy("FRIENDS");
                          setShowPrivacyMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          privacy === "FRIENDS"
                            ? "border-[#3b5998] bg-blue-50/30 dark:bg-blue-900/10"
                            : "border-gray-200 dark:border-[#363636]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserCheck
                            size={18}
                            className={
                              privacy === "FRIENDS"
                                ? "text-[#3b5998]"
                                : "text-gray-500"
                            }
                          />
                          <span
                            className={`text-sm font-medium ${
                              privacy === "FRIENDS"
                                ? "text-[#3b5998] dark:text-blue-400"
                                : "dark:text-white"
                            }`}
                          >
                            Bạn bè
                          </span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            privacy === "FRIENDS"
                              ? "border-[#3b5998]"
                              : "border-gray-300"
                          }`}
                        >
                          {privacy === "FRIENDS" && (
                            <div className="w-2 h-2 bg-[#3b5998] rounded-full" />
                          )}
                        </div>
                      </button>

                      {/* More Privacy Options (Dropdown for less common ones) */}
                      <button
                        onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                        className="text-xs text-[#3b5998] hover:underline px-1 py-2 font-medium"
                      >
                        {showPrivacyMenu ? "Thu gọn ▲" : "Tùy chọn khác ▼"}
                      </button>

                      {showPrivacyMenu && (
                        <div className="space-y-2 pt-1 pl-4 border-l-2 border-gray-100 dark:border-[#363636] ml-2">
                          <button
                            onClick={() => {
                              setPrivacy("ONLY_ME");
                              setShowPrivacyMenu(false);
                            }}
                            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 py-1.5 hover:text-[#3b5998]"
                          >
                            <Lock size={16} /> Chỉ mình tôi
                          </button>
                          <button
                            onClick={() => {
                              setPrivacy("SPECIFIC");
                              setShowSpecificModal(true);
                            }}
                            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 py-1.5 hover:text-[#3b5998]"
                          >
                            <Users size={16} /> Bạn bè cụ thể...
                          </button>
                          <button
                            onClick={() => {
                              setPrivacy("EXCEPT");
                              setShowExcludedModal(true);
                            }}
                            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 py-1.5 hover:text-[#3b5998]"
                          >
                            <UserCheck size={16} /> Bạn bè ngoại trừ...
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Advanced Settings */}
                  <div className="mt-4 px-2 pb-4">
                    <button
                      onClick={() =>
                        setShowAdvancedSettings(!showAdvancedSettings)
                      }
                      className="w-full flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors border-t border-gray-100 dark:border-[#363636]"
                    >
                      <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 font-medium">
                        <Settings2 size={18} className="text-gray-500" />
                        Cài đặt nâng cao
                      </div>
                      <span
                        className={`text-gray-400 transition-transform ${
                          showAdvancedSettings ? "rotate-180" : ""
                        }`}
                      >
                        ▼
                      </span>
                    </button>
                    {showAdvancedSettings && (
                      <div className="pt-3 pb-2 space-y-4 px-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Cho phép bình luận
                          </span>
                          <button
                            onClick={() => setAllowComments(!allowComments)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              allowComments
                                ? "bg-[#3b5998]"
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                                allowComments
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Cho phép chia sẻ
                          </span>
                          <button
                            onClick={() => setAllowShares(!allowShares)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              allowShares
                                ? "bg-[#3b5998]"
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                                allowShares ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FriendSelectorModal
        isOpen={showSpecificModal}
        onClose={() => setShowSpecificModal(false)}
        onConfirm={(selected) => setSpecificViewers(selected)}
        title="Ai có thể xem bài viết này?"
        description="Chỉ những người bạn được chọn mới có thể xem"
        initialSelected={specificViewers}
      />
      <FriendSelectorModal
        isOpen={showExcludedModal}
        onClose={() => setShowExcludedModal(false)}
        onConfirm={(selected) => setExcludedUsers(selected)}
        title="Ẩn với"
        description="Những người bạn được chọn sẽ không thể xem"
        initialSelected={excludedUsers}
      />
      <FriendSelectorModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onConfirm={(selected) => setTaggedUsers(selected)}
        title="Gắn thẻ bạn bè"
        description="Tìm kiếm bạn bè để gắn thẻ"
        initialSelected={taggedUsers}
      />
    </div>
  );
}
