import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { fetchStoryFeed } from "../../services/storyService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { buildS3Url } from "../../utils/s3";
import { Plus } from "lucide-react";
import StoryViewerModal from "./StoryViewerModal";

interface StoryFeedItem {
  id: string;
  userId: string;
  text?: string;
  media?: {
    url: string;
    type: string;
    thumbnailUrl?: string;
  };
  createdAt: string;
  // from backend response
  user?: {
    username: string;
    avatarUrl: string;
  };
  music?: {
    id?: string;
    title: string;
    artist: string;
    audioUrl?: string;
    thumbnail?: string;
  };
  stickers?: any[];
  textStyle?: any;
  isViewed?: boolean;
}

export default function StoriesBar() {
  const currentUser = useCurrentUser();
  const [feedStories, setFeedStories] = useState<StoryFeedItem[]>([]);
  const [, setLoading] = useState(true);
  
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [sortedUserIds, setSortedUserIds] = useState<string[]>([]);

  // Snapshot of groups frozen when the viewer opens — prevents mid-viewing re-renders
  const [snapshotGroups, setSnapshotGroups] = useState<any[] | null>(null);
  const [snapshotInitialIdx, setSnapshotInitialIdx] = useState(0);

  useEffect(() => {
    if (activeGroupIdx === null && Array.isArray(feedStories) && feedStories.length > 0) {
      const storiesByUserMap = new Map<string, StoryFeedItem[]>();
      feedStories.forEach((s) => {
        if (s && s.userId) {
          const list = storiesByUserMap.get(s.userId) || [];
          list.push(s);
          storiesByUserMap.set(s.userId, list);
        }
      });
      
      const otherUids = Array.from(storiesByUserMap.entries())
        .filter(([uid]) => !currentUser || uid !== String(currentUser.id))
        .map(([uid, stories]) => ({
          userId: uid,
          stories,
        }))
        .sort((a, b) => {
          const aViewed = a.stories.length > 0 && a.stories.every((s) => s.isViewed);
          const bViewed = b.stories.length > 0 && b.stories.every((s) => s.isViewed);
          if (aViewed && !bViewed) return 1;
          if (!aViewed && bViewed) return -1;
          return 0;
        })
        .map((item) => item.userId);
        
      setSortedUserIds(otherUids);
    }
  }, [feedStories, activeGroupIdx, currentUser]);

  useEffect(() => {
    setLoading(true);
    fetchStoryFeed(0, 20)
      .then((data) => {
        const items = Array.isArray(data?.data?.content)
          ? data.data.content
          : Array.isArray(data?.content)
          ? data.content
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];
        setFeedStories(items);
      })
      .catch((err) => {
        console.error("Error loading story feed:", err);
        setFeedStories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Group stories by userId
  const storiesByUser = new Map<string, StoryFeedItem[]>();
  if (Array.isArray(feedStories)) {
    feedStories.forEach((s) => {
      if (s && s.userId) {
        const list = storiesByUser.get(s.userId) || [];
        list.push(s);
        storiesByUser.set(s.userId, list);
      }
    });
  }

  const isGroupViewed = (stories: any[]) => {
    return stories.length > 0 && stories.every((s) => s.isViewed);
  };

  // Current user's stories
  const myStories = currentUser ? (storiesByUser.get(String(currentUser.id)) || []) : [];
  const hasMyStories = myStories.length > 0;

  // Other users' story groups (stably sorted while viewer is open)
  const currentSortedUids = sortedUserIds.length > 0 
    ? sortedUserIds 
    : Array.from(storiesByUser.entries())
        .filter(([uid]) => !currentUser || uid !== String(currentUser.id))
        .map(([uid, stories]) => ({
          userId: uid,
          stories,
        }))
        .sort((a, b) => {
          const aViewed = a.stories.length > 0 && a.stories.every((s) => s.isViewed);
          const bViewed = b.stories.length > 0 && b.stories.every((s) => s.isViewed);
          if (aViewed && !bViewed) return 1;
          if (!aViewed && bViewed) return -1;
          return 0;
        })
        .map((item) => item.userId);

  const otherUsersGroups = currentSortedUids
    .map((uid) => {
      const stories = storiesByUser.get(uid) || [];
      return {
        userId: uid,
        user: stories[0]?.user,
        stories,
      };
    })
    .filter((g) => g.stories.length > 0);

  // Build the list of all story groups (used for rendering the bar and for snapshotting)
  const allStoryGroups = useMemo(() => [
    ...(hasMyStories ? [{
      userId: String(currentUser!.id),
      username: currentUser!.username || currentUser!.name || "Tin của bạn",
      userAvatar: currentUser!.avatarUrl || "",
      stories: myStories,
    }] : []),
    ...otherUsersGroups.map((g) => ({
      userId: g.userId,
      username: g.user?.username || `User ${g.userId.slice(0, 6)}`,
      userAvatar: g.user?.avatarUrl || "",
      stories: g.stories,
    }))
  ], [feedStories, currentUser, sortedUserIds]);

  const handleOpenViewer = (indexInAll: number) => {
    // Snapshot the groups at the moment of opening — they won't change mid-viewing
    setSnapshotGroups(allStoryGroups);
    setSnapshotInitialIdx(indexInAll);
    setActiveGroupIdx(indexInAll);
  };

  const handleCloseViewer = useCallback(() => {
    setActiveGroupIdx(null);
    setSnapshotGroups(null);
  }, []);

  const handleStoryViewed = useCallback((storyId: string) => {
    setFeedStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, isViewed: true } : s))
    );
  }, []);

  return (
    <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-[#262626] py-4 mb-4">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4">
        {/* Create Story button / My Story viewing button */}
        {currentUser && (
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
            {hasMyStories ? (
              // If current user HAS active stories, clicking avatar opens viewer
              <div className="relative">
                <button
                  onClick={() => handleOpenViewer(0)}
                  className={`p-[2.5px] rounded-full focus:outline-none transition-transform active:scale-95 duration-200 cursor-pointer ${
                    isGroupViewed(myStories)
                      ? "bg-gray-300 dark:bg-zinc-700"
                      : "bg-gradient-to-tr from-green-400 to-emerald-500"
                  }`}
                >
                  <div className="bg-white dark:bg-black p-[2.5px] rounded-full">
                    <img
                      src={buildS3Url(currentUser.avatarUrl) || currentUser.avatarUrl}
                      alt="Your active story"
                      className="w-16.5 h-16.5 rounded-full object-cover"
                    />
                  </div>
                </button>
                {/* Small overlay Plus button to add a new story anyway */}
                <Link
                  to="/create-story"
                  className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 rounded-full border-2 border-white dark:border-black flex items-center justify-center hover:bg-blue-600 transition-colors"
                  title="Thêm tin mới"
                >
                  <Plus size={12} strokeWidth={3} className="text-white" />
                </Link>
              </div>
            ) : (
              // If NO active stories, clicking goes to create story page
              <Link
                to="/create-story"
                className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
              >
                <div className="relative">
                  <div className="bg-white dark:bg-black p-[2.5px] rounded-full">
                    <img
                      src={buildS3Url(currentUser.avatarUrl) || currentUser.avatarUrl}
                      alt="Create story"
                      className="w-16.5 h-16.5 rounded-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 rounded-full border-2 border-white dark:border-black flex items-center justify-center">
                    <Plus size={12} strokeWidth={3} className="text-white" />
                  </div>
                </div>
              </Link>
            )}
            <span className="text-[12px] truncate max-w-18.5 text-center text-gray-900 dark:text-white">
              Tin của bạn
            </span>
          </div>
        )}

        {/* Other users' stories from backend */}
        {otherUsersGroups.map((group, index) => (
          <button
            key={group.userId}
            onClick={() => handleOpenViewer(hasMyStories ? index + 1 : index)}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none cursor-pointer"
          >
            <div className={`p-[2.5px] rounded-full group-hover:scale-105 active:scale-95 transition-all duration-200 ${
              isGroupViewed(group.stories)
                ? "bg-gray-300 dark:bg-zinc-700"
                : "bg-gradient-to-tr from-blue-400 to-indigo-500"
            }`}>
              <div className="bg-white dark:bg-black p-[2.5px] rounded-full">
                <img
                  src={
                    buildS3Url(group.user?.avatarUrl || null) ||
                    `https://i.pravatar.cc/150?u=${group.userId}`
                  }
                  alt={group.user?.username || group.userId}
                  className="w-16.5 h-16.5 rounded-full object-cover"
                />
              </div>
            </div>
            <span className="text-[12px] truncate max-w-18.5 text-center text-gray-900 dark:text-white">
              {group.user?.username || `User ${group.userId.slice(0, 6)}`}
            </span>
          </button>
        ))}
      </div>

      {snapshotGroups !== null && snapshotGroups.length > 0 && (
        <StoryViewerModal
          isOpen={true}
          onClose={handleCloseViewer}
          groups={snapshotGroups}
          initialGroupIdx={snapshotInitialIdx}
          initialStoryIdx={0}
          onStoryViewed={handleStoryViewed}
        />
      )}
    </div>
  );
}
