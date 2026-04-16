import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import axios from "axios";
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface Friend {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
}

interface FriendSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedUsernames: string[]) => void;
  title: string;
  description: string;
  initialSelected?: string[];
}

export default function FriendSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  initialSelected = [],
}: FriendSelectorModalProps) {
  const currentUser = useCurrentUser();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsernames, setSelectedUsernames] =
    useState<string[]>(initialSelected);
  const [loading, setLoading] = useState(false);

  // Fetch friends list
  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  // Filter friends based on search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFriends(friends);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFriends(
        friends.filter(
          (friend) =>
            friend.username.toLowerCase().includes(query) ||
            friend.fullName.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, friends]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      if (!currentUser?.id) {
        console.error("No user ID found");
        return;
      }

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
      setFilteredFriends(mappedFriends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      setFriends([]);
      setFilteredFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (username: string) => {
    setSelectedUsernames((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedUsernames);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#262626] rounded-xl max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#363636]">
          <h3 className="text-base font-semibold dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-[#363636] rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Description */}
        <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-[#363636]">
          {description}
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#363636]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or name..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 dark:border-[#363636] rounded-lg outline-none focus:border-gray-400 dark:focus:border-gray-500 dark:bg-[#000] dark:text-white"
            />
          </div>
        </div>

        {/* Selected Count */}
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
          {selectedUsernames.length} selected
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading friends...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "No friends found matching your search"
                : "No friends yet"}
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {filteredFriends.map((friend) => {
                const isSelected = selectedUsernames.includes(friend.username);
                return (
                  <button
                    key={friend.id}
                    onClick={() => handleToggleSelect(friend.username)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-100 dark:hover:bg-[#363636]"
                    }`}
                  >
                    <img
                      src={friend.avatar}
                      alt={friend.username}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold dark:text-white truncate">
                        {friend.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {friend.fullName}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected
                          ? "bg-[#0095f6] border-[#0095f6]"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-[#363636] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#363636] rounded-lg hover:bg-gray-200 dark:hover:bg-[#404040] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-[#0095f6] rounded-lg hover:bg-[#0081d9] transition-colors"
          >
            Confirm ({selectedUsernames.length})
          </button>
        </div>
      </div>
    </div>
  );
}
