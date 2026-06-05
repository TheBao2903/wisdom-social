import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileTabs from "../components/profile/ProfileTabs";
import axios from "axios";
import type { User } from "../types";
import { useCurrentUser } from "../hooks/useCurrentUser";
import websocketService from "../services/websocket";
import { convertPhoneToInternational } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";
import { API_BASE_URL } from "../config/backend";

export default function ProfileGeneral() {
  const { username } = useParams();
  const currentUser = useCurrentUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/auth/user/${username}`
        );
        if (response.data.success) {
          const userData = response.data.data;
          setUser({
            id: userData.id.toString(),
            username: userData.username,
            fullName: userData.name || userData.username,
            avatarUrl:
              buildS3Url(userData.avatarUrl) ||
              userData.avatarUrl ||
              "https://i.pravatar.cc/150?img=5",
            bio: userData.bio,
            birthday: userData.birthday || "",
            gender: userData.gender || "HIDDEN",
            phone: userData.phone,
            friendsCount: userData.friendCount || 0,
            followersCount: userData.followerCount || 0,
            followingCount: userData.followingCount || 0,
            postsCount: userData.postCount || 0,
          });
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchUser();
    }
  }, [username]);

  // Subscribe to real-time profile updates via WebSocket
  useEffect(() => {
    if (!user?.phone) return;

    const phone = convertPhoneToInternational(user.phone);
    if (!phone) return;

    const handleProfileUpdate = (updatedData: any) => {
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(updatedData.username != null && {
            username: updatedData.username,
          }),
          ...(updatedData.name != null && { fullName: updatedData.name }),
          ...(updatedData.avatarUrl != null && {
            avatarUrl: updatedData.avatarUrl,
          }),
          ...(updatedData.bio != null && { bio: updatedData.bio }),
          ...(updatedData.birthday != null && {
            birthday: updatedData.birthday,
          }),
          ...(updatedData.gender != null && { gender: updatedData.gender }),
        };
      });
    };

    const setup = async () => {
      if (!websocketService.isConnected()) {
        await websocketService.connect();
      }
      websocketService.subscribeToProfileUpdates(phone, handleProfileUpdate);
    };

    setup();

    return () => {
      websocketService.unsubscribeFromProfileUpdates(
        phone,
        handleProfileUpdate
      );
    };
  }, [user?.phone]);

  const isOwnProfile = currentUser?.username === username;

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!user) {
    return <div className="p-4 text-center">User not found</div>;
  }

  return (
    <div className="bg-white dark:bg-black min-h-screen">
      <ProfileHeader user={user} isOwnProfile={isOwnProfile} />
      <ProfileTabs username={username!} isOwnProfile={isOwnProfile} />
      <div className="max-w-3xl mx-auto px-1 sm:px-2 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
        Thông tin chung sẽ hiển thị tại đây
      </div>
    </div>
  );
}
