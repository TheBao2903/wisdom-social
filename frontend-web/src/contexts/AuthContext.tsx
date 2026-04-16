import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import axiosClient from "../api/axiosClient";
import { buildS3Url } from "../utils/s3";
import type { User } from "../types";

interface UserProfile extends User {
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
}

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  refreshUser: () => void;
  // User profile methods
  userCache: Record<string, UserProfile>;
  loading: boolean;
  error: string | null;
  fetchUserByUsername: (username: string) => Promise<UserProfile | null>;
  fetchUserStats: (userId: string) => Promise<{
    postsCount: number;
    followersCount: number;
    followingCount: number;
    friendsCount: number;
  }>;
  clearCache: () => void;
  updateUser: (userId: string, updateData: any) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapUserFromApi = (userData: any, fallback?: User | null): User => ({
  id: Number(userData?.id ?? fallback?.id ?? 0),
  username: userData?.username ?? fallback?.username ?? "",
  fullName:
    userData?.name ??
    userData?.fullName ??
    fallback?.fullName ??
    userData?.username ??
    "",
  avatarUrl:
    buildS3Url(userData?.avatarUrl) ??
    fallback?.avatarUrl ??
    "https://i.pravatar.cc/150?img=5",
  bio: userData?.bio ?? fallback?.bio ?? "",
  phone: userData?.phone ?? fallback?.phone,
  gender: userData?.gender ?? fallback?.gender,
  name: userData?.name ?? fallback?.name,
  birthday: userData?.birthday ?? fallback?.birthday,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = () => {
    const userStr = localStorage.getItem("current_user");
    const user = userStr ? JSON.parse(userStr) : null;
    console.log("🔵 AuthContext refreshUser called");
    console.log("🔵 currentUser from localStorage:", user);
    setCurrentUser(user);
  };

  const reloadCurrentUser = async () => {
    try {
      const meResponse = await axiosClient.get("/auth/me");
      const meData = meResponse.data?.data ?? meResponse.data;
      if (!meData?.id) return;

      const refreshedUser = mapUserFromApi(meData, currentUser);
      setCurrentUser(refreshedUser);
      localStorage.setItem("current_user", JSON.stringify(refreshedUser));
      clearCache();
    } catch (error) {
      console.error("❌ Error reloading current user:", error);
    }
  };

  const fetchUserStats = async (
    userId: string
  ): Promise<{
    postsCount: number;
    followersCount: number;
    followingCount: number;
    friendsCount: number;
  }> => {
    const stats = {
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
    };

    try {
      // Fetch posts count
      console.log(`📤 Calling /posts/user/${userId}`);
      const postsRes = await axiosClient.get(`/posts/user/${userId}`);
      console.log("📥 Posts response:", postsRes.data);
      stats.postsCount = Array.isArray(postsRes.data)
        ? postsRes.data.length
        : postsRes.data?.data?.length || 0;
      console.log("📝 Posts count:", stats.postsCount);
    } catch (e: any) {
      console.error(
        "❌ Error fetching posts:",
        e.message,
        e.response?.status,
        e.response?.data
      );
    }

    try {
      // Fetch followers count
      console.log(`📤 Calling /follows/followers/${userId}`);
      const followersRes = await axiosClient.get(
        `/follows/followers/${userId}`
      );
      console.log("📥 Followers response:", followersRes.data);
      stats.followersCount = Array.isArray(followersRes.data)
        ? followersRes.data.length
        : followersRes.data?.data?.length || 0;
      console.log("👥 Followers count:", stats.followersCount);
    } catch (e: any) {
      console.error(
        "❌ Error fetching followers:",
        e.message,
        e.response?.status,
        e.response?.data
      );
    }

    try {
      // Fetch following count
      console.log(`📤 Calling /follows/following/${userId}`);
      const followingRes = await axiosClient.get(
        `/follows/following/${userId}`
      );
      console.log("📥 Following response:", followingRes.data);
      stats.followingCount = Array.isArray(followingRes.data)
        ? followingRes.data.length
        : followingRes.data?.data?.length || 0;
      console.log("✅ Following count:", stats.followingCount);
    } catch (e: any) {
      console.error(
        "❌ Error fetching following:",
        e.message,
        e.response?.status,
        e.response?.data
      );
    }

    try {
      // Fetch friends count
      console.log(`📤 Calling /friends/${userId}`);
      const friendsRes = await axiosClient.get(`/friends/${userId}`);
      console.log("📥 Friends response:", friendsRes.data);
      stats.friendsCount = Array.isArray(friendsRes.data)
        ? friendsRes.data.length
        : friendsRes.data?.data?.length || 0;
      console.log("🤝 Friends count:", stats.friendsCount);
    } catch (e: any) {
      console.error(
        "❌ Error fetching friends:",
        e.message,
        e.response?.status,
        e.response?.data
      );
    }

    return stats;
  };

  const fetchUserByUsername = async (
    username: string
  ): Promise<UserProfile | null> => {
    try {
      // Check cache first
      if (userCache[username]) {
        console.log(`📦 Using cached user data for ${username}`);
        return userCache[username];
      }

      setLoading(true);
      setError(null);
      console.log(`📱 Fetching user profile for username: ${username}`);

      let userData: any;
      let userId: string;

      // If viewing own profile, use cached currentUser data + /auth/me
      if (currentUser && currentUser.username === username) {
        console.log("🔍 Viewing own profile");

        // Try to fetch fresh data from /auth/me
        try {
          const meResponse = await axiosClient.get("/auth/me");
          console.log("📥 /auth/me response:", meResponse.data);

          // /auth/me returns ApiResponse<User> with data field
          if (meResponse.data?.data && meResponse.data.success) {
            // Response wrapped in ApiResponse with data field containing User object
            userData = meResponse.data.data;
            userId = String(userData.id);
            console.log("✅ Got user data from /auth/me:", userData);
          } else if (meResponse.data?.id) {
            // Fallback: Response is direct User object (shouldn't happen with new backend)
            userData = meResponse.data;
            userId = String(userData.id);
            console.log(
              "✅ Got user data (direct format) from /auth/me:",
              userData
            );
          } else {
            // /auth/me returned error or no user data
            throw new Error("No user data in /auth/me response");
          }
        } catch (error) {
          console.warn("⚠️ /auth/me failed, using cached user data:", error);
          userData = currentUser;
          userId = String(currentUser.id);
        }
      } else {
        // For other users, use /auth/users endpoint as fallback
        console.log("🔍 Fetching other user profile via /auth/users");
        const response = await axiosClient.get("/auth/users");

        const users = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        console.log(
          `👥 Found ${users.length} users, searching for: ${username}`
        );

        userData = users.find((u: any) => u.username === username);
        console.log("✅ Found user data:", userData);

        if (!userData) {
          console.warn(`⚠️ User with username "${username}" not found`);
          setError("User not found");
          return null;
        }
        userId = String(userData.id);
      }

      // Fetch additional user stats
      const stats = await fetchUserStats(userId);

      const userProfile: UserProfile = {
        id: Number(userId),
        username: userData.username,
        fullName: userData.name || userData.username,
        avatarUrl:
        buildS3Url(userData.avatarUrl) || "https://i.pravatar.cc/150?img=5",
        bio: userData.bio,
        ...stats,
      };

      console.log("🖼️ Avatar S3 key from backend:", userData.avatarUrl);
      console.log("🖼️ Final avatar full URL:", userProfile.avatarUrl);

      // Update cache
      setUserCache((prev) => ({
        ...prev,
        [username]: userProfile,
      }));

      return userProfile;
    } catch (err: any) {
      console.error("❌ Error fetching user:", err);
      const errorMessage = err.message || "Failed to fetch user";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    setUserCache({});
  };

  const updateUser = async (
    userId: string,
    updateData: any
  ): Promise<boolean> => {
    try {
      // Call update endpoint - should return User object
      const updateResponse = await axiosClient.put(
        `/auth/users/${userId}`,
        updateData
      );

      // Check if update was successful (status 200)
      if (updateResponse.status === 200) {
        // Response should contain User object
        const updatedUserData = updateResponse.data;

        if (!updatedUserData?.id) {
          console.error("Invalid response: no user id");
          return false;
        }

        // Normalize id to string and update currentUser state
        const updatedUser: User = mapUserFromApi(updatedUserData, currentUser);

        // Update state and localStorage
        setCurrentUser(updatedUser);
        localStorage.setItem("current_user", JSON.stringify(updatedUser));

        // Clear cache to force refresh
        clearCache();

        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating user:", error);
      return false;
    }
  };

  useEffect(() => {
    console.log("🟢 AuthProvider mounted, initializing auth...");

    // Initialize auth - set axios header from stored token
    import("../utils/auth").then(({ initializeAuth }) => {
      console.log("🟢 Auth initialized");
      initializeAuth();
    });

    // Load user khi app khởi động
    console.log("🟡 Loading user from localStorage");
    refreshUser();

    // Register callback với auth utils
    import("../utils/auth").then(({ setAuthChangeCallback }) => {
      setAuthChangeCallback(refreshUser);
    });

    // Lắng nghe storage event để cập nhật khi localStorage thay đổi
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "current_user") {
        refreshUser();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        refreshUser,
        userCache,
        loading,
        error,
        fetchUserByUsername,
        fetchUserStats,
        clearCache,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
