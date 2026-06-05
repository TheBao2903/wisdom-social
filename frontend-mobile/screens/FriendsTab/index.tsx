import React, { useEffect, useState, useCallback } from "react";
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
    ScrollView,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import blockService from "@/services/blockService";
import friendService, { FriendUser } from "@/services/friendService";
import { useBlockNotifications } from "@/hooks/useBlockNotifications";
import { useFriendNotifications } from "@/hooks/useFriendNotifications";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import { buildS3Url } from "@/utils/s3";

type TabType = "friends" | "suggestions" | "requests" | "sent" | "blocked";

const TABS: { key: TabType; label: string }[] = [
    { key: "friends",     label: "Bạn bè"   },
    { key: "suggestions", label: "Gợi ý"    },
    { key: "requests",    label: "Lời mời"   },
    { key: "sent",        label: "Đã gửi"    },
    { key: "blocked",     label: "Đã chặn"   },
];

function Avatar({ item, online = false }: { item: FriendUser; online?: boolean }) {
    const uri = item.avatar || (item.avatarUrl ? buildS3Url(item.avatarUrl) : null);
    return (
        <View style={s.avatarWrap}>
            {uri ? (
                <Image source={{ uri }} style={s.avatar} />
            ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                    <Ionicons name="person" size={24} color="#AEAEB2" />
                </View>
            )}
            {online ? <View style={s.onlineDot} /> : null}
        </View>
    );
}

export default function FriendsTabScreen() {
    const router  = useRouter();
    const { currentUser } = useAppContext();
    const myId = Number(currentUser?.id) || 0;

    const [tab,         setTab]         = useState<TabType>("friends");
    const [list,        setList]        = useState<FriendUser[]>([]);
    const [loading,     setLoading]     = useState(false);
    const [refreshing,  setRefreshing]  = useState(false);
    const [search,      setSearch]      = useState("");

    const loadData = useCallback(async () => {
        if (!myId) return;
        setLoading(true);
        try {
            if      (tab === "friends")     setList(await friendService.getFriends(myId));
            else if (tab === "requests")    setList(await friendService.getFriendRequests(myId));
            else if (tab === "sent")        setList(await friendService.getSentRequests(myId));
            else if (tab === "suggestions") setList(await friendService.getFriendSuggestions(myId, 30));
            else                            setList(await blockService.getBlockedUsers(myId));
        } finally {
            setLoading(false);
        }
    }, [myId, tab]);

    const refreshTrigger = useFriendNotifications();
    const blockTrigger = useBlockNotifications();
    useEffect(() => { void loadData(); }, [loadData, refreshTrigger, blockTrigger]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    /* ── Actions ─────────────────────────────────────────────────── */
    const handleAccept = async (senderId: number) => {
        await friendService.acceptFriendRequest(senderId, myId);
        setList(prev => prev.filter(u => u.id !== senderId));
    };
    const handleReject = async (senderId: number) => {
        await friendService.rejectFriendRequest(senderId, myId);
        setList(prev => prev.filter(u => u.id !== senderId));
    };
    const handleCancel = async (targetId: number) => {
        await friendService.cancelFriendRequest(myId, targetId);
        setList(prev => prev.filter(u => u.id !== targetId));
    };
    const handleSend = async (targetId: number) => {
        const ok = await friendService.sendFriendRequest(myId, targetId);
        if (ok) setList(prev => prev.filter(u => u.id !== targetId));
        else Alert.alert("Lỗi", "Không thể gửi lời mời. Vui lòng thử lại.");
    };
    const handleUnblock = (blockedId: number) => {
        Alert.alert("Bỏ chặn", "Bạn có chắc muốn bỏ chặn người dùng này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Bỏ chặn", style: "destructive",
                onPress: async () => {
                    const ok = await blockService.unblockUser(myId, blockedId);
                    if (ok) setList(prev => prev.filter(u => u.id !== blockedId));
                    else Alert.alert("Lỗi", "Không thể bỏ chặn. Vui lòng thử lại.");
                },
            },
        ]);
    };

    /* ── Filter ──────────────────────────────────────────────────── */
    const filtered = search.trim()
        ? list.filter(u => {
            const q = search.toLowerCase();
            return (
                u.name?.toLowerCase().includes(q) ||
                u.username?.toLowerCase().includes(q) ||
                u.phone?.includes(q)
            );
        })
        : list;
    const presenceByUserId = usePresenceStatus(
        tab === "friends" ? filtered.map((user) => user.id) : [],
    );

    /* ── Navigate ────────────────────────────────────────────────── */
    const goProfile = (item: FriendUser) =>
        router.push({ pathname: "/(tabs)/user-profile", params: { userId: String(item.id), username: item.username } });

    /* ── Row renderers ───────────────────────────────────────────── */

    // Tab: Bạn bè — avatar + tên + nút chat bên phải
    const renderFriend = (item: FriendUser) => (
        <TouchableOpacity style={s.row} activeOpacity={0.55} onPress={() => goProfile(item)}>
            <Avatar item={item} online={Boolean(presenceByUserId[item.id]?.online)} />
            <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>
                    {item.name || item.username || item.phone || `User ${item.id}`}
                </Text>
                {item.username && item.name && (
                    <Text style={s.sub} numberOfLines={1}>@{item.username}</Text>
                )}
            </View>
            <TouchableOpacity
                style={s.circleBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleCancel(item.id)}
            >
                <Ionicons name="person-remove-outline" size={18} color="#636366" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    // Tab: Lời mời — avatar + tên + bạn chung + 2 nút dưới
    const renderRequest = (item: FriendUser) => (
        <View style={s.cardRow}>
            <TouchableOpacity style={s.cardTop} activeOpacity={0.6} onPress={() => goProfile(item)}>
                <Avatar item={item} />
                <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>
                        {item.name || item.username || item.phone || `User ${item.id}`}
                    </Text>
                    {(item.mutualFriendsCount ?? 0) > 0 && (
                        <Text style={s.mutual}>{item.mutualFriendsCount} bạn chung</Text>
                    )}
                </View>
            </TouchableOpacity>
            <View style={s.btnRow}>
                <TouchableOpacity style={s.btnPrimary} onPress={() => handleAccept(item.id)}>
                    <Text style={s.btnPrimaryText}>Chấp nhận</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnGray} onPress={() => handleReject(item.id)}>
                    <Text style={s.btnGrayText}>Từ chối</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Tab: Đã gửi — avatar + tên + nút hủy
    const renderSent = (item: FriendUser) => (
        <TouchableOpacity style={s.row} activeOpacity={0.55} onPress={() => goProfile(item)}>
            <Avatar item={item} />
            <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>
                    {item.name || item.username || item.phone || `User ${item.id}`}
                </Text>
                {item.username && item.name && (
                    <Text style={s.sub} numberOfLines={1}>@{item.username}</Text>
                )}
            </View>
            <TouchableOpacity style={s.btnGraySmall} onPress={() => handleCancel(item.id)}>
                <Text style={s.btnGraySmallText}>Hủy</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    // Tab: Gợi ý — avatar + tên + bạn chung + 2 nút
    const renderSuggestion = (item: FriendUser) => (
        <View style={s.cardRow}>
            <TouchableOpacity style={s.cardTop} activeOpacity={0.6} onPress={() => goProfile(item)}>
                <Avatar item={item} />
                <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>
                        {item.name || item.username || item.phone || `User ${item.id}`}
                    </Text>
                    {(item.mutualFriendsCount ?? 0) > 0 && (
                        <Text style={s.mutual}>{item.mutualFriendsCount} bạn chung</Text>
                    )}
                </View>
            </TouchableOpacity>
            <View style={s.btnRow}>
                <TouchableOpacity style={s.btnPrimary} onPress={() => handleSend(item.id)}>
                    <Text style={s.btnPrimaryText}>Kết bạn</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnGray} onPress={() => handleCancel(item.id)}>
                    <Text style={s.btnGrayText}>Xóa</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Tab: Đã chặn
    const renderBlocked = (item: FriendUser) => (
        <TouchableOpacity style={s.row} activeOpacity={0.55} onPress={() => goProfile(item)}>
            <Avatar item={item} />
            <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>
                    {item.name || item.username || item.phone || `User ${item.id}`}
                </Text>
                {item.username && item.name && (
                    <Text style={s.sub} numberOfLines={1}>@{item.username}</Text>
                )}
            </View>
            <TouchableOpacity style={s.btnGraySmall} onPress={() => handleUnblock(item.id)}>
                <Text style={s.btnGraySmallText}>Bỏ chặn</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderItem = ({ item }: { item: FriendUser }) => {
        switch (tab) {
            case "friends":     return renderFriend(item);
            case "requests":    return renderRequest(item);
            case "sent":        return renderSent(item);
            case "suggestions": return renderSuggestion(item);
            case "blocked":     return renderBlocked(item);
        }
    };

    /* ── Empty states ────────────────────────────────────────────── */
    const EMPTY: Record<TabType, { icon: keyof typeof Ionicons.glyphMap; text: string }> = {
        friends:     { icon: "people-outline",      text: "Chưa có bạn bè"       },
        requests:    { icon: "person-add-outline",   text: "Không có lời mời"      },
        sent:        { icon: "send-outline",         text: "Chưa gửi lời mời"      },
        suggestions: { icon: "sparkles-outline",     text: "Không có gợi ý nào"    },
        blocked:     { icon: "ban-outline",          text: search ? "Không tìm thấy" : "Chưa chặn ai" },
    };

    /* ── Render ──────────────────────────────────────────────────── */
    return (
        <SafeAreaView style={s.screen} edges={["top"]}>

            {/* ── Header ── */}
            <View style={s.header}>
                <Text style={s.headerTitle}>Danh bạ</Text>
                <View style={s.headerRight}>
                    <TouchableOpacity style={s.headerIconBtn}>
                        <Ionicons name="search-outline" size={20} color="#1C1C1E" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.headerIconBtn}>
                        <Ionicons name="person-add-outline" size={20} color="#1C1C1E" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Tab chips ── */}
            <View style={s.tabWrap}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.tabScroll}
                >
                    {TABS.map(t => (
                        <TouchableOpacity
                            key={t.key}
                            style={[s.chip, tab === t.key && s.chipActive]}
                            onPress={() => { setTab(t.key); setSearch(""); }}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.chipText, tab === t.key && s.chipTextActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ── Search bar ── */}
            <View style={s.searchWrap}>
                <View style={s.searchBar}>
                    <Ionicons name="search-outline" size={16} color="#8E8E93" />
                    <TextInput
                        style={s.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Tìm kiếm"
                        placeholderTextColor="#8E8E93"
                        clearButtonMode="while-editing"
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch("")}>
                            <Ionicons name="close-circle" size={16} color="#8E8E93" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── List ── */}
            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderItem}
                    ItemSeparatorComponent={() => <View style={s.sep} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    contentContainerStyle={filtered.length === 0 ? s.emptyContainer : { paddingBottom: 32 }}
                    ListEmptyComponent={
                        <View style={s.center}>
                            <Ionicons name={EMPTY[tab].icon} size={56} color="#D1D1D6" />
                            <Text style={s.emptyText}>{EMPTY[tab].text}</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

/* ── Styles ─────────────────────────────────────────────────────────── */
const AVATAR_SIZE = 50;

const s = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },

    /* Header */
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1C1C1E",
        letterSpacing: -0.4,
    },
    headerRight: {
        flexDirection: "row",
        gap: 4,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
    },

    /* Tab chips */
    tabWrap: {
        backgroundColor: "#FFFFFF",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    tabScroll: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: "#F2F2F7",
    },
    chipActive: {
        backgroundColor: colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: "500",
        color: "#3A3A3C",
    },
    chipTextActive: {
        color: "#FFFFFF",
        fontWeight: "600",
    },

    /* Search */
    searchWrap: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#F2F2F7",
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 36,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: "#1C1C1E",
        padding: 0,
    },

    /* Simple row (Bạn bè / Đã gửi / Đã chặn) */
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#FFFFFF",
        gap: 12,
    },

    /* Card row (Lời mời / Gợi ý) — avatar+name on top, buttons below */
    cardRow: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    cardTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    btnRow: {
        flexDirection: "row",
        gap: 8,
        marginTop: 10,
        marginLeft: AVATAR_SIZE + 12,
    },

    /* Avatar */
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        flexShrink: 0,
    },
    avatarWrap: {
        position: "relative",
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        flexShrink: 0,
    },
    avatarFallback: {
        backgroundColor: "#E5E5EA",
        alignItems: "center",
        justifyContent: "center",
    },
    onlineDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        backgroundColor: "#22C55E",
    },

    /* Text info */
    info: {
        flex: 1,
        justifyContent: "center",
    },
    name: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1C1C1E",
        letterSpacing: -0.2,
    },
    sub: {
        fontSize: 13,
        color: "#8E8E93",
        marginTop: 2,
    },
    mutual: {
        fontSize: 13,
        color: "#8E8E93",
        marginTop: 2,
    },

    /* Separator */
    sep: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#E5E5EA",
        marginLeft: 16 + AVATAR_SIZE + 12,
    },

    /* Buttons */
    btnPrimary: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    btnPrimaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    btnGray: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
    },
    btnGrayText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1C1C1E",
    },
    btnGraySmall: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "#F2F2F7",
    },
    btnGraySmallText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1C1C1E",
    },
    circleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
    },

    /* Empty / loading */
    emptyContainer: {
        flexGrow: 1,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 15,
        color: "#8E8E93",
    },
});
