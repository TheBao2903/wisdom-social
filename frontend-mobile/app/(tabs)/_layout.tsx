import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import chatService from "@/services/chatService";
import chatWebsocketService from "@/services/chatWebsocketService";
import { cancelAccountDeletion } from "@/services/securityService";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

export default function TabsLayout() {
    const { currentUser, loggedIn, deletionPending, deletionRemainingDays, clearDeletionPending, logout } = useAppContext();
    const router = useRouter();
    const pathname = usePathname();
    const [chatUnreadByConversation, setChatUnreadByConversation] = useState<Record<number, number>>({});
    const [chatLastMessageAtByConversation, setChatLastMessageAtByConversation] = useState<Record<number, string>>({});
    const chatUnreadCount = useMemo(
        () => Object.values(chatUnreadByConversation).reduce((sum, count) => sum + count, 0),
        [chatUnreadByConversation],
    );
    const alertShownRef = useRef(false);

    useEffect(() => {
        if (!loggedIn || !deletionPending) return;
        if (alertShownRef.current) return;
        alertShownRef.current = true;

        Alert.alert(
            "⚠️ Tài khoản đang chờ xóa",
            `Tài khoản của bạn sẽ bị xóa vĩnh viễn sau ${deletionRemainingDays ?? 30} ngày. Bạn có muốn hủy yêu cầu xóa không?`,
            [
                { text: "Tiếp tục dùng app", style: "cancel" },
                {
                    text: "Đăng xuất",
                    style: "default",
                    onPress: () => {
                        logout();
                        router.replace("/(auth)/login");
                    },
                },
                {
                    text: "Hủy xóa tài khoản",
                    style: "destructive",
                    onPress: async () => {
                        const result = await cancelAccountDeletion();
                        if (result.success) {
                            clearDeletionPending();
                            Alert.alert("Thành công", "Yêu cầu xóa tài khoản đã được hủy. Tài khoản của bạn sẽ không bị xóa.");
                        } else {
                            alertShownRef.current = false;
                            Alert.alert("Lỗi", result.message || "Không thể hủy yêu cầu xóa tài khoản.");
                        }
                    },
                },
            ],
        );
    }, [loggedIn, deletionPending]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const currentUserId = Number(currentUser?.id);
        if (!loggedIn || !Number.isFinite(currentUserId)) {
            setChatUnreadByConversation({});
            setChatLastMessageAtByConversation({});
            return;
        }

        let disposed = false;
        const loadUnread = async () => {
            try {
                const response = await chatService.getConversations(currentUserId);
                if (disposed || !response.success || !Array.isArray(response.data)) return;
                const next: Record<number, number> = {};
                const nextLastMessageAt: Record<number, string> = {};
                response.data.forEach((conversation) => {
                    next[conversation.id] = conversation.unreadCount ?? 0;
                    nextLastMessageAt[conversation.id] =
                        conversation.lastMessage?.lastMessageAt ??
                        conversation.updatedAt;
                    chatRuntimeStore.setConversation(conversation.id, conversation);
                });
                setChatUnreadByConversation(next);
                setChatLastMessageAtByConversation(nextLastMessageAt);
            } catch {
                // Offline/background refresh: keep the current badge state and retry on the next sync tick.
            }
        };

        const handleConversationUpdate = (conversationId: number, lastMessage: any) => {
            const rawSenderId =
                lastMessage?.lastSenderId ??
                lastMessage?.senderId ??
                lastMessage?.sender?.id;
            const lastSenderId = Number(rawSenderId);
            const lastMessageAt =
                lastMessage?.lastMessageAt ??
                lastMessage?.createdAt ??
                lastMessage?.updatedAt ??
                new Date().toISOString();
            const patchedConversation = chatRuntimeStore.patchConversation(conversationId, {
                updatedAt: lastMessageAt,
                lastMessage: {
                    ...lastMessage,
                    lastMessageAt,
                    read:
                        Number.isFinite(lastSenderId) &&
                        lastSenderId === currentUserId
                            ? true
                            : Boolean(lastMessage?.read),
                },
            });
            if (!patchedConversation) {
                void chatService
                    .getConversation(conversationId, currentUserId)
                    .then((response) => {
                        if (!response.success || !response.data) return;
                        chatRuntimeStore.setConversation(conversationId, response.data);
                    })
                    .catch(() => undefined);
            }
            setChatLastMessageAtByConversation((prev) => ({
                ...prev,
                [conversationId]: lastMessageAt,
            }));
            if (Number.isFinite(lastSenderId) && lastSenderId === currentUserId) {
                return;
            }
            setChatUnreadByConversation((prev) => ({
                ...prev,
                [conversationId]: (prev[conversationId] ?? 0) + 1,
            }));
        };

        void loadUnread();
        const syncIntervalId = setInterval(() => {
            void loadUnread();
        }, 10000);
        void chatWebsocketService.connect().then(() => {
            if (!disposed) {
                chatWebsocketService.subscribeToUserConversations(currentUserId, handleConversationUpdate);
            }
        }).catch(() => undefined);

        return () => {
            disposed = true;
            clearInterval(syncIntervalId);
            chatWebsocketService.unsubscribeFromUserConversations(currentUserId, handleConversationUpdate);
        };
    }, [currentUser?.id, loggedIn, pathname]);

    useEffect(() => {
        const currentUserId = Number(currentUser?.id);
        if (!loggedIn || !Number.isFinite(currentUserId)) return;

        const unreadConversationIds = Object.entries(chatUnreadByConversation)
            .filter(([, count]) => count > 0)
            .map(([conversationId]) => Number(conversationId))
            .filter((conversationId) => Number.isFinite(conversationId));

        if (unreadConversationIds.length === 0) return;

        let disposed = false;
        const handleMessageSeen = (event: any) => {
            const payload = event?.messageSeenResponse;
            if (Number(payload?.userId) !== currentUserId) return;
            const conversationId = Number(payload?.conversationId);
            if (!Number.isFinite(conversationId)) return;
            const seenTime = new Date(payload?.seenAt ?? "").getTime();
            const lastMessageTime = new Date(
                chatLastMessageAtByConversation[conversationId] ?? "",
            ).getTime();
            if (Number.isNaN(seenTime) || Number.isNaN(lastMessageTime)) {
                return;
            }
            if (seenTime < lastMessageTime) {
                return;
            }
            setChatUnreadByConversation((prev) => ({
                ...prev,
                [conversationId]: 0,
            }));
        };

        void chatWebsocketService.connect().then(() => {
            if (disposed) return;
            unreadConversationIds.forEach((conversationId) => {
                chatWebsocketService.subscribeToConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        }).catch(() => undefined);

        return () => {
            disposed = true;
            unreadConversationIds.forEach((conversationId) => {
                chatWebsocketService.unsubscribeFromConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        };
    }, [chatLastMessageAtByConversation, chatUnreadByConversation, currentUser?.id, loggedIn]);

    if (!loggedIn) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: true,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: "600",
                    marginTop: -2,
                },
                tabBarStyle: {
                    borderTopColor: colors.border,
                    backgroundColor: colors.white,
                    height: 64,
                    paddingBottom: 8,
                    paddingTop: 6,
                },
                tabBarIcon: ({ color, size, focused }) => {
                    let icon: keyof typeof Ionicons.glyphMap = "ellipse";

                    if (route.name === "activity")
                        icon = focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline";
                    if (route.name === "friends")
                        icon = focused ? "people" : "people-outline";
                    if (route.name === "index")
                        icon = focused ? "home" : "home-outline";
                    if (route.name === "explore")
                        icon = focused ? "compass" : "compass-outline";
                    if (route.name === "profile")
                        icon = focused ? "person-circle" : "person-circle-outline";

                    return <Ionicons name={icon} color={color} size={size} />;
                },
            })}
        >
            <Tabs.Screen name="activity" options={{ tabBarLabel: "Tin nhắn", tabBarBadge: chatUnreadCount > 0 ? (chatUnreadCount > 99 ? "99+" : chatUnreadCount) : undefined }} />
            <Tabs.Screen name="friends" options={{ tabBarLabel: "Bạn bè" }} />
            <Tabs.Screen name="index" options={{ tabBarLabel: "Tường nhà" }} />
            <Tabs.Screen name="explore" options={{ tabBarLabel: "Khám phá" }} />
            <Tabs.Screen name="profile" options={{ tabBarLabel: "Cá nhân" }} />
            <Tabs.Screen name="pages" options={{ href: null }} />
            <Tabs.Screen name="user-profile" options={{ href: null }} />
            <Tabs.Screen name="search" options={{ href: null }} />
            <Tabs.Screen name="add" options={{ href: null }} />
        </Tabs>
    );
}

