import {
    mockConversations,
    mockIgtvVideos,
    mockLikedPostIds,
    mockMessages,
    mockNotifications,
    mockPosts,
    mockSavedPostIds,
    mockStories,
    mockUsers,
} from "@/constants";
import {
    ApiAuthUser,
    confirmRegisterOtp,
    forgotPassword,
    loginWithPhone,
    logoutApi,
    registerWithPhone,
    resetPassword,
} from "@/services/authService";
import deviceSettingService from "@/services/deviceSettingService";
import { fakeSendMessage } from "@/services/messageService";
import { fakeCreatePost } from "@/services/postService";
import {
    AppNotification,
    AuthResult,
    Conversation,
    IgtvVideo,
    Message,
    Post,
    Story,
    User,
} from "@/types";
import { getDeviceInfo } from "@/utils/deviceInfo";
import { getSettings, saveSettings } from "@/utils/storage";
import {
    createContext,
    PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
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
    login: (phone: string, password: string) => Promise<AuthResult>;
    signup: (payload: SignupPayload) => Promise<AuthResult>;
    signupWithPhone: (payload: PhoneSignupPayload) => Promise<AuthResult>;
    verifySignupOtp: (phone: string, otp: string) => Promise<AuthResult>;
    requestPasswordReset: (phone: string) => Promise<AuthResult>;
    resetPasswordByOtp: (payload: ResetPasswordPayload) => Promise<AuthResult>;
    logout: () => void;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    updateNotificationSetting: (
        key: keyof NotificationSettings,
        value: boolean,
    ) => Promise<void>;
    toggleAllNotifications: () => Promise<void>;
    likePost: (postId: string) => void;
    savePost: (postId: string) => void;
    addComment: (postId: string, content: string) => void;
    addPost: (caption: string, imageUrl: string) => Promise<AuthResult>;
    updateProfile: (payload: UpdateProfilePayload) => void;
    sendMessage: (
        conversationId: string,
        content: string,
    ) => Promise<AuthResult>;
    markNotificationsRead: () => void;
    getUserById: (id: string) => User | undefined;
    getMessagesByConversation: (conversationId: string) => Message[];
    searchUsersAndPosts: (query: string) => { users: User[]; posts: Post[] };
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

const toPublicImageUrl = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (
        url.startsWith("http") ||
        url.startsWith("file://") ||
        url.startsWith("content://")
    ) {
        return url;
    }
    return `https://cnmt-hk1-amz.s3.ap-southeast-1.amazonaws.com/${url}`;
};

const mapApiUserToAppUser = (apiUser: ApiAuthUser): User => {
    const normalizedUsername =
        apiUser.username?.trim().toLowerCase() || `user${apiUser.id}`;

    return {
        id: String(apiUser.id),
        username: normalizedUsername,
        fullName: apiUser.name?.trim() || normalizedUsername,
        bio: apiUser.bio?.trim() || "Welcome to Wisdom Social",
        avatar:
            toPublicImageUrl(apiUser.avatarUrl) ||
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
        followers: 0,
        following: 0,
    };
};

export function AppProvider({ children }: PropsWithChildren) {
    const [users, setUsers] = useState<User[]>(mockUsers);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [posts, setPosts] = useState<Post[]>(mockPosts);
    const [stories] = useState<Story[]>(mockStories);
    const [savedPostIds, setSavedPostIds] =
        useState<string[]>(mockSavedPostIds);
    const [likedPostIds, setLikedPostIds] =
        useState<string[]>(mockLikedPostIds);
    const [notifications, setNotifications] =
        useState<AppNotification[]>(mockNotifications);
    const [conversations, setConversations] =
        useState<Conversation[]>(mockConversations);
    const [messages, setMessages] = useState<Message[]>(mockMessages);
    const [igtvVideos] = useState<IgtvVideo[]>(mockIgtvVideos);
    const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
    const [notificationSettings, setNotificationSettings] =
        useState<NotificationSettings>(defaultNotificationSettings);

    const currentUser = useMemo(
        () => users.find((user) => user.id === currentUserId) ?? null,
        [currentUserId, users],
    );

    const loggedIn = !!currentUser;

    useEffect(() => {
        const bootstrapSettings = async () => {
            const saved = await getSettings<StoredAppSettings>();
            if (saved?.themeMode) {
                setThemeModeState(saved.themeMode);
            }
            if (saved?.notifications) {
                setNotificationSettings((prev) => ({
                    ...prev,
                    ...saved.notifications,
                }));
            }
        };

        void bootstrapSettings();
    }, []);

    useEffect(() => {
        const loadRemoteDeviceSettings = async () => {
            if (!loggedIn) return;

            const info = await getDeviceInfo();
            const remote = await deviceSettingService.get(
                info.deviceName,
                info.deviceType,
            );

            if (!remote) return;

            if (remote.themeMode) {
                setThemeModeState(remote.themeMode);
            }

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
        nextNotificationSettings: NotificationSettings,
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

    const getUserById = (id: string) => users.find((user) => user.id === id);

    const getMessagesByConversation = (conversationId: string) =>
        messages.filter((message) => message.conversationId === conversationId);

    const login = async (
        phone: string,
        password: string,
    ): Promise<AuthResult> => {
        setLoadingAuth(true);

        const apiResult = await loginWithPhone({
            phone: phone.trim(),
            password,
        });

        if (apiResult.success && apiResult.user) {
            const mappedUser = mapApiUserToAppUser(apiResult.user);
            setUsers((prev) => {
                const exists = prev.some((u) => u.id === mappedUser.id);
                if (exists) {
                    return prev.map((u) =>
                        u.id === mappedUser.id ? { ...u, ...mappedUser } : u,
                    );
                }
                return [mappedUser, ...prev];
            });
            setCurrentUserId(mappedUser.id);
            setLoadingAuth(false);
            return { success: true };
        }

        setLoadingAuth(false);
        return {
            success: false,
            message: apiResult.message ?? "Đăng nhập thất bại.",
        };
    };

    const signup = async (payload: SignupPayload): Promise<AuthResult> => {
        return signupWithPhone(payload);
    };

    const signupWithPhone = async (
        payload: PhoneSignupPayload,
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
        otp: string,
    ): Promise<AuthResult> => {
        return confirmRegisterOtp(phone, otp);
    };

    const requestPasswordReset = async (phone: string): Promise<AuthResult> => {
        return forgotPassword(phone);
    };

    const resetPasswordByOtp = async (
        payload: ResetPasswordPayload,
    ): Promise<AuthResult> => {
        return resetPassword(payload);
    };

    const logout = () => {
        setCurrentUserId(null);
        void logoutApi();
    };

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        await persistSettings(mode, notificationSettings);
    };

    const updateNotificationSetting = async (
        key: keyof NotificationSettings,
        value: boolean,
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

        if (key !== "pushEnabled" && value) {
            updated.pushEnabled = true;
        }

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

    const likePost = (postId: string) => {
        const isLiked = likedPostIds.includes(postId);

        setLikedPostIds((prev) =>
            isLiked ? prev.filter((id) => id !== postId) : [postId, ...prev],
        );

        setPosts((prev) =>
            prev.map((post) => {
                if (post.id !== postId) return post;

                return {
                    ...post,
                    likes: isLiked
                        ? Math.max(0, post.likes - 1)
                        : post.likes + 1,
                };
            }),
        );
    };

    const savePost = (postId: string) => {
        setSavedPostIds((prev) =>
            prev.includes(postId)
                ? prev.filter((id) => id !== postId)
                : [postId, ...prev],
        );
    };

    const addComment = (postId: string, content: string) => {
        if (!currentUser || !content.trim()) return;

        setPosts((prev) =>
            prev.map((post) => {
                if (post.id !== postId) return post;

                return {
                    ...post,
                    comments: [
                        ...post.comments,
                        {
                            id: `c${Date.now()}`,
                            userId: currentUser.id,
                            content: content.trim(),
                            createdAt: new Date().toISOString(),
                        },
                    ],
                };
            }),
        );
    };

    const addPost = async (
        caption: string,
        imageUrl: string,
    ): Promise<AuthResult> => {
        if (!currentUser) {
            return { success: false, message: "Please log in first." };
        }

        if (!caption.trim() || !imageUrl.trim()) {
            return {
                success: false,
                message: "Caption and image URL are required.",
            };
        }

        const newPost: Post = {
            id: `p${Date.now()}`,
            userId: currentUser.id,
            image: imageUrl.trim(),
            caption: caption.trim(),
            likes: 0,
            comments: [],
            createdAt: new Date().toISOString(),
        };

        await fakeCreatePost(newPost);
        setPosts((prev) => [newPost, ...prev]);
        return { success: true };
    };

    const updateProfile = (payload: UpdateProfilePayload) => {
        if (!currentUser) return;

        setUsers((prev) =>
            prev.map((user) => {
                if (user.id !== currentUser.id) return user;

                return {
                    ...user,
                    fullName: payload.fullName?.trim() || user.fullName,
                    bio: payload.bio?.trim() || user.bio,
                    website: payload.website?.trim() || user.website,
                };
            }),
        );
    };

    const sendMessage = async (
        conversationId: string,
        content: string,
    ): Promise<AuthResult> => {
        if (!currentUser) {
            return { success: false, message: "Please log in first." };
        }

        if (!content.trim()) {
            return { success: false, message: "Message is empty." };
        }

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
            prev.map((conversation) => {
                if (conversation.id !== conversationId) return conversation;

                return {
                    ...conversation,
                    lastMessage: sent.content,
                    updatedAt: sent.createdAt,
                };
            }),
        );

        return { success: true };
    };

    const markNotificationsRead = () => {
        setNotifications((prev) =>
            prev.map((item) => ({ ...item, read: true })),
        );
    };

    const searchUsersAndPosts = (query: string) => {
        const normalized = query.trim().toLowerCase();

        if (!normalized) {
            return {
                users,
                posts,
            };
        }

        const foundUsers = users.filter(
            (user) =>
                user.username.toLowerCase().includes(normalized) ||
                user.fullName.toLowerCase().includes(normalized),
        );

        const foundPosts = posts.filter((post) => {
            const author = getUserById(post.userId);
            return (
                post.caption.toLowerCase().includes(normalized) ||
                author?.username.toLowerCase().includes(normalized)
            );
        });

        return {
            users: foundUsers,
            posts: foundPosts,
        };
    };

    const value = useMemo<AppContextValue>(
        () => ({
            users,
            currentUser,
            loggedIn,
            loadingAuth,
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
            login,
            signup,
            signupWithPhone,
            verifySignupOtp,
            requestPasswordReset,
            resetPasswordByOtp,
            logout,
            setThemeMode,
            updateNotificationSetting,
            toggleAllNotifications,
            likePost,
            savePost,
            addComment,
            addPost,
            updateProfile,
            sendMessage,
            markNotificationsRead,
            getUserById,
            getMessagesByConversation,
            searchUsersAndPosts,
        }),
        [
            users,
            currentUser,
            loggedIn,
            loadingAuth,
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
        ],
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used inside AppProvider");
    }
    return context;
}
