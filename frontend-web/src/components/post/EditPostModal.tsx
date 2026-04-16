import { useState } from "react";
import {
  X,
  ImageIcon,
  MapPin,
  Users,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import * as postApi from "../../services/postService";
import { useAuth } from "../../contexts/AuthContext";
import { buildS3Url } from "../../utils/s3";

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
  content: string;
  privacy?: string;
  media?: MediaItem[];
  mediaList?: MediaItem[];
  location?:
    | string
    | { name: string; address?: string; latitude?: number; longitude?: number };
  taggedUserIds?: string[];
}

interface EditPostModalProps {
  postId: string;
  post: PostData;
  taggedUsers: UserData[];
  onClose: () => void;
  onSaved: (updatedPost: PostData) => void;
}

const PRIVACY_OPTIONS = [
  { value: "PUBLIC", label: "Public", Icon: Globe },
  { value: "FRIENDS", label: "Friends", Icon: Users },
  { value: "PRIVATE", label: "Only me", Icon: Lock },
  { value: "SPECIFIC", label: "Specific people", Icon: UserCheck },
  { value: "EXCEPT", label: "Friends except", Icon: Users },
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
  const [editContent, setEditContent] = useState(post.content || "");
  const [editPrivacy, setEditPrivacy] = useState(post.privacy || "PUBLIC");
  const [editLocation, setEditLocation] = useState(
    typeof post.location === "string"
      ? post.location
      : post.location?.name || ""
  );
  const [editExistingMedia, setEditExistingMedia] = useState<MediaItem[]>(
    (post.media || post.mediaList || []) as MediaItem[]
  );
  const [newImages, setNewImages] = useState<File[]>([]);
  const [editTaggedUsers, setEditTaggedUsers] =
    useState<UserData[]>(initialTaggedUsers);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [tagSearchResults, setTagSearchResults] = useState<UserData[]>([]);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // ── Dirty-check: compare current state against the original post values ──
  const originalLocation =
    typeof post.location === "string"
      ? post.location
      : post.location?.name || "";
  const originalMediaCount = (post.media || post.mediaList || []).length;
  const originalTaggedIds = initialTaggedUsers
    .map((u) => u.id)
    .sort()
    .join(",");

  const isDirty =
    editContent !== (post.content || "") ||
    editPrivacy !== (post.privacy || "PUBLIC") ||
    editLocation !== originalLocation ||
    newImages.length > 0 ||
    editExistingMedia.length !== originalMediaCount ||
    editTaggedUsers
      .map((u) => u.id)
      .sort()
      .join(",") !== originalTaggedIds;

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // Image viewer state — combines existing + new file previews
  const allImages: { url: string; isNew: boolean; idx: number }[] = [
    ...editExistingMedia.map((m, i) => ({
      url: buildS3Url(m.url) || m.url,
      isNew: false,
      idx: i,
    })),
    ...newImages.map((f, i) => ({
      url: URL.createObjectURL(f),
      isNew: true,
      idx: i,
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
    if (!editContent.trim() || !currentUser?.id) return;
    try {
      setIsUpdating(true);
      const postData = {
        content: editContent.trim(),
        privacy: editPrivacy,
        location: editLocation || null,
        taggedUserIds: editTaggedUsers.map((u) => u.id.toString()),
        existingMediaUrls: editExistingMedia.map((m) => m.url),
      };

      console.log("📤 Saving post with data:", {
        postId,
        userId: currentUser.id,
        postData,
        newImagesCount: newImages.length,
      });

      const updatedPost = await postApi.updatePost(
        currentUser.id,
        postId,
        postData,
        newImages
      );

      console.log("✅ Post saved successfully:", updatedPost);
      onSaved(updatedPost);
      onClose();
    } catch (error: any) {
      console.error("❌ Error updating post:", error);
      console.error(
        "Full error response:",
        JSON.stringify(error?.response?.data, null, 2)
      );
      console.error(
        "Error message:",
        error?.response?.data?.message || error?.message
      );
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update post";
      alert(errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedPrivacyOption =
    PRIVACY_OPTIONS.find((o) => o.value === editPrivacy) || PRIVACY_OPTIONS[0];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute right-8 top-8 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div
        className="relative bg-white dark:bg-gray-900 rounded-xl max-w-5xl w-full max-h-[92vh] flex overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── LEFT: image panel ── */}
        <div className="w-[55%] bg-black flex flex-col">
          {/* Image viewer */}
          <div className="flex-1 relative flex items-center justify-center min-h-0 group">
            {allImages.length > 0 ? (
              <>
                <img
                  src={allImages[safeViewIdx].url}
                  alt="Post"
                  className="max-h-full max-w-full object-contain"
                />
                {/* Remove current image */}
                <button
                  onClick={() =>
                    removeImage(
                      allImages[safeViewIdx].isNew,
                      allImages[safeViewIdx].idx
                    )
                  }
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                  title="Remove this photo"
                >
                  <X className="w-4 h-4" />
                </button>
                {/* Navigation */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setViewIdx((p) =>
                          p === 0 ? allImages.length - 1 : p - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() =>
                        setViewIdx((p) =>
                          p === allImages.length - 1 ? 0 : p + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight size={20} />
                    </button>
                    {/* Dot indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                      {allImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setViewIdx(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            i === safeViewIdx
                              ? "bg-white"
                              : "bg-white/40 hover:bg-white/70"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <ImageIcon className="w-16 h-16" />
                <p className="text-sm">No photos</p>
              </div>
            )}
          </div>

          {/* Add photos button */}
          <label className="flex items-center justify-center gap-2 py-3 border-t border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors text-gray-300 text-sm shrink-0">
            <ImageIcon className="w-4 h-4" />
            <span>Add photos</span>
            <input
              type="file"
              accept="image/*"
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

        {/* ── RIGHT: edit form ── */}
        <div className="w-[45%] flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 shrink-0">
            <button
              onClick={handleClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
            <h2 className="text-sm font-semibold dark:text-white">Edit post</h2>
            <button
              onClick={handleSave}
              disabled={isUpdating || !editContent.trim()}
              className="text-sm font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Caption */}
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={5}
              placeholder="What's on your mind?"
              className="w-full p-3 text-sm border dark:border-gray-700 rounded-lg resize-none dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Privacy */}
            <div className="relative z-50">
              <button
                onClick={() => setShowPrivacyMenu((p) => !p)}
                className="w-full flex items-center gap-2 px-3 py-2 border dark:border-gray-700 rounded-lg text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <selectedPrivacyOption.Icon className="w-4 h-4 text-gray-500" />
                <span>{selectedPrivacyOption.label}</span>
              </button>
              {showPrivacyMenu && (
                <div
                  className="fixed mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-2xl overflow-auto max-h-64 min-w-200px"
                  style={{
                    zIndex: 9999,
                  }}
                >
                  {PRIVACY_OPTIONS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setEditPrivacy(value);
                        setShowPrivacyMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white ${
                        editPrivacy === value
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-500"
                          : ""
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Add location..."
                className="flex-1 px-3 py-2 text-sm border dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {editLocation && (
                <button
                  onClick={() => setEditLocation("")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tag people */}
            <div className="space-y-2">
              <button
                onClick={() => setShowTagSearch((p) => !p)}
                className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600"
              >
                <Users className="w-4 h-4" />
                {editTaggedUsers.length > 0
                  ? `Tagged ${editTaggedUsers.length} ${
                      editTaggedUsers.length === 1 ? "person" : "people"
                    }`
                  : "Tag friends"}
              </button>

              {/* Tagged chips */}
              {editTaggedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {editTaggedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                    >
                      @{user.username}
                      <button
                        onClick={() =>
                          setEditTaggedUsers((prev) =>
                            prev.filter((u) => u.id !== user.id)
                          )
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag search */}
              {showTagSearch && (
                <div className="relative">
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={async (e) => {
                      setTagSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        try {
                          const results = await postApi.searchUsers(
                            currentUser?.id.toString() || "",
                            e.target.value
                          );
                          setTagSearchResults(results);
                        } catch {
                          setTagSearchResults([]);
                        }
                      } else {
                        setTagSearchResults([]);
                      }
                    }}
                    placeholder="Search friends..."
                    className="w-full px-3 py-2 text-sm border dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {tagSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {tagSearchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            if (
                              !editTaggedUsers.find((u) => u.id === user.id)
                            ) {
                              setEditTaggedUsers((prev) => [...prev, user]);
                            }
                            setTagSearchQuery("");
                            setTagSearchResults([]);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                        >
                          <img
                            src={user.avatarUrl || "https://i.pravatar.cc/150"}
                            alt={user.username}
                            className="w-7 h-7 rounded-full"
                          />
                          <div>
                            <p className="text-sm font-medium dark:text-white">
                              {user.name || user.username}
                            </p>
                            <p className="text-xs text-gray-500">
                              @{user.username}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Discard-changes confirmation dialog ── */}
      {showDiscardConfirm && (
        <div
          className="absolute inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[320px] overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <h3 className="text-base font-semibold dark:text-white mb-2">
                Discard changes?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You have unsaved changes. If you leave now, your edits will be
                lost.
              </p>
            </div>
            <div className="border-t dark:border-gray-700 flex">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Keep editing
              </button>
              <div className="w-px bg-gray-200 dark:bg-gray-700" />
              <button
                onClick={onClose}
                className="flex-1 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
