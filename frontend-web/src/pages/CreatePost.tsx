import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker, {
  type EmojiClickData,
  type Theme,
} from "emoji-picker-react";
import { fetchFriends, createPost } from "../services/postService";
import FriendSelectorModal from "../components/post/FriendSelectorModal";

type PrivacyType =
  | "PUBLIC"
  | "FRIENDS"
  | "PRIVATE"
  | "SPECIFIC"
  | "FRIENDS_EXCEPT";

export default function CreatePost() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [caption, setCaption] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [location, setLocation] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyType>("PUBLIC");
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowShares, setAllowShares] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [specificViewers, setSpecificViewers] = useState<string[]>([]);
  const [excludedUsers, setExcludedUsers] = useState<string[]>([]);
  const [showSpecificModal, setShowSpecificModal] = useState(false);
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);

  // Fetch friends list from backend
  useEffect(() => {
    const loadFriends = async () => {
      try {
        if (currentUser?.id) {
          const friendsList = await fetchFriends(currentUser.id);
          setFriends(friendsList);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
      }
    };

    loadFriends();
  }, [currentUser]);

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
    // Reset input value to allow selecting the same file again
    e.target.value = "";
  };

  const processFiles = (files: FileList) => {
    const newFiles: File[] = [];
    const newPreviewUrls: string[] = [];
    const maxFiles = 10 - selectedImages.length;
    const filesToProcess = Array.from(files).slice(0, maxFiles);
    let processedCount = 0;

    filesToProcess.forEach((file) => {
      if (file.type.startsWith("image/")) {
        newFiles.push(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviewUrls.push(reader.result as string);
          processedCount++;
          if (processedCount === filesToProcess.length) {
            setSelectedImages([...selectedImages, ...newFiles]);
            setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
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
  };

  const handleAddTag = (username?: string) => {
    const userToAdd = username || tagInput.trim();
    if (userToAdd && !taggedUsers.includes(userToAdd)) {
      setTaggedUsers([...taggedUsers, userToAdd]);
      setTagInput("");
    }
  };

  const filteredFriends = friends.filter(
    (user) =>
      user.username !== currentUser?.username &&
      !taggedUsers.includes(user.username) &&
      (user.username.toLowerCase().includes(tagInput.toLowerCase()) ||
        user.fullName.toLowerCase().includes(tagInput.toLowerCase()))
  );

  const handleRemoveTag = (tag: string) => {
    setTaggedUsers(taggedUsers.filter((t) => t !== tag));
  };

  const handleEmojiClick = (emojiClickData: EmojiClickData) => {
    setCaption(caption + emojiClickData.emoji);
  };

  const handlePost = async () => {
    try {
      if (!currentUser?.id) {
        alert("Please login to create post");
        return;
      }

      // Prepare post data
      const postData = {
        content: caption,
        privacy: privacy,
        location: location || null,
        taggedUsernames: taggedUsers,
        specificViewerUsernames: privacy === "SPECIFIC" ? specificViewers : [],
        excludedUsernames: privacy === "FRIENDS_EXCEPT" ? excludedUsers : [],
        allowComments: allowComments,
        allowShares: allowShares,
      };

      console.log("Creating post...");

      // Create post using postService (pass File objects directly)
      const newPost = await createPost(
        currentUser.id,
        postData,
        selectedImages
      );

      console.log("Post created:", newPost);
      alert("Post created successfully!");
      navigate("/");
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-#000">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header - Sticky */}
        <div className="bg-white dark:bg-[#262626] rounded-t-xl border border-gray-200 dark:border-[#363636] sticky top-0 z-20 shadow-md">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#363636]">
            <button
              onClick={handleCancel}
              className="text-sm font-semibold hover:text-gray-600 dark:text-white dark:hover:text-gray-300"
            >
              Cancel
            </button>
            <h2 className="text-base font-semibold dark:text-white">
              Create new post
            </h2>
            <button
              onClick={handlePost}
              disabled={!caption.trim() && selectedImages.length === 0}
              className={`text-sm font-semibold ${
                caption.trim() || selectedImages.length > 0
                  ? "text-[#0095f6] hover:text-[#00376b]"
                  : "text-[#0095f6] opacity-30 cursor-not-allowed"
              }`}
            >
              Create
            </button>
          </div>

          {/* Content Area */}
          <div className="p-4">
            {/* User Info with Privacy */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser?.avatar || "https://i.pravatar.cc/150?img=5"}
                  alt={currentUser?.username || "User"}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="text-sm font-semibold dark:text-white">
                    {currentUser?.username || "User"}
                  </p>
                  <button
                    onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {privacy === "PUBLIC" && (
                      <>
                        <Globe size={12} /> Public
                      </>
                    )}
                    {privacy === "FRIENDS" && (
                      <>
                        <UserCheck size={12} /> Friends
                      </>
                    )}
                    {privacy === "PRIVATE" && (
                      <>
                        <Lock size={12} /> Private
                      </>
                    )}
                    {privacy === "SPECIFIC" && (
                      <>
                        <Users size={12} /> Specific people (
                        {specificViewers.length})
                      </>
                    )}
                    {privacy === "FRIENDS_EXCEPT" && (
                      <>
                        <UserCheck size={12} /> Friends except (
                        {excludedUsers.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Dropdown */}
            {showPrivacyMenu && (
              <div className="mb-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg p-2">
                {[
                  "PUBLIC",
                  "FRIENDS",
                  "PRIVATE",
                  "SPECIFIC",
                  "FRIENDS_EXCEPT",
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPrivacy(p as PrivacyType);
                      setShowPrivacyMenu(false);
                      if (p === "SPECIFIC") {
                        setShowSpecificModal(true);
                      } else if (p === "FRIENDS_EXCEPT") {
                        setShowExcludedModal(true);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#262626] rounded text-sm dark:text-white"
                  >
                    {p === "PUBLIC" && <Globe size={16} />}
                    {p === "FRIENDS" && <UserCheck size={16} />}
                    {p === "PRIVATE" && <Lock size={16} />}
                    {p === "SPECIFIC" && <Users size={16} />}
                    {p === "FRIENDS_EXCEPT" && <UserCheck size={16} />}
                    {p === "PUBLIC" && "Public"}
                    {p === "FRIENDS" && "Friends"}
                    {p === "PRIVATE" && "Private"}
                    {p === "SPECIFIC" && "Specific people"}
                    {p === "FRIENDS_EXCEPT" && "Friends except..."}
                  </button>
                ))}
              </div>
            )}

            {/* Image Upload Area */}
            {selectedImages.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 dark:border-[#363636] rounded-xl p-12 text-center mb-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <ImagePlus
                  size={64}
                  className="text-gray-400 dark:text-gray-600 mb-4 mx-auto"
                />
                <p className="text-lg font-medium mb-2 dark:text-white">
                  Select photos from your computer
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Or drag and drop them here (up to 10 photos)
                </p>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <label
                  htmlFor="image-upload"
                  className="inline-block px-4 py-2 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                >
                  Select from computer
                </label>
              </div>
            ) : (
              <div className="mb-4">
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="grid grid-cols-2 gap-2 mb-2"
                >
                  {imagePreviewUrls.map((imgUrl, index) => (
                    <div key={index} className="relative">
                      <img
                        src={imgUrl}
                        alt={`Selected ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white"
                      >
                        <X size={16} />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                        {index + 1}/{selectedImages.length}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedImages.length < 10 && (
                  <label
                    htmlFor="image-upload-more"
                    className="block text-center py-2 border border-dashed border-gray-300 dark:border-[#363636] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
                  >
                    <ImagePlus
                      size={20}
                      className="mx-auto text-gray-400 dark:text-gray-600"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Add more photos
                    </span>
                    <input
                      id="image-upload-more"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Caption Input */}
            <div className="mb-4">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                className="w-full px-4 py-3 border border-gray-200 dark:border-[#363636] rounded-lg outline-none focus:border-gray-400 dark:focus:border-gray-500 resize-none dark:bg-[#000] dark:text-white dark:placeholder-gray-600"
                rows={4}
                maxLength={2200}
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2 relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#363636] rounded-full"
                  >
                    <Smile
                      size={20}
                      className="text-gray-500 dark:text-gray-400"
                    />
                  </button>
                  {showEmojiPicker && (
                    <div
                      className="absolute bottom-10 left-0 z-50"
                      onMouseLeave={() => setShowEmojiPicker(false)}
                    >
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme={
                          (document.documentElement.classList.contains("dark")
                            ? "dark"
                            : "light") as Theme
                        }
                        height={400}
                        width={320}
                      />
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-600">
                  {caption.length}/2,200
                </span>
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-3 border-t border-gray-200 dark:border-[#363636] pt-4">
              {/* Tag People */}
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium dark:text-white">
                    Tag people
                  </span>
                  <button
                    onClick={() => setShowTagInput(!showTagInput)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-[#363636] rounded"
                  >
                    <Users
                      size={20}
                      className="text-gray-600 dark:text-gray-400"
                    />
                  </button>
                </div>
                {showTagInput && (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Search friends..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#363636] rounded-lg outline-none focus:border-gray-400 dark:focus:border-gray-500 dark:bg-[#000] dark:text-white"
                      />
                      {/* Friends List Dropdown - Show 10 friends by default */}
                      {filteredFriends.length > 0 && (
                        <div className="absolute top-full mt-1 w-full bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#363636] rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                          {filteredFriends.slice(0, 10).map((friend) => (
                            <button
                              key={friend.id}
                              onClick={() => handleAddTag(friend.username)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#363636] transition-colors"
                            >
                              <img
                                src={friend.avatar}
                                alt={friend.username}
                                className="w-10 h-10 rounded-full"
                              />
                              <div className="flex-1 text-left">
                                <p className="text-sm font-semibold dark:text-white">
                                  {friend.username}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {friend.fullName}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {taggedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {taggedUsers.map((tag) => (
                          <div
                            key={tag}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm"
                          >
                            <span>@{tag}</span>
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-blue-800 dark:hover:text-blue-200"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium dark:text-white">
                    Add location
                  </span>
                  <button
                    onClick={() => setShowLocationInput(!showLocationInput)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-[#363636] rounded"
                  >
                    <MapPin
                      size={20}
                      className="text-gray-600 dark:text-gray-400"
                    />
                  </button>
                </div>
                {showLocationInput && (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Where was this?"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-[#363636] rounded-lg outline-none focus:border-gray-400 dark:focus:border-gray-500 dark:bg-[#000] dark:text-white"
                      />
                      {location && (
                        <button
                          onClick={() => {
                            setLocation("");
                            setLocationSuggestions([]);
                          }}
                          className="px-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {/* Location Suggestions Dropdown */}
                    {locationSuggestions.length > 0 && (
                      <div className="absolute top-full mt-1 w-full bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#363636] rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                        {locationSuggestions.map((place: any) => (
                          <button
                            key={place.place_id}
                            onClick={() => {
                              setLocation(place.display_name);
                              setLocationSuggestions([]);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#363636] transition-colors text-left"
                          >
                            <MapPin
                              size={16}
                              className="text-gray-500 dark:text-gray-400 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium dark:text-white truncate">
                                {place.name || place.display_name.split(",")[0]}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
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

              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium dark:text-white">
                  Accessibility
                </span>
                <button className="text-xs text-[#0095f6] hover:text-[#00376b] font-semibold">
                  Add alt text
                </button>
              </div>

              {/* Advanced Settings */}
              <div className="py-2">
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full flex items-center justify-between"
                >
                  <span className="text-sm font-medium dark:text-white">
                    Advanced settings
                  </span>
                  <Settings2
                    size={16}
                    className={`text-gray-600 dark:text-gray-400 transition-transform ${
                      showAdvancedSettings ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {showAdvancedSettings && (
                  <div className="mt-3 space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Turn off commenting
                      </span>
                      <button
                        onClick={() => setAllowComments(!allowComments)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          allowComments
                            ? "bg-[#0095f6]"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            allowComments ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Turn off sharing
                      </span>
                      <button
                        onClick={() => setAllowShares(!allowShares)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          allowShares
                            ? "bg-[#0095f6]"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
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
        </div>
      </div>

      {/* Friend Selector Modals */}
      <FriendSelectorModal
        isOpen={showSpecificModal}
        onClose={() => setShowSpecificModal(false)}
        onConfirm={(selected) => setSpecificViewers(selected)}
        title="Who can see this?"
        description="Only selected friends will be able to see this post"
        initialSelected={specificViewers}
      />

      <FriendSelectorModal
        isOpen={showExcludedModal}
        onClose={() => setShowExcludedModal(false)}
        onConfirm={(selected) => setExcludedUsers(selected)}
        title="Hide from"
        description="Selected friends won't be able to see this post"
        initialSelected={excludedUsers}
      />
    </div>
  );
}
