import { useParams, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import type { User } from "../../types";
import { getCurrentUser } from "../../utils/auth";
import userService from "../../services/userService";
import friendService from "../../services/friendService";

export default function ProfileLayout() {
  const { username } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!username) return;

      try {
        setLoading(true);
        setError("");

        const users = await userService.searchUserByUsername(username);
        if (users && users.length > 0) {
          let userData = users[0];

          // Load additional counts
          try {
            const [friends] = await Promise.all([
              friendService.getFriends(userData.id),
            ]);
            userData = {
              ...userData,
              friendsCount: friends?.length || 0,
            };
          } catch (err) {
            console.error("Error loading counts:", err);
          }

          // Check if this is the current user's profile
          const currentUser = await getCurrentUser();
          if (currentUser && currentUser.username === userData.username) {
            setIsOwnProfile(true);
            setUser(userData as any);
          } else if (currentUser) {
            // Check if this user has blocked the current user
            try {
              const blockedByThis = await friendService.getBlockedUsers(userData.id);
              const isBlockedByThisUser = blockedByThis.some((u: User) => u.id === currentUser.id);

              if (isBlockedByThisUser) {
                setIsBlocked(true);
                setError(`Bạn không thể xem hồ sơ này vì người dùng đã chặn bạn.`);
              } else {
                setUser(userData as any);
                setIsOwnProfile(false);
              }
            } catch (err) {
              setUser(userData as any);
              setIsOwnProfile(false);
            }
          } else {
            setUser(userData as any);
            setIsOwnProfile(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setError("Không thể tải hồ sơ người dùng");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#000]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Không thể xem hồ sơ</h2>
          <p className="text-gray-500 dark:text-gray-400">
            {error || "Người dùng này đã chặn bạn."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#000]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Không tìm thấy</h2>
          <p className="text-gray-500 dark:text-gray-400">
            {error || "Người dùng không tồn tại."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black min-h-screen">
      <ProfileHeader user={user} isOwnProfile={isOwnProfile} />
      <ProfileTabs username={user.username} />
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 md:py-12">
        <Outlet context={{ user, isOwnProfile }} />
      </div>
    </div>
  );
}
