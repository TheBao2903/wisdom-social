import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    Alert,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import blockService from "@/services/blockService";
import friendService, { FriendUser } from "@/services/friendService";
import { useBlockNotifications } from "@/hooks/useBlockNotifications";
import { useFriendNotifications } from "@/hooks/useFriendNotifications";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";

type TabType = "friends" | "requests" | "sent" | "blocked" | "suggestions";

export default function FriendsListScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser } = useAppContext();
    const params = useLocalSearchParams<{ userId?: string; tab?: string }>();

    const [tab, setTab] = useState<TabType>(
        params.tab === "requests" || params.tab === "sent" || params.tab === "blocked" || params.tab === "suggestions"
            ? params.tab
            : "friends",
    );
    const [list, setList] = useState<FriendUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const numericUserId = useMemo(() => {
        const sourceId = params.userId ?? currentUser?.id;
        const id = Number(sourceId);
        return Number.isFinite(id) ? id : null;
    }, [params.userId, currentUser?.id]);

    const isCurrentUser = useMemo(
        () => numericUserId === Number(currentUser?.id),
        [numericUserId, currentUser?.id],
    );

    const loadData = useCallback(async () => {
        const actingUserId = numericUserId ?? 0;

        setLoading(true);
        try {
            if (tab === "friends") {
                setList(await friendService.getFriends(actingUserId));
            } else if (tab === "requests") {
                setList(await friendService.getFriendRequests(actingUserId));
            } else if (tab === "sent") {
                setList(await friendService.getSentRequests(actingUserId));
            } else if (tab === "suggestions") {
                setList(await friendService.getFriendSuggestions(actingUserId, 30));
            } else {
                setList(await blockService.getBlockedUsers(actingUserId));
            }
        } finally {
            setLoading(false);
        }
    }, [numericUserId, tab]);

    const handleSendRequest = async (targetId: number) => {
        const myId = numericUserId ?? 0;
        const ok = await friendService.sendFriendRequest(myId, targetId);
        if (ok) {
            setList((prev) => prev.filter((u) => u.id !== targetId));
        } else {
            Alert.alert("Lỗi", "Không thể gửi lời mời. Vui lòng thử lại.");
        }
    };

    const handleAccept = async (senderId: number) => {
        const myId = numericUserId ?? 0;
        await friendService.acceptFriendRequest(senderId, myId);
        setList((prev) => prev.filter((u) => u.id !== senderId));
    };

    const handleReject = async (senderId: number) => {
        const myId = numericUserId ?? 0;
        await friendService.rejectFriendRequest(senderId, myId);
        setList((prev) => prev.filter((u) => u.id !== senderId));
    };

    const handleCancel = async (targetId: number) => {
        const myId = numericUserId ?? 0;
        await friendService.cancelFriendRequest(myId, targetId);
        setList((prev) => prev.filter((u) => u.id !== targetId));
    };

    const handleUnblock = (blockedId: number) => {
        Alert.alert("Bỏ chặn", "Bạn có chắc muốn bỏ chặn người dùng này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Bỏ chặn",
                style: "destructive",
                onPress: async () => {
                    const myId = numericUserId ?? 0;
                    const ok = await blockService.unblockUser(myId, blockedId);
                    if (ok) {
                        setList((prev) => prev.filter((u) => u.id !== blockedId));
                    } else {
                        Alert.alert("Lỗi", "Không thể bỏ chặn. Vui lòng thử lại.");
                    }
                },
            },
        ]);
    };

    const filteredList = list.filter((user) => {
        if (tab !== "blocked" || !searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            user.name?.toLowerCase().includes(query) ||
            user.username?.toLowerCase().includes(query) ||
            user.phone?.includes(query)
        );
    });
    const presenceByUserId = usePresenceStatus(filteredList.map((user) => user.id));

    const refreshTrigger = useFriendNotifications();
    const blockTrigger = useBlockNotifications();

    useEffect(() => {
        void loadData();
    }, [loadData, refreshTrigger, blockTrigger]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData]),
    );

    const getHeaderTitle = () => {
        switch (tab) {
            case "friends":
                return "Bạn bè";
            case "requests":
                return "Lời mời kết bạn";
            case "sent":
                return "Đã gửi";
            case "blocked":
                return "Đã chặn";
            case "suggestions":
                return "Gợi ý kết bạn";
            default:
                return "Bạn bè";
        }
    };

    const renderFriendItem = ({ item }: { item: FriendUser }) => (
        <View style={styles.friendItem}>
            <TouchableOpacity
                style={styles.friendInfo}
                onPress={() =>
                    router.push({
                        pathname: "/(tabs)/user-profile",
                        params: { userId: String(item.id), username: item.username },
                    })
                }
            >
                <View style={styles.avatarWrap}>
                    {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={30} color="#9CA3AF" />
                        </View>
                    )}
                    {presenceByUserId[item.id]?.online ? (
                        <View style={styles.onlineDot} />
                    ) : null}
                </View>
                <View style={styles.textInfo}>
                    <Text style={styles.name}>
                        {item.name || item.username || item.phone || `User ${item.id}`}
                    </Text>
                    {item.username && item.name && (
                        <Text style={styles.username}>@{item.username}</Text>
                    )}
                    {tab === "suggestions" && (item.mutualFriendsCount ?? 0) > 0 && (
                        <Text style={styles.mutualText}>
                            {item.mutualFriendsCount} bạn chung
                        </Text>
                    )}
                </View>
            </TouchableOpacity>

            {tab === "friends" && (
                <TouchableOpacity
                    style={styles.unfriendButton}
                    onPress={() => handleCancel(item.id)}
                >
                    <Ionicons name="person-remove" size={20} color={colors.danger} />
                </TouchableOpacity>
            )}
            {tab === "requests" && (
                <View style={styles.requestActions}>
                    <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAccept(item.id)}
                    >
                        <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleReject(item.id)}
                    >
                        <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
            {tab === "sent" && (
                <TouchableOpacity
                    style={styles.unfriendButton}
                    onPress={() => handleCancel(item.id)}
                >
                    <Ionicons name="close" size={20} color={colors.danger} />
                </TouchableOpacity>
            )}
            {tab === "blocked" && (
                <TouchableOpacity
                    style={styles.unblockButton}
                    onPress={() => handleUnblock(item.id)}
                >
                    <Text style={styles.unblockText}>Bỏ chặn</Text>
                </TouchableOpacity>
            )}
            {tab === "suggestions" && (
                <TouchableOpacity
                    style={styles.addFriendButton}
                    onPress={() => handleSendRequest(item.id)}
                >
                    <Ionicons name="person-add" size={16} color="#fff" />
                    <Text style={styles.addFriendText}>Kết bạn</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, tab === "friends" && styles.tabActive]}
                    onPress={() => {
                        setTab("friends");
                        setSearchQuery("");
                    }}
                >
                    <Text
                        style={[
                            styles.tabText,
                            tab === "friends" && styles.tabTextActive,
                        ]}
                    >
                        Bạn bè
                    </Text>
                </TouchableOpacity>

                {isCurrentUser && (
                    <>
                        <TouchableOpacity
                            style={[styles.tab, tab === "suggestions" && styles.tabActive]}
                            onPress={() => {
                                setTab("suggestions");
                                setSearchQuery("");
                            }}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    tab === "suggestions" && styles.tabTextActive,
                                ]}
                            >
                                Gợi ý
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, tab === "requests" && styles.tabActive]}
                            onPress={() => {
                                setTab("requests");
                                setSearchQuery("");
                            }}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    tab === "requests" && styles.tabTextActive,
                                ]}
                            >
                                Lời mời
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, tab === "sent" && styles.tabActive]}
                            onPress={() => {
                                setTab("sent");
                                setSearchQuery("");
                            }}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    tab === "sent" && styles.tabTextActive,
                                ]}
                            >
                                Đã gửi
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, tab === "blocked" && styles.tabActive]}
                            onPress={() => {
                                setTab("blocked");
                                setSearchQuery("");
                            }}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    tab === "blocked" && styles.tabTextActive,
                                ]}
                            >
                                Đã chặn
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {tab === "blocked" && (
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm trong danh sách chặn..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : filteredList.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons
                        name={
                            tab === "friends"
                                ? "people-outline"
                                : tab === "requests"
                                  ? "person-add-outline"
                                  : tab === "sent"
                                    ? "send-outline"
                                    : tab === "suggestions"
                                      ? "sparkles-outline"
                                      : "ban-outline"
                        }
                        size={60}
                        color="#D1D5DB"
                    />
                    <Text style={styles.emptyText}>
                        {tab === "friends"
                            ? "Chưa có bạn bè"
                            : tab === "requests"
                              ? "Không có lời mời"
                              : tab === "sent"
                                ? "Chưa gửi lời mời"
                                : tab === "suggestions"
                                  ? "Chưa có gợi ý nào"
                                  : searchQuery
                                    ? "Không tìm thấy"
                                    : "Chưa chặn ai"}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredList}
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => String(item.id)}
                    scrollEnabled={true}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.text,
    },
    placeholder: {
        width: 40,
    },
    tabs: {
        flexDirection: "row",
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabActive: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: "500",
        color: colors.textMuted,
    },
    tabTextActive: {
        color: colors.primary,
        fontWeight: "600",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 80,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 15,
        color: colors.textMuted,
    },
    friendItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.surface,
    },
    friendInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    avatarWrap: {
        position: "relative",
        marginRight: 12,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    onlineDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: colors.background,
        backgroundColor: "#22C55E",
    },
    textInfo: {
        flex: 1,
    },
    name: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 2,
    },
    username: {
        fontSize: 13,
        color: colors.textMuted,
    },
    unfriendButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#FEF2F2",
    },
    requestActions: {
        flexDirection: "row",
        gap: 8,
    },
    acceptButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: colors.success,
    },
    rejectButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: colors.danger,
    },
    unblockButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "#FEF2F2",
    },
    unblockText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.danger,
    },
    mutualText: {
        fontSize: 12,
        color: colors.primary,
        marginTop: 2,
    },
    addFriendButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    addFriendText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#fff",
    },
});
