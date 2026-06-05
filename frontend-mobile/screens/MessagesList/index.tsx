import {
    AppHeader,
    CreateGroupModal,
    EmptyState,
    MessageItem,
    SearchBar,
} from "@/components";
import { colors, spacing } from "@/constants";
import { useGroupManagement } from "@/hooks/useGroupManagement";
import { useMessagesController } from "@/hooks/useMessagesController";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import { useAppContext } from "@/context/AppContext";
import chatService from "@/services/chatService";
import type { ChatUserSearchResult } from "@/types/chat";
import { buildConversationDisplayInfo } from "@/utils/conversationDisplayInfo";
import { buildConversationLastMessagePreview } from "@/utils/conversationLastMessagePreview";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    ActivityIndicator,
    Dimensions,
    FlatList,
    GestureResponderEvent,
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_MENU_WIDTH = 420;
const MENU_HEIGHT = 318;
const MENU_MARGIN = 12;
const PREVIEW_HEIGHT = 76;
const PREVIEW_GAP = 12;
const CONTEXT_MENU_OPEN_SOUND_URI =
    "data:audio/wav;base64," +
    "UklGRsQFAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YaAFAAAAAOocSjNePuE7hyzBE/v2aty1ycLC6ci02jz0AhAjKJI3KztOMvweXwXi6g3VW8hVxw7SLOZs/40YZCzvNiI2SCrsFU39duU80zzKLsyL2LnskwRIG1EsWTThMYYl2RHV+g/lztQ0zabPittz7pkEoxl+KSUxNy8v" +
    "JEkSCv2S6MnYp9Ci0W7bFexaAFsUUyRLLactcSVNFiIDku9B3y7VJNNr2cLmn/iqC2Mcvye9K7cnghw7DOb52egj3ALWe9c04Ifu1v8AEfseVCeiKMAizBb0Bgv2CueM3FbYEdsv5AnyKQLCESYePSXhJQggxxQYBoX2tOj23uXaHd0u5anxbAD4DuEaNCLJI24f7BXmCIr6Nu0Y48vdH97040ju" +
    "YPsWCTQVyh2DIdYfFxlpDowBkPSE6SHihd8L4j7p7/NnALAM4hZtHVofaxwjFa0Kr/4C82/pY+O/4bXkxevQ9UsBdwypFYcbOx2RGv0TgwqT/8/0zOvW5cPj1eWz63T0zf43CTMSehgtG/MZCBUoDX4Dbflj8KXpH+ZF5gbq0fCq+U4DZAysEykYRhnmFmcRlAmHAH33s+8y6rLngOh27AHzOfv/" +
    "AycMnRKLFnMXQRVIEDgJBQHF+IvxReya6d3p+uyC8rf5qAFPCbIPBxTHFcEUIBFgC0IErfyW9dzvM+wH63bsSfAC9uX8GQS6CvwPQBMnFJwS2A5VCcIC6/ui9aXwhu2f7APugvGr9t78XwNrCU8OfxGiEpwRkw7mCSQE9/0W+Cnzve8u7qXuDPEa9VT6IwDeBeUKqw7KEA0RcA8pDJcHPgK1/JX3" +
    "avOj8InvNPCL8kr2B/s+AGEF5glWDVkPvg9/DsML1wcnAzD+dfly9YzyC/ER8Zryd/Vc+eH9kQLzBpkKKQ1nDjYOoQzUCRkGzwFk/UX51/Vr8zvyXvLO82L22fnc/QgC+AVPCb8LEQ0pDQkM0Am2BgYDGf9M+/X3YvXL81Lz/fO69V34p/tL//UCVAYbCQ8LBgzvC88Kwgj5BbQCPP/e++P4i/YF" +
    "9XH02PQt9lH4E/s3/nkBkwREB1YJnwoGC4cKLwkdB30EiAF8/pb7Evkh9+j1f/Xp9Rz3/vhm+yP+/gC9AywGHAhoCfoJyQncCEYHKQWvAggAaP0A+/z4gver9oT2D/c++Pr5IPyH/gMBZgOFBToHaAj8CO0IPgj/BkYFNQPwAKL+cfyE+vz48fd19433Nfhh+fr65fz//iQBMAMCBXsGhAcPCBMI" +
    "kgeXBjIFfQOUAZf/pf3f+1/6PfmJ+E34ivg8+Vb6xfty/UH/GAHYAmkEsgWhBikHRQfzBjoGJgXJAzgCigDZ/j39zvug+sL5QPkh+WT5BPr4+i/8mf0h/7EAMwKSA70EowU6BnoGYgb0BTYFNQT/AqQBNwDL/nL9P/xA+4L6DPrl+Qz6f/o3+yn8Sf2I/tf/IwFeAngDZQQZBY0FvAWlBUsFsQTi" +
    "A+YCywGdAGz/Rf41/Uj8ifv/+rH6n/rL+jL7zfuW/IL9iP6c/7AAugGuAoMDLwSsBPYECgXoBJIEDQRgA5ACqQGyALj/w/7d/Q/9Yvzb+3/7UPtR+4H73Pte/AP9w/2W/nX/VgAyAf8BuAJVA9IDKQRZBGAEPwT4A44DBANhAqoB5wAeAFb/lv7k/Uf9w/xd/Bf88vvx+xL8U/yz/C39vP1d/gr/" +
    "vP9uABsBvQFQAs4CNQOCA7IDxQO7A5QDUgP4AogCBgJ3Ad4AQQCk/wv/e/73/YT9JP3Z/KX8ivyI/J38yvwN/WP9yv0+/r7+RP/N/1cA3ABbAc8BNgKNAtMCBwMmAzIDKQMMA94CngJOAvIBiwEcAacAMAC5/0b/2P5x/hX+xv2D/VD9LP0Z/Rb9I/0//Wv9o/3o/Tf+j/7u/lD/tv8bAH8A3wA=";

type MenuState = {
    conversationId: string;
    top: number;
    left: number;
    width: number;
};

const menuActions = [
    { key: "mute", label: "Tắt thông báo", icon: "notifications-off-outline" },
    { key: "pin", label: "Ghim", icon: "pin-outline" },
    { key: "divider-1", divider: true },
    { key: "hidden", label: "Ẩn", icon: "eye-off-outline" },
    { key: "archive", label: "Lưu trữ đoạn chat", icon: "archive-outline" },
    {
        key: "delete",
        label: "Xóa đoạn chat",
        icon: "trash-outline",
        destructive: true,
    },
    { key: "divider-2", divider: true },
    { key: "report", label: "Báo cáo", icon: "flag-outline" },
] as const;

const removedConversationMenuActions = [
    {
        key: "delete",
        label: "Xóa",
        icon: "trash-outline",
        destructive: true,
    },
] as const;

type MenuActionKey = (typeof menuActions)[number]["key"];

function safeParseMemberIds(content?: string | null): number[] {
    if (!content) return [];

    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((value: unknown) => {
                if (typeof value === "object" && value !== null && "id" in value) {
                    return Number((value as { id?: unknown }).id);
                }
                return Number(value);
            })
            .filter((value) => Number.isFinite(value));
    } catch {
        return [];
    }
}

function isCurrentUserRemovedFromConversation(
    conversation:
        | {
              members?: Array<{ userId: number; status?: string }>;
              lastMessage?: {
                  lastMessageType?: string;
                  lastMessageContent?: string | null;
                  lastSenderId?: number;
              } | null;
          }
        | null
        | undefined,
    currentUserId: number,
): boolean {
    const currentMember = conversation?.members?.find(
        (member) => Number(member.userId) === Number(currentUserId),
    );
    if (
        currentMember?.status === "LEFT" ||
        currentMember?.status === "KICKED" ||
        currentMember?.status === "BLOCKED" ||
        currentMember?.status === "GROUP_DISBANDED"
    ) {
        return true;
    }

    const lastMessage = conversation?.lastMessage;
    if (!lastMessage) return false;

    if (lastMessage.lastMessageType === "SYSTEM_DISBAND_GROUP") {
        return true;
    }

    if (
        lastMessage.lastMessageType === "SYSTEM_LEAVE_GROUP" &&
        Number(lastMessage.lastSenderId) === Number(currentUserId)
    ) {
        return true;
    }

    if (
        lastMessage.lastMessageType === "SYSTEM_KICK_MEMBER" ||
        lastMessage.lastMessageType === "SYSTEM_BLOCK_MEMBER"
    ) {
        return safeParseMemberIds(lastMessage.lastMessageContent).some(
            (id) => Number(id) === Number(currentUserId),
        );
    }

    return false;
}

export default function MessagesListScreen() {
    const router = useRouter();
    const segments = useSegments();
    const { currentUser } = useAppContext();
    const { refreshAt, pendingJoinNotice } = useLocalSearchParams<{
        refreshAt?: string;
        pendingJoinNotice?: string;
    }>();
    const insets = useSafeAreaInsets();
    const {
        searchQuery,
        setSearchQuery,
        filteredConversations,
        pinnedConversations,
        isPinLimitReached,
        loading,
        error,
        currentUserId,
        clearUnreadCount,
        pinConversation,
        unpinConversation,
        replacePinnedConversation,
        fetchPinnedConversations,
        deleteConversationForMe,
        hideConversationForMe,
        reload,
        registerPinLimitCallback,
        maxPinnedConversations,
    } = useMessagesController();
    const directPartnerIds = useMemo(
        () =>
            filteredConversations
                .filter((conversation) => conversation.type === "DIRECT")
                .map(
                    (conversation) =>
                        Number(
                            conversation.directPartnerId ??
                                conversation.members?.find(
                                    (member) =>
                                        Number(member.userId) !==
                                        Number(currentUserId),
                                )?.userId,
                        ),
                )
                .filter((id): id is number => Number.isFinite(id) && id > 0),
        [currentUserId, filteredConversations],
    );
    const presenceByUserId = usePresenceStatus(directPartnerIds);

    const {
        availableFriends,
        friendsLoading,
        friendsError,
        isCreateGroupModalOpen,
        isCreatingGroup,
        actionError,
        openCreateGroupModal,
        closeCreateGroupModal,
        createGroup,
    } = useGroupManagement({
        currentUserId,
        selectedConversation: null,
        selectedConversationId: null,
        reloadConversations: reload,
        onSelectConversation: (conversationId) => {
            router.push({
                pathname: "/(stack)/messages/[conversationId]",
                params: { conversationId: String(conversationId) },
            });
        },
    });
    const [menuState, setMenuState] = useState<MenuState | null>(null);
    const [chatUserSearchResult, setChatUserSearchResult] =
        useState<ChatUserSearchResult | null>(null);
    const [chatUserSearchLoading, setChatUserSearchLoading] = useState(false);
    const [selectedChatUserPreview, setSelectedChatUserPreview] =
        useState<ChatUserSearchResult | null>(null);
    const [previewMessageText, setPreviewMessageText] = useState("");
    const [previewSending, setPreviewSending] = useState(false);
    const suppressNextPressRef = useRef(false);
    const menuProgress = useRef(new Animated.Value(0)).current;
    const menuSoundRef = useRef<Audio.Sound | null>(null);

    // --- Pin-limit modal state ---
    const [pinLimitModal, setPinLimitModal] = useState<{
        visible: boolean;
        pendingConversationId: number | null;
        unpinIds: number[];
    }>({ visible: false, pendingConversationId: null, unpinIds: [] });

    // Register callback so the hook calls our modal instead of Alert
    useEffect(() => {
        registerPinLimitCallback((conversationId) => {
            setPinLimitModal({ visible: true, pendingConversationId: conversationId, unpinIds: [] });
        });
        return () => registerPinLimitCallback(null);
    }, [registerPinLimitCallback]);

    const closePinLimitModal = () =>
        //@ts-ignore
        setPinLimitModal({ visible: false, pendingConversationId: null });

    const handleUnpinAndPin = async (unpinId: number, pendingId: number | null) => {
        setPinLimitModal((prev) => ({ ...prev, visible: false }));
        await unpinConversation(unpinId);
        if (pendingId !== null) {
            // Delay slightly to ensure sequential API processing if needed
            setTimeout(async () => {
                await pinConversation(pendingId);
                await fetchPinnedConversations();
            }, 100);
        } else {
            await fetchPinnedConversations();
        }
    };

    const selectedConversation = useMemo(
        () =>
            menuState
                ? filteredConversations.find(
                      (conversation) =>
                          String(conversation.id) === menuState.conversationId,
                  )
                : null,
        [filteredConversations, menuState],
    );
    const selectedConversationDisplayInfo = selectedConversation
        ? buildConversationDisplayInfo({
              conversation: selectedConversation,
              currentUserId,
          })
        : null;
    const selectedConversationPreviewInfo = selectedConversation
        ? buildConversationLastMessagePreview({
              conversation: selectedConversation,
              currentUserId,
          })
        : null;
    const selectedConversationPreview = selectedConversationPreviewInfo
        ? selectedConversationPreviewInfo.showSenderPrefix
            ? `${selectedConversationPreviewInfo.senderLabel}: ${selectedConversationPreviewInfo.text}`
            : selectedConversationPreviewInfo.text
        : "";
    const selectedConversationPinned = selectedConversation
        ? pinnedConversations.some(
              (pin) => pin.conversationId === selectedConversation.id,
          )
        : false;
    const selectedConversationRemoved = isCurrentUserRemovedFromConversation(
        selectedConversation,
        currentUserId,
    );
    const effectiveMenuActions = selectedConversationRemoved
        ? removedConversationMenuActions
        : menuActions;

    useEffect(() => {
        if (!menuState) return;

        const playOpenSound = async () => {
            try {
                const previousSound = menuSoundRef.current;
                menuSoundRef.current = null;
                await previousSound?.unloadAsync();

                const { sound } = await Audio.Sound.createAsync(
                    { uri: CONTEXT_MENU_OPEN_SOUND_URI },
                    { shouldPlay: true, volume: 0.35 },
                );
                menuSoundRef.current = sound;
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        menuSoundRef.current = null;
                        void sound.unloadAsync();
                    }
                });
            } catch {
                menuSoundRef.current = null;
            }
        };

        menuProgress.setValue(0);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void playOpenSound();
        Animated.spring(menuProgress, {
            toValue: 1,
            damping: 18,
            stiffness: 260,
            mass: 0.75,
            useNativeDriver: true,
        }).start();
    }, [menuProgress, menuState]);

    useEffect(() => {
        return () => {
            void menuSoundRef.current?.unloadAsync();
            menuSoundRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!refreshAt) return;
        void reload();
        if (pendingJoinNotice === "1") {
            Alert.alert(
                "Đang chờ phê duyệt",
                "Yêu cầu tham gia nhóm của bạn đã được gửi đến trưởng/phó nhóm.",
            );
        }
    }, [pendingJoinNotice, refreshAt, reload]);

    const phoneSearchDigits = useMemo(
        () => searchQuery.replace(/\D/g, ""),
        [searchQuery],
    );

    useEffect(() => {
        if (phoneSearchDigits.length !== 10) {
            setChatUserSearchResult(null);
            setChatUserSearchLoading(false);
            return;
        }

        let cancelled = false;
        setChatUserSearchLoading(true);
        chatService
            .searchChatUserByPhone(phoneSearchDigits)
            .then((result) => {
                if (!cancelled) setChatUserSearchResult(result);
            })
            .catch(() => {
                if (!cancelled) setChatUserSearchResult(null);
            })
            .finally(() => {
                if (!cancelled) setChatUserSearchLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [phoneSearchDigits]);

    const openChatUserSearchResult = async (result: ChatUserSearchResult) => {
        const existingLocalDirectConversationId =
            result.existingDirectConversationId ??
            filteredConversations.find(
                (conversation) =>
                    conversation.type === "DIRECT" &&
                    conversation.members?.some(
                        (member) => Number(member.userId) === Number(result.userId),
                    ),
            )?.id;

        if (existingLocalDirectConversationId) {
            setSearchQuery("");
            await reload();
            router.push({
                pathname: "/(stack)/messages/[conversationId]",
                params: {
                    conversationId: String(existingLocalDirectConversationId),
                    peerFriendStatus: result.friendStatus,
                    peerMutualGroupsCount: String(result.mutualGroupsCount ?? 0),
                },
            });
            return;
        }
        try {
            const conversation = await chatService.resolveDirectConversation(
                result.userId,
            );
            setSelectedChatUserPreview(null);
            setSearchQuery("");
            await reload();
            router.push({
                pathname: "/(stack)/messages/[conversationId]",
                params: {
                    conversationId: String(conversation.id),
                    peerFriendStatus: result.friendStatus,
                    peerMutualGroupsCount: String(result.mutualGroupsCount ?? 0),
                },
            });
        } catch {
            Alert.alert("Thong bao", "Khong the mo cuoc tro chuyen");
        }
    };

    const sendPreviewMessage = async () => {
        if (!selectedChatUserPreview || !previewMessageText.trim()) return;
        setPreviewSending(true);
        try {
            const message = await chatService.sendMessage(
                {
                    receiverId: selectedChatUserPreview.userId,
                    content: previewMessageText.trim(),
                    type: "TEXT",
                },
                currentUserId,
            );
            setPreviewMessageText("");
            setSelectedChatUserPreview(null);
            setSearchQuery("");
            await reload();
            router.push({
                pathname: "/(stack)/messages/[conversationId]",
                params: { conversationId: String(message.conversationId) },
            });
        } catch {
            Alert.alert("Thong bao", "Khong the gui tin nhan");
        } finally {
            setPreviewSending(false);
        }
    };

    const closeMenu = () => setMenuState(null);

    const handleItemLongPress = (
        event: GestureResponderEvent,
        conversationId: string,
    ) => {
        suppressNextPressRef.current = true;
        const { width, height } = Dimensions.get("window");
        const y = event.nativeEvent.pageY;
        const pressedConversation = filteredConversations.find(
            (conversation) => String(conversation.id) === conversationId,
        );
        const menuHeight = isCurrentUserRemovedFromConversation(
            pressedConversation,
            currentUserId,
        )
            ? 56
            : MENU_HEIGHT;
        const menuWidth = Math.min(MAX_MENU_WIDTH, width - MENU_MARGIN * 2);
        const left = Math.max(MENU_MARGIN, width - menuWidth - MENU_MARGIN);
        const top = Math.min(
            Math.max(insets.top + MENU_MARGIN, y - PREVIEW_HEIGHT - PREVIEW_GAP),
            height -
                insets.bottom -
                menuHeight -
                PREVIEW_HEIGHT -
                PREVIEW_GAP -
                MENU_MARGIN,
        );

        setMenuState({ conversationId, top, left, width: menuWidth });
    };

    const handleMenuAction = (actionKey: MenuActionKey) => {
        if (!menuState) return;

        const conversationId = Number(menuState.conversationId);

        if (actionKey === "hidden") {
            if (Number.isFinite(conversationId)) {
                void hideConversationForMe(conversationId);
            }

            closeMenu();
            return;
        }

        if (actionKey === "delete") {
            if (Number.isFinite(conversationId)) {
                if (selectedConversationRemoved) {
                    void hideConversationForMe(conversationId);
                    closeMenu();
                    return;
                }

                Alert.alert(
                    "Xóa đoạn chat",
                    "Bạn có chắc muốn xóa đoạn chat này chỉ ở phía bạn?",
                    [
                        { text: "Hủy", style: "cancel" },
                        {
                            text: "Xóa",
                            style: "destructive",
                            onPress: () => {
                                void deleteConversationForMe(conversationId);
                            },
                        },
                    ],
                );
            }

            closeMenu();
            return;
        }

        if (actionKey === "pin") {
            const conversationId = Number(menuState.conversationId);
            closeMenu();
            if (!Number.isFinite(conversationId)) return;

            void (selectedConversationPinned
                ? unpinConversation(conversationId).then(() => reload())
                : pinConversation(conversationId).then(() => reload()));
            return;
        }

        const action = menuActions.find((item) => item.key === actionKey);
        if (action && "label" in action) {
            Alert.alert("Thông báo", `Đã chọn ${action.label}.`);
        }

        closeMenu();
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Đoạn chat"
                leftAction={
                    segments[0] === "(stack)"
                        ? { icon: "arrow-back", onPress: () => router.back() }
                        : undefined
                }
                rightActions={[
                    {
                        icon: "qr-code-outline",
                        onPress: () => router.push("/(stack)/qr-scanner"),
                    },
                    {
                        icon: "people-outline",
                        onPress: openCreateGroupModal,
                    },
                ]}
            />

            <View style={styles.searchWrap}>
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Tìm kiếm cuộc trò chuyện..."
                />
            </View>

            <FlatList
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                data={
                    phoneSearchDigits.length === 10 && chatUserSearchResult
                        ? []
                        : filteredConversations
                }
                keyExtractor={(item) => String(item.id)}
                ListHeaderComponent={
                    phoneSearchDigits.length === 10 ? (
                        <View style={styles.searchResultWrap}>
                            {chatUserSearchLoading ? (
                                <ActivityIndicator color="#2563EB" />
                            ) : chatUserSearchResult ? (
                                <Pressable
                                    style={styles.searchUserRow}
                                    onPress={() =>
                                        void openChatUserSearchResult(
                                            chatUserSearchResult,
                                        )
                                    }
                                >
                                    {chatUserSearchResult.avatarUrl ? (
                                        <Image
                                            source={{
                                                uri: chatUserSearchResult.avatarUrl,
                                            }}
                                            style={styles.searchUserAvatar}
                                        />
                                    ) : (
                                        <View style={styles.searchUserFallback}>
                                            <Ionicons
                                                name="person"
                                                size={22}
                                                color="#64748B"
                                            />
                                        </View>
                                    )}
                                    <View style={styles.searchUserTextWrap}>
                                        <Text
                                            style={styles.searchUserName}
                                            numberOfLines={1}
                                        >
                                            {chatUserSearchResult.name}
                                        </Text>
                                        <Text
                                            style={[styles.searchUserMeta, { display: "none" }]}
                                            numberOfLines={1}
                                        >
                                            {chatUserSearchResult.friendStatus ===
                                            "FRIEND"
                                                ? "Ban be"
                                                : "Nguoi la"}
                                            {chatUserSearchResult.mutualGroupsCount >
                                            0
                                                ? ` · Nhom chung (${chatUserSearchResult.mutualGroupsCount})`
                                                : ""}
                                        </Text>
                                    </View>
                                </Pressable>
                            ) : (
                                <Text style={styles.searchUserEmpty}>
                                    Khong tim thay nguoi dung voi so nay
                                </Text>
                            )}
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    phoneSearchDigits.length === 10 && chatUserSearchResult ? null :
                    <EmptyState
                        title={
                            loading
                                ? "Dang tai cuoc tro chuyen"
                                : searchQuery.trim()
                                  ? "Không tìm thấy cuộc trò chuyện"
                                  : "Chưa có cuộc hội thoại"
                        }
                        description={
                            error
                                ? error
                                : searchQuery.trim()
                                  ? "Thử từ khóa khác."
                                  : "Tin nhắn mới sẽ hiển thị ở đây."
                        }
                    />
                }
                renderItem={({ item }) => {
                    // Mapping web -> mobile:
                    // - Display name/avatar: dung cung quy tac resolve conversation display.
                    // - Last message preview: dung cung builder de giu nguyen behavior.
                    const displayInfo = buildConversationDisplayInfo({
                        conversation: item,
                        currentUserId,
                    });
                    const previewInfo = buildConversationLastMessagePreview({
                        conversation: item,
                        currentUserId,
                    });

                    const preview = previewInfo.showSenderPrefix
                        ? `${previewInfo.senderLabel}: ${previewInfo.text}`
                        : previewInfo.text;
                    const isPinned = pinnedConversations.some(
                        (pin) => pin.conversationId === item.id,
                    );
                    const directPartnerId = Number(
                        item.type === "DIRECT"
                            ? item.directPartnerId ??
                              item.members?.find(
                                  (member) =>
                                      Number(member.userId) !== Number(currentUserId),
                              )?.userId
                            : undefined,
                    );
                    const isDirectPartnerUnavailable =
                        item.type === "DIRECT" &&
                        (displayInfo.locked ||
                            Boolean(item.directPartnerLocked) ||
                            Boolean(item.directBlockedByMe) ||
                            Boolean(item.directBlockedMe));
                    const isDirectPartnerOnline = Boolean(
                        Number.isFinite(directPartnerId) &&
                            !isDirectPartnerUnavailable &&
                            presenceByUserId[directPartnerId]?.online,
                    );

                    return (
                        <MessageItem
                            user={{
                                id: String(item.id),
                                username: displayInfo.name,
                                fullName: displayInfo.name,
                                bio: "",
                                avatarUrl: displayInfo.avatarUrl || "",
                                followers: 0,
                                following: 0,
                            }}
                            preview={searchQuery.trim() ? "" : preview}
                            hideMeta={Boolean(searchQuery.trim())}
                            unreadCount={item.unreadCount ?? 0}
                            isPinned={isPinned}
                            online={isDirectPartnerOnline}
                            locked={displayInfo.locked}
                            updatedAt={item.lastMessage?.lastMessageAt ?? item.updatedAt}
                            onPress={() => {
                                if (suppressNextPressRef.current) {
                                    suppressNextPressRef.current = false;
                                    return;
                                }

                                clearUnreadCount(item.id);
                                setSearchQuery("");
                                router.push({
                                    pathname:
                                        "/(stack)/messages/[conversationId]",
                                    params: { conversationId: String(item.id) },
                                });
                            }}
                            onLongPress={(event) =>
                                handleItemLongPress(event, String(item.id))
                            }
                            delayLongPress={300}
                        />
                    );
                }}
            />

            <CreateGroupModal
                open={isCreateGroupModalOpen}
                friends={availableFriends}
                loadingFriends={friendsLoading}
                friendsError={friendsError}
                submitting={isCreatingGroup}
                error={actionError}
                currentUserName={
                    currentUser?.fullName ||
                    currentUser?.name ||
                    currentUser?.username
                }
                onClose={closeCreateGroupModal}
                onSubmit={createGroup}
            />

            <Modal
                visible={Boolean(selectedChatUserPreview)}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedChatUserPreview(null)}
            >
                <View style={styles.previewModalOverlay}>
                    <View style={styles.previewSheet}>
                        <View style={styles.previewHeader}>
                            {selectedChatUserPreview?.avatarUrl ? (
                                <Image
                                    source={{
                                        uri: selectedChatUserPreview.avatarUrl,
                                    }}
                                    style={styles.previewAvatar}
                                />
                            ) : (
                                <View style={styles.previewAvatarFallback}>
                                    <Ionicons
                                        name="person"
                                        size={24}
                                        color="#64748B"
                                    />
                                </View>
                            )}
                            <View style={styles.previewTitleWrap}>
                                <Text style={styles.previewName} numberOfLines={1}>
                                    {selectedChatUserPreview?.name}
                                </Text>
                                <Text style={styles.previewMeta} numberOfLines={1}>
                                    {selectedChatUserPreview?.friendStatus ===
                                    "FRIEND"
                                        ? "Ban be"
                                        : "Nguoi la"}
                                    {selectedChatUserPreview &&
                                    selectedChatUserPreview.mutualGroupsCount > 0
                                        ? ` · Nhom chung (${selectedChatUserPreview.mutualGroupsCount})`
                                        : ""}
                                </Text>
                            </View>
                            <Pressable
                                style={styles.previewCloseBtn}
                                onPress={() => setSelectedChatUserPreview(null)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </Pressable>
                        </View>

                        {selectedChatUserPreview?.friendStatus !== "FRIEND" ? (
                        <View style={styles.previewFriendBar}>
                            <Ionicons
                                name="person-add-outline"
                                size={18}
                                color="#334155"
                            />
                            <Text style={styles.previewFriendText}>
                                Gui yeu cau ket ban toi nguoi nay
                            </Text>
                            <Pressable style={styles.previewFriendBtn}>
                                <Text style={styles.previewFriendBtnText}>
                                    Gui ket ban
                                </Text>
                            </Pressable>
                        </View>
                        ) : null}

                        <Text style={styles.previewHint}>
                            Tin nhan dau tien se tao cuoc hoi thoai rieng.
                        </Text>

                        <View style={styles.previewComposer}>
                            <TextInput
                                value={previewMessageText}
                                onChangeText={setPreviewMessageText}
                                placeholder={
                                    selectedChatUserPreview?.blocked
                                        ? "Khong the nhan tin voi nguoi dung nay"
                                        : "Nhap tin nhan..."
                                }
                                editable={
                                    !previewSending &&
                                    !selectedChatUserPreview?.blocked
                                }
                                style={styles.previewInput}
                                onSubmitEditing={() => void sendPreviewMessage()}
                            />
                            <Pressable
                                style={[
                                    styles.previewSendBtn,
                                    (!previewMessageText.trim() ||
                                        previewSending ||
                                        selectedChatUserPreview?.blocked) &&
                                        styles.previewSendBtnDisabled,
                                ]}
                                disabled={
                                    !previewMessageText.trim() ||
                                    previewSending ||
                                    selectedChatUserPreview?.blocked
                                }
                                onPress={() => void sendPreviewMessage()}
                            >
                                {previewSending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Ionicons
                                        name="send"
                                        size={18}
                                        color={colors.white}
                                    />
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- Pin limit modal --- */}
            <Modal
                visible={pinLimitModal.visible}
                transparent
                animationType="slide"
                onRequestClose={closePinLimitModal}
            >
                <Pressable style={styles.pinModalOverlay} onPress={closePinLimitModal}>
                    <Pressable style={styles.pinModalSheet} onPress={() => undefined}>
                        <View style={styles.pinModalHandle} />
                        <Text style={styles.pinModalTitle}>
                            Ghim tối đa {maxPinnedConversations} trò chuyện
                        </Text>
                        <Text style={styles.pinModalSubtitle}>
                            Để có thể ghim trò chuyện{" "}
                            <Text style={styles.pinModalSubtitleBold}>
                                {(() => {
                                    const conv = filteredConversations.find(
                                        (c) => c.id === pinLimitModal.pendingConversationId,
                                    );
                                    if (!conv) return "này";
                                    const info = buildConversationDisplayInfo({
                                        conversation: conv,
                                        currentUserId,
                                    });
                                    return info.name;
                                })()}
                            </Text>
                            , vui lòng bỏ ghim ít nhất 1 trò chuyện bên dưới
                        </Text>

                        <View style={styles.pinModalList}>
                            {pinnedConversations.map((pin) => {
                                const info = pin.conversation
                                    ? buildConversationDisplayInfo({
                                          conversation: pin.conversation as any,
                                          currentUserId,
                                      })
                                    : null;
                                const displayName = info?.name ?? `Hội thoại ${pin.conversationId}`;
                                const avatarUrl = info?.avatarUrl;
                                
                                const isSelectedToUnpin = pinLimitModal.unpinIds?.includes(pin.conversationId);

                                return (
                                    <View key={pin.conversationId} style={styles.pinModalItem}>
                                        <View style={styles.pinModalItemLeft}>
                                            {avatarUrl ? (
                                                <Image
                                                    source={{ uri: avatarUrl }}
                                                    style={styles.pinModalAvatar}
                                                />
                                            ) : (
                                                <View style={[styles.pinModalAvatar, styles.pinModalAvatarFallback]}>
                                                    <Text style={styles.pinModalAvatarFallbackText}>
                                                        {displayName.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                            <Text style={styles.pinModalItemName} numberOfLines={1}>
                                                {displayName}
                                            </Text>
                                        </View>
                                        <Pressable
                                            style={[
                                                styles.pinModalUnpinBtn,
                                                isSelectedToUnpin && styles.pinModalUnpinBtnSelected
                                            ]}
                                            onPress={() => {
                                                setPinLimitModal(prev => {
                                                    const unpinIds = prev.unpinIds || [];
                                                    const nextUnpinIds = unpinIds.includes(pin.conversationId)
                                                        ? unpinIds.filter((id: number) => id !== pin.conversationId)
                                                        : [...unpinIds, pin.conversationId];
                                                    return { ...prev, unpinIds: nextUnpinIds };
                                                });
                                            }}
                                        >
                                            <Text style={[
                                                styles.pinModalUnpinBtnText,
                                                isSelectedToUnpin && styles.pinModalUnpinBtnTextSelected
                                            ]}>
                                                {isSelectedToUnpin ? "Ghim lại" : "Bỏ ghim"}
                                            </Text>
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>

                        <Pressable
                            style={[
                                styles.pinModalActionBtn,
                                !(pinLimitModal.unpinIds?.length > 0) && styles.pinModalActionBtnDisabled,
                                (pinLimitModal.unpinIds?.length > 0) && styles.pinModalActionBtnActive
                            ]}
                            disabled={!(pinLimitModal.unpinIds?.length > 0)}
                            onPress={async () => {
                                const unpinIds = pinLimitModal.unpinIds || [];
                                const pendingId = pinLimitModal.pendingConversationId;
                                
                                setPinLimitModal({ visible: false, pendingConversationId: null, unpinIds: [] });
                                
                                if (pendingId !== null && unpinIds.length > 0) {
                                    // Use replacePinnedConversation for the first unpin + pin
                                    const firstToUnpin = unpinIds[0];
                                    const othersToUnpin = unpinIds.slice(1);
                                    
                                    // Unpin others first
                                    for (const id of othersToUnpin) {
                                        await unpinConversation(id);
                                    }
                                    
                                    // Swap the last one
                                    await replacePinnedConversation(firstToUnpin, pendingId);
                                    await reload();
                                } else if (unpinIds.length > 0) {
                                    // Only unpinning
                                    for (const id of unpinIds) {
                                        await unpinConversation(id);
                                    }
                                    await reload();
                                }
                            }}
                        >
                            <Text style={[
                                styles.pinModalActionBtnText,
                                (pinLimitModal.unpinIds?.length > 0) && styles.pinModalActionBtnTextActive
                            ]}>
                                Ghim trò chuyện
                            </Text>
                        </Pressable>

                        <Pressable style={styles.pinModalCancelBtn} onPress={closePinLimitModal}>
                            <Text style={styles.pinModalCancelBtnText}>Hủy</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={Boolean(menuState)}
                transparent
                animationType="none"
                onRequestClose={closeMenu}
            >
                <View style={styles.modalRoot}>
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={closeMenu}
                    />

                    {menuState ? (
                        <>
                            {selectedConversationDisplayInfo ? (
                                <Animated.View
                                    style={[
                                        styles.previewCard,
                                        {
                                            top: menuState.top,
                                            left: menuState.left,
                                            width: menuState.width,
                                            opacity: menuProgress,
                                            transform: [
                                                {
                                                    translateY:
                                                        menuProgress.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [12, 0],
                                                        }),
                                                },
                                                {
                                                    scale: menuProgress.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [0.96, 1],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                    pointerEvents="none"
                                >
                                    <MessageItem
                                        user={{
                                            id: menuState.conversationId,
                                            username:
                                                selectedConversationDisplayInfo.name,
                                            fullName:
                                                selectedConversationDisplayInfo.name,
                                            bio: "",
                                            avatarUrl:
                                                selectedConversationDisplayInfo.avatarUrl ||
                                                "",
                                            followers: 0,
                                            following: 0,
                                        }}
                                        preview={selectedConversationPreview}
                                        unreadCount={
                                            selectedConversation?.unreadCount ?? 0
                                        }
                                        isPinned={selectedConversationPinned}
                                        updatedAt={
                                            selectedConversation?.lastMessage?.lastMessageAt ??
                                            selectedConversation?.updatedAt ??
                                            ""
                                        }
                                        onPress={() => undefined}
                                    />
                                </Animated.View>
                            ) : null}

                            <Animated.View
                                style={[
                                    styles.menuCard,
                                    {
                                        top:
                                            menuState.top +
                                            PREVIEW_HEIGHT +
                                            PREVIEW_GAP,
                                        left: menuState.left,
                                        width: menuState.width,
                                        opacity: menuProgress,
                                        transform: [
                                            {
                                                translateY:
                                                    menuProgress.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [12, 0],
                                                    }),
                                            },
                                            {
                                                scale: menuProgress.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0.96, 1],
                                                }),
                                            },
                                        ],
                                    },
                                ]}
                            >
                                {effectiveMenuActions.map((action) => {
                                    if ("divider" in action) {
                                        return (
                                            <View
                                                key={action.key}
                                                style={styles.menuDivider}
                                            />
                                        );
                                    }

                                    const isDestructive =
                                        "destructive" in action &&
                                        Boolean(action.destructive);
                                    const isPinAction = action.key === "pin";
                                    const isDisabled = false; // Luôn cho phép nhấn Ghim để kích hoạt modal đổi ghim khi đạt giới hạn
                                    const label = isPinAction
                                        ? selectedConversationPinned
                                            ? "Bỏ ghim"
                                            : action.label
                                        : action.label;

                                    return (
                                        <Pressable
                                            key={action.key}
                                            style={[
                                                styles.menuItem,
                                                isDisabled &&
                                                    styles.menuItemDisabled,
                                            ]}
                                            disabled={isDisabled}
                                            onPress={() =>
                                                handleMenuAction(action.key)
                                            }
                                        >
                                            <Ionicons
                                                name={action.icon}
                                                size={17}
                                                color={
                                                    isDestructive
                                                        ? "#EF4444"
                                                        : "#111827"
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.menuLabel,
                                                    isDestructive &&
                                                        styles.menuLabelDanger,
                                                    isDisabled &&
                                                        styles.menuLabelDisabled,
                                                ]}
                                            >
                                                {label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </Animated.View>
                        </>
                    ) : null}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    searchWrap: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    searchResultWrap: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    searchUserRow: {
        minHeight: 68,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        paddingHorizontal: 10,
        backgroundColor: "#F8FAFC",
    },
    searchUserAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#E5E7EB",
    },
    searchUserFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E5E7EB",
    },
    searchUserTextWrap: {
        flex: 1,
        minWidth: 0,
        marginLeft: 12,
    },
    searchUserName: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.text,
    },
    searchUserMeta: {
        marginTop: 3,
        fontSize: 12,
        color: colors.textMuted,
    },
    searchUserEmpty: {
        paddingVertical: 18,
        textAlign: "center",
        color: colors.textMuted,
        fontSize: 13,
    },
    previewModalOverlay: {
        flex: 1,
        backgroundColor: colors.white,
    },
    previewSheet: {
        flex: 1,
        paddingTop: 12,
        padding: 16,
        backgroundColor: colors.white,
    },
    previewHeader: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
    },
    previewAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#E5E7EB",
    },
    previewAvatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E5E7EB",
    },
    previewTitleWrap: {
        flex: 1,
        minWidth: 0,
        marginLeft: 12,
    },
    previewName: {
        fontSize: 16,
        fontWeight: "800",
        color: colors.text,
    },
    previewMeta: {
        marginTop: 3,
        fontSize: 12,
        color: colors.textMuted,
    },
    previewCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    previewFriendBar: {
        marginTop: 14,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 12,
        paddingHorizontal: 10,
        backgroundColor: "#F8FAFC",
    },
    previewFriendText: {
        flex: 1,
        fontSize: 13,
        color: "#334155",
    },
    previewFriendBtn: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: "#E5E7EB",
    },
    previewFriendBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1F2937",
    },
    previewHint: {
        paddingVertical: 18,
        textAlign: "center",
        fontSize: 13,
        color: colors.textMuted,
    },
    previewComposer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 22,
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 6,
        backgroundColor: "#F3F4F6",
    },
    previewInput: {
        flex: 1,
        minHeight: 36,
        fontSize: 14,
        color: colors.text,
    },
    previewSendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
    },
    previewSendBtnDisabled: {
        opacity: 0.5,
    },
    modalRoot: {
        flex: 1,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(15, 23, 42, 0.34)",
    },
    previewCard: {
        position: "absolute",
        minHeight: PREVIEW_HEIGHT,
        overflow: "hidden",
        borderRadius: 18,
        backgroundColor: colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 14,
    },
    menuCard: {
        position: "absolute",
        backgroundColor: colors.white,
        borderRadius: 18,
        paddingVertical: 6,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 18,
    },
    menuItem: {
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    menuItemDisabled: {
        opacity: 0.45,
    },
    menuLabel: {
        marginLeft: 12,
        fontSize: 15,
        color: "#111827",
        flex: 1,
    },
    menuLabelDanger: {
        color: "#EF4444",
    },
    menuLabelDisabled: {
        color: "#9CA3AF",
    },
    menuDivider: {
        height: 1,
        backgroundColor: "#EEF0F3",
        marginVertical: 6,
    },
    // --- Pin limit modal styles ---
    pinModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    pinModalSheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 32,
        paddingTop: 12,
    },
    pinModalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#D1D5DB",
        alignSelf: "center",
        marginBottom: 16,
    },
    pinModalTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
        marginBottom: 8,
    },
    pinModalSubtitle: {
        fontSize: 13,
        color: "#6B7280",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 19,
    },
    pinModalSubtitleBold: {
        fontWeight: "600",
        color: "#111827",
    },
    pinModalItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
    },
    pinModalItemLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: 12,
    },
    pinModalAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    pinModalAvatarFallback: {
        backgroundColor: "#3B82F6",
        alignItems: "center",
        justifyContent: "center",
    },
    pinModalAvatarFallbackText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 18,
    },
    pinModalItemName: {
        fontSize: 15,
        fontWeight: "500",
        color: "#111827",
        flex: 1,
    },
    pinModalUnpinBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#F3F4F6",
    },
    pinModalUnpinBtnSelected: {
        backgroundColor: "#EBF5FF",
        borderWidth: 1,
        borderColor: "#3B82F6",
    },
    pinModalUnpinBtnText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#374151",
    },
    pinModalUnpinBtnTextSelected: {
        color: "#3B82F6",
    },
    pinModalActionBtn: {
        marginTop: 16,
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: "center",
    },
    pinModalActionBtnDisabled: {
        backgroundColor: "#E5E7EB",
    },
    pinModalActionBtnActive: {
        backgroundColor: "#006AF5",
    },
    pinModalActionBtnText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#9CA3AF",
    },
    pinModalActionBtnTextActive: {
        color: "#fff",
    },
    pinModalCancelBtn: {
        marginTop: 10,
        paddingVertical: 12,
        alignItems: "center",
    },
    pinModalCancelBtnText: {
        fontSize: 15,
        color: "#374151",
        fontWeight: "500",
    },
    pinModalList: {
        marginVertical: 10,
    },
});
