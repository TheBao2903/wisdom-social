import { Alert } from "react-native";
import {
  createPost,
  fetchHomeFeedPosts,
  fetchPostAuthorById,
  fetchPostById,
  fetchUserById,
  normalizePost,
  togglePostReaction,
  togglePostSaved,
  submitComment,
  fetchSavedPostIds,
} from "@/services/postService";
import { UploadableMediaFile } from "@/utils/s3";
import {
  AppNotification,
  AuthResult,
  Conversation,
  IgtvVideo,
  Message,
  Post,
  PrivacyType,
  Story,
  User,
} from "@/types";
import {
  mockConversations,
  mockIgtvVideos,
  mockMessages,
  mockPosts,
  mockSavedPostIds,
  mockStories,
  mockUsers,
} from "@/constants";
import {
  ApiAuthUser,
  confirmRegisterOtp,
  forgotPassword,
  getCurrentUser,
  loginWithPhone,
  logoutApi,
  registerWithPhone,
  resendRegisterOtp,
  resetPassword,
} from "@/services/authService";
import chatWebsocketService from "@/services/chatWebsocketService";
import {
  getNotifications as fetchNotificationsApi,
  markAllAsRead as markAllNotificationsAsReadApi,
} from "@/services/notificationService";
import useRealtimePosts from "@/hooks/useRealtimePosts";
import deviceSettingService from "@/services/deviceSettingService";
import { fakeSendMessage } from "@/services/messageService";
import { getDeviceInfo } from "@/utils/deviceInfo";
import {
  clearStorage,
  getSettings,
  getUser,
  saveSettings,
  saveUser,
} from "@/utils/storage";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SignupPayload = {
  phone: string;
  password: string;
  confirmPassword: string;
};

type PhoneSignupPayload = {
  phone: string;
  password: string;
  confirmPassword: string;
};

type ResetPasswordPayload = {
  phone: string;
  password: string;
  confirmPassword: string;
  confirmationCode: string;
};

type UpdateProfilePayload = {
  fullName?: string;
  bio?: string;
  website?: string;
};

type AddPostPayload = {
  caption: string;
  imageUrl?: string;
  imageUrls?: string[];
  privacy?: PrivacyType;
  allowComments?: boolean;
  allowShares?: boolean;
  location?: string;
  taggedUserIds?: string[];
  mediaFiles?: UploadableMediaFile[];
  music?: Post["music"];
};

type ThemeMode = "light" | "dark" | "system";

type NotificationSettings = {
  pushEnabled: boolean;
  likesEnabled: boolean;
  commentsEnabled: boolean;
  followsEnabled: boolean;
  messagesEnabled: boolean;
  pageUpdatesEnabled: boolean;
};

type StoredAppSettings = {
  themeMode?: ThemeMode;
  notifications?: Partial<NotificationSettings>;
};

type AppContextValue = {
  users: User[];
  currentUser: User | null;
  loggedIn: boolean;
  loadingAuth: boolean;
  bootstrapLoading: boolean;
  posts: Post[];
  stories: Story[];
  savedPostIds: string[];
  likedPostIds: string[];
  notifications: AppNotification[];
  conversations: Conversation[];
  messages: Message[];
  igtvVideos: IgtvVideo[];
  themeMode: ThemeMode;
  notificationSettings: NotificationSettings;
  deletionPending: boolean;
  deletionRemainingDays: number | undefined;
  clearDeletionPending: () => void;
  login: (phone: string, password: string) => Promise<AuthResult>;
  signup: (payload: SignupPayload) => Promise<AuthResult>;
  signupWithPhone: (payload: PhoneSignupPayload) => Promise<AuthResult>;
  verifySignupOtp: (phone: string, otp: string) => Promise<AuthResult>;
  resendSignupOtp: (phone: string) => Promise<AuthResult>;
  requestPasswordReset: (phone: string) => Promise<AuthResult>;
  resetPasswordByOtp: (payload: ResetPasswordPayload) => Promise<AuthResult>;
  logout: () => void;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  updateNotificationSetting: (
    key: keyof NotificationSettings,
    value: boolean
  ) => Promise<void>;
  toggleAllNotifications: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;
  likePost: (postId: string, reactionType?: string, isToggleOff?: boolean) => Promise<void>;
  savePost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, skipApiCall?: boolean) => Promise<void>;
  addPost: (caption: string, imageUrl: string) => Promise<AuthResult>;
  createPostWithOptions: (payload: AddPostPayload) => Promise<AuthResult>;
  removePost: (postId: string) => void;
  updatePostPrivacyLocal: (postId: string, privacy: string) => void;
  updateProfile: (payload: UpdateProfilePayload) => void;
  refreshCurrentUser: () => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<AuthResult>;
  markNotificationsRead: () => void;
  getUserById: (id: string) => User | undefined;
  getMessagesByConversation: (conversationId: string) => Message[];
  upsertUsers: (incomingUsers: User[]) => void;
  upsertPosts: (incomingPosts: Post[]) => void;
  searchUsersAndPosts: (query: string) => { users: User[]; posts: Post[] };
  // Notification unread count
  unreadCount: number;
  clearUnreadCount: () => void;
};

const defaultNotificationSettings: NotificationSettings = {
  pushEnabled: true,
  likesEnabled: true,
  commentsEnabled: true,
  followsEnabled: true,
  messagesEnabled: true,
  pageUpdatesEnabled: true,
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const normalizeGender = (
  gender?: string | null
): User["gender"] | undefined => {
  if (!gender) return undefined;
  if (gender === "MALE" || gender === "FEMALE" || gender === "HIDDEN")
    return gender;
  return undefined;
};

const toInternationalPhone = (phone?: string | null): string => {
  if (!phone) return "";
  if (phone.startsWith("+84")) return phone;
  if (phone.startsWith("0")) return `+84${phone.substring(1)}`;
  if (/^\d{9,10}$/.test(phone)) return `+84${phone}`;
  return phone;
};

const normalizeNotification = (
  notification: AppNotification
): AppNotification => ({
  ...notification,
  isRead: notification.isRead ?? notification.read ?? false,
  read: notification.read ?? notification.isRead ?? false,
  actorIds:
    notification.actorIds || (notification.userId ? [notification.userId] : []),
  recipientId: notification.recipientId || "",
  createdAt: notification.createdAt || new Date().toISOString(),
});

const mapApiUserToAppUser = (apiUser: ApiAuthUser): User => {
  const normalizedUsername =
    apiUser.username?.trim().toLowerCase() || `user${apiUser.id}`;
  return {
    id: String(apiUser.id),
    username: normalizedUsername,
    fullName: apiUser.name?.trim() || normalizedUsername,
    name: apiUser.name?.trim() || normalizedUsername,
    bio: apiUser.bio?.trim() || "Welcome to Wisdom Social",
    avatarUrl: apiUser.avatarUrl || undefined,
    avatar: apiUser.avatarUrl || undefined,
    birthday: apiUser.birthday ?? undefined,
    gender: normalizeGender(apiUser.gender),
    phone: apiUser.phone,
    followers: 0,
    following: 0,
    hasPinCode: apiUser.hasPinCode,
  };
};

export function AppProvider({ children }: PropsWithChildren) {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [stories] = useState<Story[]>(mockStories);
  const [savedPostIds, setSavedPostIds] = useState<string[]>(mockSavedPostIds);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] =
    useState<Conversation[]>(mockConversations);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [igtvVideos] = useState<IgtvVideo[]>(mockIgtvVideos);
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(defaultNotificationSettings);
  const [deletionPending, setDeletionPending] = useState(false);
  const [deletionRemainingDays, setDeletionRemainingDays] = useState<
    number | undefined
  >(undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const nextCursorRef = useRef<string | null>(null);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users]
  );
  const loggedIn = !!currentUser;

  const upsertMappedUser = useCallback((mappedUser: User) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === mappedUser.id);
      if (exists) {
        return prev.map((u) =>
          u.id === mappedUser.id ? { ...u, ...mappedUser } : u
        );
      }
      return [mappedUser, ...prev];
    });
    setCurrentUserId(mappedUser.id);
  }, []);

  const upsertUsers = useCallback((incomingUsers: User[]) => {
    setUsers((prev) => {
      const map = new Map(prev.map((user) => [user.id, user]));
      incomingUsers.forEach((user) => {
        map.set(user.id, {
          ...map.get(user.id),
          ...user,
          avatar: user.avatar || user.avatarUrl,
        });
      });
      return Array.from(map.values());
    });
  }, []);

  const upsertPosts = useCallback((incomingPosts: Post[]) => {
    setPosts((prev) => {
      const map = new Map(prev.map((post) => [post.id, post]));
      incomingPosts.forEach((post) => {
        map.set(post.id, {
          ...map.get(post.id),
          ...post,
        });
      });
      return Array.from(map.values());
    });
  }, []);

  const syncCurrentUserFromServer = useCallback(async () => {
    const latestUser = await getCurrentUser();
    if (!latestUser) return;
    await saveUser(latestUser);
    upsertMappedUser(mapApiUserToAppUser(latestUser));
    if (latestUser.deletionPending) {
      setDeletionPending(true);
      setDeletionRemainingDays(latestUser.deletionRemainingDays);
    } else {
      setDeletionPending(false);
      setDeletionRemainingDays(undefined);
    }
  }, [upsertMappedUser]);

  const refreshPosts = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const [result, savedIds] = await Promise.all([
        fetchHomeFeedPosts(200),
        fetchSavedPostIds(currentUserId),
      ]);
      setPosts(result.posts);
      upsertUsers(
        result.posts.map((post) => post.user).filter(Boolean) as User[]
      );
      const likedIds = result.posts
        .filter((post) => post.isLiked)
        .map((post) => post.id);
      setLikedPostIds(likedIds);
      setSavedPostIds(savedIds);
      // Reset pagination cursor
      nextCursorRef.current = result.nextCursorLastActivityAt;
      setHasMorePosts(result.hasNext);
    } catch (err) {
      console.error("Error refreshing feed or saved posts:", err);
    }
  }, [currentUserId, upsertUsers]);

  const loadMorePosts = useCallback(async () => {
    if (!currentUserId || loadingMorePosts || !hasMorePosts || !nextCursorRef.current) return;

    setLoadingMorePosts(true);
    try {
      const result = await fetchHomeFeedPosts(200, {
        lastActivityAt: nextCursorRef.current || undefined,
      });

      if (result.posts.length === 0) {
        setHasMorePosts(false);
        return;
      }

      // Append posts without duplicates
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = result.posts.filter((p) => !existingIds.has(p.id));
        if (newPosts.length === 0) return prev;
        return [...prev, ...newPosts];
      });

      // Upsert users from new posts
      upsertUsers(
        result.posts.map((post) => post.user).filter(Boolean) as User[]
      );

      // Update cursor
      nextCursorRef.current = result.nextCursorLastActivityAt;
      setHasMorePosts(result.hasNext);
    } catch (err) {
      console.error("Error loading more posts:", err);
    } finally {
      setLoadingMorePosts(false);
    }
  }, [currentUserId, loadingMorePosts, hasMorePosts, upsertUsers]);

  useEffect(() => {
    const bootstrapSettings = async () => {
      const saved = await getSettings<StoredAppSettings>();
      if (saved?.themeMode) setThemeModeState(saved.themeMode);
      if (saved?.notifications)
        setNotificationSettings((prev) => ({
          ...prev,
          ...saved.notifications,
        }));
    };
    void bootstrapSettings();
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const storedUser = await getUser<ApiAuthUser>();
        if (storedUser) {
          upsertMappedUser(mapApiUserToAppUser(storedUser));
          void syncCurrentUserFromServer();
          void fetchSavedPostIds(String(storedUser.id)).then((ids) => {
            setSavedPostIds(ids);
          });
        }
      } finally {
        setBootstrapLoading(false);
      }
    };
    void bootstrapAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loggedIn) void refreshPosts();
  }, [loggedIn, refreshPosts]);

  useEffect(() => {
    if (!loggedIn || !currentUser?.phone) return;
    const internationalPhone = toInternationalPhone(currentUser.phone);
    if (!internationalPhone) return;
    let cancelled = false;

    const setupRealtimeProfileSync = async () => {
      try {
        chatWebsocketService.setPresenceIdentity(internationalPhone);
        await chatWebsocketService.connect();
      } catch {
        // ignore connection bootstrap errors
      }
      if (cancelled) return;
      chatWebsocketService.subscribeToProfileUpdates(internationalPhone, () => {
        void syncCurrentUserFromServer();
      });
    };
    void setupRealtimeProfileSync();
    return () => {
      cancelled = true;
      chatWebsocketService.unsubscribeFromProfileUpdates(internationalPhone);
    };
  }, [loggedIn, currentUser?.phone, syncCurrentUserFromServer]);

  useRealtimePosts({
    topic: "/topic/posts",
    enabled: !!loggedIn,
    onPostCreated: async (post) => {
      console.log("🔥 Mobile WS: NEW_POST received", post);
      try {
        const authorData = post.authorSummary || await fetchPostAuthorById(post.authorId);
        const normalized = normalizePost(post, authorData);
        setPosts((prev) => {
          if (prev.some((p) => p.id === normalized.id)) return prev;
          return [normalized, ...prev];
        });
        if (normalized.user) {
          upsertUsers([normalized.user]);
        }
      } catch (err) {
        console.error("Error normalizing created post:", err);
      }
    },
    onPostUpdated: (post) => {
      console.log("🔥 Mobile WS: POST_UPDATED received", post);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, ...post } : p))
      );
    },
    onPostDeleted: (postId) => {
      console.log("🔥 Mobile WS: POST_DELETED received", postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setLikedPostIds((prev) => prev.filter((id) => id !== postId));
      setSavedPostIds((prev) => prev.filter((id) => id !== postId));
    },
    onActivityBump: (postId, lastActivityAt, actorId) => {
      console.log("🔥 Mobile WS: BUMP received", postId, lastActivityAt, "actor:", actorId);

      setPosts((prev) => {
        return prev.map((p) =>
          p.id === postId
            ? { ...p, lastActivityAt }
            : p
        );
      });
    },
  });

  useEffect(() => {
    if (!loggedIn || !currentUser?.id) return;

    let cancelled = false;

    const setupNotifications = async () => {
      const initialNotifications = await fetchNotificationsApi(0, 50);
      if (!cancelled) {
        // Deduplicate by ID before storing
        const uniqueMap = new Map<string, AppNotification>();
        initialNotifications.forEach(n => uniqueMap.set(n.id, normalizeNotification(n as AppNotification)));
        const normalized = Array.from(uniqueMap.values());
        setNotifications(normalized);
        // Calculate initial unread count
        const initialUnread = normalized.filter(n => !n.isRead && !n.read).length;
        setUnreadCount(initialUnread);
      }

      try {
        await chatWebsocketService.connect();
      } catch {
        // ignore connection bootstrap errors
      }

      if (cancelled) return;
      const destination = `/topic/user/${currentUser.id}/notifications`;
      chatWebsocketService.subscribeToTopic(destination, (body) => {
        try {
          const notification = normalizeNotification(
            JSON.parse(body) as AppNotification
          );
          setNotifications((prev) => {
            if (prev.some((item) => item.id === notification.id)) return prev;
            return [notification, ...prev].slice(0, 50);
          });
          // Update unread count if notification is unread
          if (!notification.isRead && !notification.read) {
            setUnreadCount((prev) => prev + 1);
          }
        } catch {
          // no-op
        }
      });
    };

    void setupNotifications();

    return () => {
      cancelled = true;
      chatWebsocketService.unsubscribeFromTopic(
        `/topic/user/${currentUser.id}/notifications`
      );
    };
  }, [loggedIn, currentUser?.id]);

  useEffect(() => {
    if (!loggedIn || !currentUser?.phone) return;

    const internationalPhone = toInternationalPhone(currentUser.phone);
    if (!internationalPhone) return;

    const handleForceLogout = () => {
      chatWebsocketService.disconnect();
      setCurrentUserId(null);
      setDeletionPending(false);
      setDeletionRemainingDays(undefined);
      void clearStorage();
    };

    chatWebsocketService.subscribeToForceLogout(
      internationalPhone,
      handleForceLogout
    );

    // Topic riêng theo nền tảng: bị đá khi có phiên MOBILE khác đăng nhập
    // (cho phép 1 web + 1 mobile cùng tồn tại) -> báo cho người dùng.
    const handleForceLogoutElsewhere = () => {
      handleForceLogout();
      Alert.alert(
        "Đã đăng xuất",
        "Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.",
      );
    };
    const uid = currentUser?.id;
    if (uid != null) {
      chatWebsocketService.subscribeToForceLogoutByPlatform(uid, "MOBILE", handleForceLogoutElsewhere);
    }

    return () => {
      chatWebsocketService.unsubscribeFromForceLogout(internationalPhone);
      if (uid != null) {
        chatWebsocketService.unsubscribeFromForceLogoutByPlatform(uid, "MOBILE");
      }
    };
  }, [loggedIn, currentUser?.phone, currentUser?.id]);

  useEffect(() => {
    const loadRemoteDeviceSettings = async () => {
      if (!loggedIn) return;
      const info = await getDeviceInfo();
      const remote = await deviceSettingService.get(
        info.deviceName,
        info.deviceType
      );
      if (!remote) return;
      if (remote.themeMode) setThemeModeState(remote.themeMode);
      if (remote.pushEnabled !== undefined) {
        setNotificationSettings({
          pushEnabled: remote.pushEnabled ?? true,
          likesEnabled: remote.likesEnabled ?? true,
          commentsEnabled: remote.commentsEnabled ?? true,
          followsEnabled: remote.followsEnabled ?? true,
          messagesEnabled: remote.messagesEnabled ?? true,
          pageUpdatesEnabled: remote.pageUpdatesEnabled ?? true,
        });
      }
    };
    void loadRemoteDeviceSettings();
  }, [loggedIn]);

  const persistSettings = async (
    nextThemeMode: ThemeMode,
    nextNotificationSettings: NotificationSettings
  ) => {
    await saveSettings({
      themeMode: nextThemeMode,
      notifications: nextNotificationSettings,
    });
    if (loggedIn) {
      const info = await getDeviceInfo();
      await deviceSettingService.save({
        deviceName: info.deviceName,
        deviceType: info.deviceType,
        themeMode: nextThemeMode,
        ...nextNotificationSettings,
      });
    }
  };

  const getUserById = useCallback(
    (id: string) => users.find((user) => user.id === id),
    [users]
  );

  const login = async (
    phone: string,
    password: string
  ): Promise<AuthResult> => {
    setLoadingAuth(true);
    const apiResult = await loginWithPhone({ phone: phone.trim(), password });
    if (apiResult.success && apiResult.user) {
      upsertMappedUser(mapApiUserToAppUser(apiResult.user));
      try {
        const ids = await fetchSavedPostIds(String(apiResult.user.id));
        setSavedPostIds(ids);
      } catch (err) {
        console.error("Error syncing saved post IDs during login:", err);
      }
      // Surface deletion status
      if (apiResult.deletionPending) {
        setDeletionPending(true);
        setDeletionRemainingDays(apiResult.deletionRemainingDays);
      } else {
        setDeletionPending(false);
        setDeletionRemainingDays(undefined);
      }
      setLoadingAuth(false);
      return {
        success: true,
        deletionPending: apiResult.deletionPending,
        deletionRemainingDays: apiResult.deletionRemainingDays,
      };
    }
    setLoadingAuth(false);
    return {
      success: false,
      message: apiResult.message ?? "Đăng nhập thất bại.",
      remainingSeconds: apiResult.remainingSeconds,
      lockReason: apiResult.lockReason,
    };
  };

  const signup = async (payload: SignupPayload): Promise<AuthResult> => {
    return signupWithPhone(payload);
  };

  const signupWithPhone = async (
    payload: PhoneSignupPayload
  ): Promise<AuthResult> => {
    setLoadingAuth(true);
    const result = await registerWithPhone({
      phone: payload.phone.trim(),
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
    setLoadingAuth(false);
    return result;
  };

  const verifySignupOtp = async (
    phone: string,
    otp: string
  ): Promise<AuthResult> => {
    return confirmRegisterOtp(phone, otp);
  };

  const resendSignupOtp = async (phone: string): Promise<AuthResult> => {
    return resendRegisterOtp(phone);
  };

  const requestPasswordReset = async (phone: string): Promise<AuthResult> => {
    return forgotPassword(phone);
  };

  const resetPasswordByOtp = async (
    payload: ResetPasswordPayload
  ): Promise<AuthResult> => {
    return resetPassword(payload);
  };

  const clearDeletionPending = useCallback(() => {
    setDeletionPending(false);
    setDeletionRemainingDays(undefined);
  }, []);

  const logout = () => {
    chatWebsocketService.disconnect();
    setCurrentUserId(null);
    setDeletionPending(false);
    setDeletionRemainingDays(undefined);
    void logoutApi();
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await persistSettings(mode, notificationSettings);
  };

  const updateNotificationSetting = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    const updated = { ...notificationSettings, [key]: value };
    if (key === "pushEnabled" && !value) {
      updated.pushEnabled = false;
      updated.likesEnabled = false;
      updated.commentsEnabled = false;
      updated.followsEnabled = false;
      updated.messagesEnabled = false;
      updated.pageUpdatesEnabled = false;
    }
    if (key !== "pushEnabled" && value) updated.pushEnabled = true;
    setNotificationSettings(updated);
    await persistSettings(themeMode, updated);
  };

  const toggleAllNotifications = async () => {
    const allEnabled = notificationSettings.pushEnabled;
    const updated: NotificationSettings = {
      pushEnabled: !allEnabled,
      likesEnabled: !allEnabled,
      commentsEnabled: !allEnabled,
      followsEnabled: !allEnabled,
      messagesEnabled: !allEnabled,
      pageUpdatesEnabled: !allEnabled,
    };
    setNotificationSettings(updated);
    await persistSettings(themeMode, updated);
  };

  const likePost = async (
    postId: string,
    reactionType: string = "LIKE",
    isToggleOff?: boolean
  ) => {
    console.log("[AppContext likePost] Called:", { postId, reactionType, isToggleOff, currentUserId: currentUser?.id });
    if (!currentUser) return;
    const wasLiked = likedPostIds.includes(postId);
    const actualToggleOff = isToggleOff !== undefined ? isToggleOff : wasLiked;

    console.log("[AppContext likePost] Toggle logic:", { wasLiked, actualToggleOff });

    setLikedPostIds((prev) =>
      actualToggleOff
        ? prev.filter((id) => id !== postId)
        : prev.includes(postId)
        ? prev
        : [postId, ...prev]
    );
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes: actualToggleOff
                ? Math.max(0, post.likes - 1)
                : post.isLiked
                ? post.likes
                : post.likes + 1,
              isLiked: !actualToggleOff,
            }
          : post
      )
    );

    try {
      await togglePostReaction(currentUser.id, postId, reactionType);
      // Fetch fresh post data to sync accurate likes/reactions from DB
      const freshPost = await fetchPostById(postId);
      const author = freshPost.authorSummary || await fetchPostAuthorById(freshPost.authorId);
      const normalizedPost = normalizePost(freshPost, author);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? normalizedPost : post
        )
      );
    } catch {
      // Revert both likedPostIds AND post.isLiked on error
      setLikedPostIds((prev) =>
        !actualToggleOff
          ? prev.filter((id) => id !== postId)
          : prev.includes(postId)
          ? prev
          : [postId, ...prev]
      );
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: !actualToggleOff
                  ? Math.max(0, post.likes - 1)
                  : post.isLiked
                  ? post.likes
                  : post.likes + 1,
                isLiked: actualToggleOff,
              }
            : post
        )
      );
    }
  };

  const savePost = async (postId: string) => {
    if (!currentUser) return;
    const wasSaved = savedPostIds.includes(postId);
    setSavedPostIds((prev) =>
      wasSaved ? prev.filter((id) => id !== postId) : [postId, ...prev]
    );
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, isSaved: !wasSaved } : post
      )
    );
    try {
      await togglePostSaved(currentUser.id, postId);
    } catch {
      setSavedPostIds((prev) =>
        !wasSaved ? prev.filter((id) => id !== postId) : [postId, ...prev]
      );
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, isSaved: wasSaved } : post
        )
      );
    }
  };

  const addComment = async (
    postId: string,
    content: string,
    skipApiCall?: boolean
  ) => {
    if (!currentUser || !content.trim()) return;
    const trimmed = content.trim();
    const localComment = {
      id: `c${Date.now()}`,
      userId: currentUser.id,
      user: currentUser,
      content: trimmed,
      text: trimmed,
      createdAt: new Date().toISOString(),
      likes: 0,
    };
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, localComment],
              commentsCount: (post.commentsCount ?? post.comments.length) + 1,
            }
          : post
      )
    );

    if (skipApiCall) return;

    try {
      await submitComment(currentUser.id, postId, trimmed);
    } catch {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.filter((c) => c.id !== localComment.id),
                commentsCount: Math.max(
                  0,
                  (post.commentsCount ?? post.comments.length) - 1
                ),
              }
            : post
        )
      );
    }
  };

  const createPostWithOptions = async (
    payload: AddPostPayload
  ): Promise<AuthResult> => {
    if (!currentUser)
      return { success: false, message: "Please log in first." };
    if (!payload.caption.trim())
      return { success: false, message: "Caption is required." };
    const imageUrls = payload.imageUrls?.length
      ? payload.imageUrls
      : payload.imageUrl?.trim()
      ? [payload.imageUrl.trim()]
      : [];
    try {
      const created = await createPost(currentUser.id, {
        content: payload.caption.trim(),
        privacy: payload.privacy || "PUBLIC",
        imageUrls,
        allowComments: payload.allowComments !== false,
        allowShares: payload.allowShares !== false,
        location: payload.location,
        taggedUserIds: payload.taggedUserIds,
        mediaFiles: payload.mediaFiles,
        music: payload.music,
      });
      const normalized = normalizePost(created, currentUser);
      setPosts((prev) => [normalized, ...prev]);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error?.response?.data?.message || "Không thể tạo bài viết",
      };
    }
  };

  const addPost = async (
    caption: string,
    imageUrl: string
  ): Promise<AuthResult> => createPostWithOptions({ caption, imageUrl });

  const removePost = (postId: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setLikedPostIds((prev) => prev.filter((id) => id !== postId));
    setSavedPostIds((prev) => prev.filter((id) => id !== postId));
  };

  const updatePostPrivacyLocal = (postId: string, privacy: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, privacy: privacy as PrivacyType } : post
      )
    );
  };

  const updateProfile = (payload: UpdateProfilePayload) => {
    if (!currentUser) return;
    setUsers((prev) =>
      prev.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              fullName: payload.fullName?.trim() || user.fullName,
              bio: payload.bio?.trim() || user.bio,
              website: payload.website?.trim() || user.website,
            }
          : user
      )
    );
  };

  const sendMessage = async (
    conversationId: string,
    content: string
  ): Promise<AuthResult> => {
    if (!currentUser)
      return { success: false, message: "Please log in first." };
    if (!content.trim())
      return { success: false, message: "Message is empty." };
    const message: Message = {
      id: `m${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    const sent = await fakeSendMessage(message);
    setMessages((prev) => [...prev, sent]);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              lastMessage: sent.content,
              updatedAt: sent.createdAt,
            }
          : conversation
      )
    );
    return { success: true };
  };

  const markNotificationsRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, read: true, isRead: true }))
    );
    setUnreadCount(0);
    void markAllNotificationsAsReadApi();
  };

  const clearUnreadCount = () => {
    setUnreadCount(0);
  };

  const searchUsersAndPosts = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return { users, posts };
    const foundUsers = users.filter(
      (user) =>
        user.username.toLowerCase().includes(normalized) ||
        user.fullName.toLowerCase().includes(normalized)
    );
    const foundPosts = posts.filter((post) => {
      const author = post.user || getUserById(post.userId);
      return (
        post.caption.toLowerCase().includes(normalized) ||
        Boolean(author?.username.toLowerCase().includes(normalized))
      );
    });
    return { users: foundUsers, posts: foundPosts };
  };

  const getMessagesByConversation = (conversationId: string) => {
    return messages.filter((msg) => msg.conversationId === conversationId);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      getMessagesByConversation,
      users,
      currentUser,
      loggedIn,
      loadingAuth,
      bootstrapLoading,
      posts,
      stories,
      savedPostIds,
      likedPostIds,
      notifications,
      conversations,
      messages,
      igtvVideos,
      themeMode,
      notificationSettings,
      deletionPending,
      deletionRemainingDays,
      clearDeletionPending,
      login,
      signup,
      signupWithPhone,
      verifySignupOtp,
      resendSignupOtp,
      requestPasswordReset,
      resetPasswordByOtp,
      logout,
      refreshCurrentUser: syncCurrentUserFromServer,
      setThemeMode,
      updateNotificationSetting,
      toggleAllNotifications,
      refreshPosts,
      loadMorePosts,
      hasMorePosts,
      loadingMorePosts,
      likePost,
      savePost,
      addComment,
      addPost,
      createPostWithOptions,
      removePost,
      updatePostPrivacyLocal,
      updateProfile,
      sendMessage,
      markNotificationsRead,
      getUserById,
      upsertUsers,
      upsertPosts,
      searchUsersAndPosts,
      unreadCount,
      clearUnreadCount,
    }),
    [
      users,
      currentUser,
      loggedIn,
      loadingAuth,
      bootstrapLoading,
      posts,
      stories,
      savedPostIds,
      likedPostIds,
      notifications,
      conversations,
      messages,
      igtvVideos,
      themeMode,
      notificationSettings,
      deletionPending,
      deletionRemainingDays,
      clearDeletionPending,
      refreshPosts,
      loadMorePosts,
      hasMorePosts,
      loadingMorePosts,
      getUserById,
      syncCurrentUserFromServer,
      unreadCount,
      upsertPosts,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context)
    throw new Error("useAppContext must be used inside AppProvider");
  return context;
}
