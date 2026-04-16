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
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker, {
  type EmojiClickData,
  type Theme,
} from "emoji-picker-react";
import FriendSelectorModal from "../components/post/FriendSelectorModal";

type PrivacyType =
  | "PUBLIC"
  | "FRIENDS"
  | "PRIVATE"
  | "SPECIFIC"
  | "FRIENDS_EXCEPT";

export default function EditPost() {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const { currentUser } = useAuth();
  const [caption, setCaption] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
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
  const [loading, setLoading] = useState(true);

  // Fetch post data to edit
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      try {
        setLoading(true);
        const response = await axios.get(
          `http://localhost:8080/api/posts/${postId}`
        );
        const post = response.data.data;

        // Pre-fill form with existing post data
        setCaption(post.content || "");
        setPrivacy(post.privacy || "PUBLIC");
        setLocation(
          typeof post.location === "string"
            ? post.location
            : post.location?.name || ""
        );
        setAllowComments(post.allowComments !== false);
        setAllowShares(post.allowShares !== false);

        // Load existing images
        if (post.mediaList && post.mediaList.length > 0) {
          setSelectedImages(post.mediaList.map((m: any) => m.url));
        }

        // Load tagged users
        if (post.taggedUserIds && post.taggedUserIds.length > 0) {
          const taggedUsersPromises = post.taggedUserIds.map((userId: string) =>
            axios
              .get(`http://localhost:8080/api/auth/user/${userId}`)
              .catch(() => null)
          );
          const taggedUsersResponses = await Promise.all(taggedUsersPromises);
          const fetchedTaggedUsers = taggedUsersResponses
            .filter((res) => res !== null)
            .map((res) => res!.data.data.username);
          setTaggedUsers(fetchedTaggedUsers);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching post:", error);
        alert("Không thể tải bài viết!");
        navigate("/");
      }
    };

    fetchPost();
  }, [postId, navigate]);

  // Fetch friends list from backend
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        if (currentUser?.id) {
          const response = await axios.get(
            `http://localhost:8080/api/users/${currentUser.id}/friends`
          );

          let friendsData = response.data;
          if (typeof friendsData === "string") {
            friendsData = JSON.parse(friendsData);
          }

          const mappedFriends = (friendsData.data || friendsData || []).map(
            (friend: any) => ({
              id: friend.userId?.toString() || friend.id?.toString(),
              username: friend.username,
              fullName: friend.name || friend.fullName,
              avatar:
                friend.avatarUrl ||
                friend.avatar ||
                "https://i.pravatar.cc/150?img=5",
            })
          );

          setFriends(mappedFriends);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
        setFriends([]);
      }
    };

    fetchFriends();
  }, []);

  // Search location suggestions with debounce
  useEffect(() => {
    const searchLocations = async () => {
      if (location.length < 3) {
        setLocationSuggestions([]);
        return;
      }

      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            location
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              "User-Agent": "WisdomSocial/1.0",
            },
          }
        );
        setLocationSuggestions(response.data);
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
      const filesArray = Array.from(files);
      setNewImages([...newImages, ...filesArray]);

      // Show preview
      filesArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImages((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    // Remove from newImages if it's a new image
    if (index >= selectedImages.length - newImages.length) {
      const newIndex = index - (selectedImages.length - newImages.length);
      setNewImages(newImages.filter((_, i) => i !== newIndex));
    }
  };

  const handleAddTag = (username?: string) => {
    const userToAdd = username || tagInput.trim();
    if (userToAdd && !taggedUsers.includes(userToAdd)) {
      setTaggedUsers([...taggedUsers, userToAdd]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTaggedUsers(taggedUsers.filter((t) => t !== tag));
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setCaption(caption + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleUpdatePost = async () => {
    try {
      if (!currentUser?.id) {
        alert("Please login to update post");
        return;
      }

      if (!postId) {
        alert("Post ID not found");
        return;
      }

      // Create FormData for multipart upload
      const formData = new FormData();

      // Add new images
      newImages.forEach((file) => {
        formData.append("images", file);
      });

      // Prepare post data with existing media URLs to keep
      const postData = {
        content: caption,
        privacy: privacy,
        location: location || null,
        taggedUsernames: taggedUsers,
        existingMediaUrls: selectedImages.filter((img) =>
          img.startsWith("http")
        ), // Keep only existing URLs
        specificViewerUsernames: privacy === "SPECIFIC" ? specificViewers : [],
        excludedUsernames: privacy === "FRIENDS_EXCEPT" ? excludedUsers : [],
        allowComments: allowComments,
        allowShares: allowShares,
      };

      // Add post data as JSON string
      formData.append("postData", JSON.stringify(postData));
      formData.append("userId", currentUser.id.toString());

      console.log("Updating post...");

      // Send PUT request to backend
      const response = await axios.put(
        `http://localhost:8080/api/posts/${postId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Post updated:", response.data);
      alert("Cập nhật bài viết thành công!");
      navigate("/");
    } catch (error: any) {
      console.error("Error updating post:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to update post. Please try again.";
      alert(errorMessage);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#000] flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#000]">
      {/* Header */}
      <div className="bg-white dark:bg-[#262626] border-b border-gray-200 dark:border-[#262626] sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <button
              onClick={handleCancel}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <h1 className="text-lg font-semibold dark:text-white">
              Chỉnh sửa bài viết
            </h1>
            <button
              onClick={handleUpdatePost}
              disabled={!caption.trim()}
              className="text-[#0095f6] hover:text-[#00376b] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lưu
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white dark:bg-[#262626] rounded-lg border border-gray-200 dark:border-[#3a3a3a] overflow-hidden">
          {/* Image Preview Section */}
          {selectedImages.length > 0 && (
            <div className="relative bg-black">
              <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                {selectedImages.map((image, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 w-full snap-center relative"
                  >
                    <img
                      src={image}
                      alt={`Preview ${index + 1}`}
                      className="w-full max-h-[500px] object-contain"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-4 right-4 bg-black bg-opacity-70 text-white rounded-full p-2 hover:bg-opacity-90 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="p-4">
            {/* Caption */}
            <div className="relative mb-4">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Bạn đang nghĩ gì?"
                className="w-full min-h-[120px] text-sm border-0 focus:ring-0 resize-none dark:bg-[#262626] dark:text-white placeholder-gray-500 dark:placeholder-gray-500"
                maxLength={2200}
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <Smile size={20} />
                </button>
                <span>{caption.length}/2200</span>
              </div>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-20">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={"auto" as Theme}
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Add Photos */}
              <label className="flex items-center justify-between py-3 px-4 border border-gray-200 dark:border-[#3a3a3a] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center gap-3">
                  <ImagePlus
                    size={20}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <span className="text-sm font-medium dark:text-white">
                    Thêm/Xóa ảnh
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>

              {/* Add Location */}
              <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg">
                <button
                  onClick={() => setShowLocationInput(!showLocationInput)}
                  className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MapPin
                      size={20}
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <span className="text-sm font-medium dark:text-white">
                      {location || "Thêm vị trí"}
                    </span>
                  </div>
                </button>
                {showLocationInput && (
                  <div className="px-4 pb-4 relative">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Tìm kiếm địa điểm..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3a3a] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0095f6] dark:bg-[#1a1a1a] dark:text-white"
                    />
                    {locationSuggestions.length > 0 && (
                      <div className="absolute z-10 w-[calc(100%-2rem)] mt-1 bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#3a3a3a] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {locationSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setLocation(suggestion.display_name);
                              setLocationSuggestions([]);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#1a1a1a] dark:text-white"
                          >
                            {suggestion.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                    {location && (
                      <button
                        onClick={() => setLocation("")}
                        className="absolute right-6 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tag People */}
              <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg">
                <button
                  onClick={() => setShowTagInput(!showTagInput)}
                  className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users
                      size={20}
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <span className="text-sm font-medium dark:text-white">
                      Tag bạn bè
                    </span>
                  </div>
                </button>
                {showTagInput && (
                  <div className="px-4 pb-4">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Tên bạn bè..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3a3a] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0095f6] dark:bg-[#1a1a1a] dark:text-white"
                      />
                      {tagInput && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#3a3a3a] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {friends
                            .filter((friend) =>
                              friend.username
                                .toLowerCase()
                                .includes(tagInput.toLowerCase())
                            )
                            .map((friend) => (
                              <button
                                key={friend.id}
                                onClick={() => handleAddTag(friend.username)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#1a1a1a] flex items-center gap-2"
                              >
                                <img
                                  src={friend.avatar}
                                  alt={friend.username}
                                  className="w-8 h-8 rounded-full"
                                />
                                <div>
                                  <div className="font-semibold dark:text-white">
                                    {friend.fullName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    @{friend.username}
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {taggedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {taggedUsers.map((user) => (
                          <span
                            key={user}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-[#1a1a1a] rounded-full text-sm dark:text-white"
                          >
                            {user}
                            <button
                              onClick={() => handleRemoveTag(user)}
                              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Privacy Settings */}
              <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg">
                <button
                  onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                  className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {privacy === "PUBLIC" && (
                      <Globe
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    )}
                    {privacy === "FRIENDS" && (
                      <Users
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    )}
                    {privacy === "PRIVATE" && (
                      <Lock
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    )}
                    {privacy === "SPECIFIC" && (
                      <UserCheck
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    )}
                    {privacy === "FRIENDS_EXCEPT" && (
                      <Users
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    )}
                    <span className="text-sm font-medium dark:text-white">
                      {privacy === "PUBLIC" && "Công khai"}
                      {privacy === "FRIENDS" && "Bạn bè"}
                      {privacy === "PRIVATE" && "Chỉ mình tôi"}
                      {privacy === "SPECIFIC" && "Người cụ thể"}
                      {privacy === "FRIENDS_EXCEPT" && "Bạn bè ngoại trừ"}
                    </span>
                  </div>
                </button>
                {showPrivacyMenu && (
                  <div className="px-4 pb-4 space-y-2">
                    {[
                      { value: "PUBLIC", label: "Công khai", icon: Globe },
                      { value: "FRIENDS", label: "Bạn bè", icon: Users },
                      {
                        value: "PRIVATE",
                        label: "Chỉ mình tôi",
                        icon: Lock,
                      },
                      {
                        value: "SPECIFIC",
                        label: "Người cụ thể",
                        icon: UserCheck,
                      },
                      {
                        value: "FRIENDS_EXCEPT",
                        label: "Bạn bè ngoại trừ",
                        icon: Users,
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setPrivacy(option.value as PrivacyType);
                          setShowPrivacyMenu(false);
                          if (option.value === "SPECIFIC") {
                            setShowSpecificModal(true);
                          } else if (option.value === "FRIENDS_EXCEPT") {
                            setShowExcludedModal(true);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-lg dark:text-white"
                      >
                        <option.icon
                          size={16}
                          className="text-gray-600 dark:text-gray-400"
                        />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
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
