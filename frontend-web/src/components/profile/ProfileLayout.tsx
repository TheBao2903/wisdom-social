import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Outlet, useNavigate } from "react-router-dom";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import type { User } from "../../types";
import { getCurrentUser } from "../../utils/auth";
import userService from "../../services/userService";
import friendService from "../../services/friendService";
import blockService from "../../services/blockService";
import websocketService from "../../services/websocket";
import { convertPhoneToInternational } from "../../hooks/useCurrentUser";
import { useFriendDataSafe } from "../../contexts/FriendDataContext";

export default function ProfileLayout() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState("");

  const { friends: ctxFriends } = useFriendDataSafe();
  // Tracks whether the viewed user was in our friends list on the previous render.
  // Used to detect external accept/unfriend events that change their friend count.
  const targetWasFriendRef = useRef<boolean | null>(null);

  const handleFriendAccepted = useCallback(() => {
    setUser((prev) =>
      prev ? { ...prev, friendsCount: (prev.friendsCount ?? 0) + 1 } : prev
    );
  }, []);

  const handleFriendRemoved = useCallback(() => {
    setUser((prev) =>
      prev
        ? { ...prev, friendsCount: Math.max(0, (prev.friendsCount ?? 0) - 1) }
        : prev
    );
  }, []);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!username) return;

      try {
        setLoading(true);
        setError("");

        // Check if username is a numeric ID
        if (/^\d+$/.test(username)) {
          try {
            const profile = await userService.getUserProfile(username);
            if (profile && profile.username) {
              navigate(`/profile/${profile.username}`, { replace: true });
              return;
            }
          } catch (err) {
            console.error("Error loading user profile by ID:", err);
          }
        }

        const users = await userService.searchUserByUsername(username);
        if (users && users.length > 0) {
          const rawUser = users[0];
          const currentUser = await getCurrentUser();
          const isOwn = currentUser && currentUser.username === rawUser.username;

          // Fetch privacy-aware profile data
          let profile: any = null;
          try {
            profile = await userService.getProfileById(rawUser.id);
          } catch (err) {
            console.error("Error loading profile:", err);
          }

          // If blocked, show error
          if (!isOwn && profile) {
            try {
              const blockedByThis = await blockService.getBlockedUsers(rawUser.id);
              const isBlockedByThisUser = blockedByThis.some(
                (u: User) => u.id === currentUser?.id
              );
              if (isBlockedByThisUser) {
                setIsBlocked(true);
                setError("Bạn không thể xem hồ sơ này vì người dùng đã chặn bạn.");
                return;
              }
            } catch (_) {}
          }

          const isProfilePrivate = profile?.isPrivate === true;

          // Merge privacy-aware data with raw user.
          // For private profiles, sensitive fields are hidden entirely — keep username for URL routing.
          const merged = profile
            ? {
                ...rawUser,
                name: isProfilePrivate ? "" : profile.name,
                fullName: isProfilePrivate ? "" : profile.name,
                username: rawUser.username,
                avatarUrl: profile.avatarUrl || rawUser.avatarUrl,
                bio: isProfilePrivate ? "" : (profile.bio !== "*****" ? profile.bio : ""),
                birthday: isProfilePrivate ? "" : (profile.birthday !== "*****" ? profile.birthday : ""),
                gender: isProfilePrivate ? undefined : profile.gender,
                phone: isProfilePrivate ? "" : (profile.phone !== "*****" ? profile.phone : ""),
                friendsCount: profile.friendsCount ?? 0,
                followersCount: profile.followersCount ?? 0,
                followingCount: profile.followingCount ?? 0,
                postsCount: profile.postsCount ?? 0,
                isPrivate: isProfilePrivate,
                privacyProfile: profile.privacyProfile,
              }
            : rawUser;

          if (isOwn) {
            setIsOwnProfile(true);
            setUser(merged as any);
          } else {
            setUser(merged as any);
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

  // Subscribe to friend events of the viewed user so the friend count
  // updates in real-time when a third party accepts/cancels friendship with them.
  useEffect(() => {
    if (!user?.id || !user?.phone || isOwnProfile) return;

    const phone = convertPhoneToInternational(user.phone);
    if (!phone) return;

    const friendTopics = [
      `/topic/user/${phone}/friend-accept`,
      `/topic/user/${phone}/friend-cancel`,
    ];

    const handleFriendCountChange = async () => {
      try {
        const friends = await friendService.getFriends(user.id);
        setUser((prev) =>
          prev ? { ...prev, friendsCount: friends?.length || 0 } : prev
        );
      } catch {
        // silent — count stays at last known value
      }
    };

    const setup = async () => {
      if (!websocketService.isConnected()) {
        await websocketService.connect();
      }
      friendTopics.forEach((topic) =>
        websocketService.subscribeToTopic(topic, handleFriendCountChange)
      );
    };

    setup();

    return () => {
      friendTopics.forEach((topic) =>
        websocketService.unsubscribeFromTopic(topic, handleFriendCountChange)
      );
    };
  }, [user?.id, user?.phone, isOwnProfile]);

  // When the viewed user enters/leaves the current user's own friends list
  // (e.g. they accepted our request, or we unfriended them from another tab),
  // re-fetch their friend count so the profile stays accurate.
  useEffect(() => {
    if (!user?.id || isOwnProfile) return;

    const isNowFriend = ctxFriends.some(
      (f: any) => String(f.id) === String(user.id)
    );

    if (targetWasFriendRef.current === null) {
      // First render after profile load — just record baseline, don't fetch.
      targetWasFriendRef.current = isNowFriend;
      return;
    }

    if (targetWasFriendRef.current !== isNowFriend) {
      targetWasFriendRef.current = isNowFriend;
      friendService
        .getFriends(user.id)
        .then((friends) =>
          setUser((prev) =>
            prev ? { ...prev, friendsCount: friends?.length || 0 } : prev
          )
        )
        .catch(() => {});
    }
  }, [ctxFriends, user?.id, isOwnProfile]);

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
          <h2 className="text-2xl font-bold mb-2 dark:text-white">
            Không thể xem hồ sơ
          </h2>
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
          <h2 className="text-2xl font-bold mb-2 dark:text-white">
            Không tìm thấy
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {error || "Người dùng không tồn tại."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black min-h-screen">
      <ProfileHeader
        user={user}
        isOwnProfile={isOwnProfile}
        onFriendAccepted={handleFriendAccepted}
        onFriendRemoved={handleFriendRemoved}
      />
      <ProfileTabs username={user.username} isOwnProfile={isOwnProfile} />
      <div className="max-w-3xl mx-auto px-1 sm:px-2 pt-1 pb-8">
        <Outlet context={{ user, isOwnProfile }} />
      </div>
    </div>
  );
}
