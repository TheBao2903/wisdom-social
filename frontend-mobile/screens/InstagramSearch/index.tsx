import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import userService from "@/services/userService";
import pageService from "@/services/pageService";
import { useBlockNotifications } from "@/hooks/useBlockNotifications";
import type { User } from "@/services/userService";
import type { PageData } from "@/services/pageService";

type TabType = "all" | "users" | "pages";

const TABS: { key: TabType; label: string }[] = [
    { key: "all",   label: "Tất cả"     },
    { key: "users", label: "Người dùng" },
    { key: "pages", label: "Trang"      },
];

type SearchItem =
    | { kind: "user"; data: User }
    | { kind: "page"; data: PageData };

const S3_BASE = "https://cnmt-hk1-amz.s3.ap-southeast-1.amazonaws.com/";

const toImageUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http") || url.startsWith("file://") || url.startsWith("content://")) return url;
    return S3_BASE + url;
};

const buildMixedList = (users: User[], pages: PageData[]): SearchItem[] => {
    const items: SearchItem[] = [];
    const maxLen = Math.max(users.length, pages.length);
    for (let i = 0; i < maxLen; i++) {
        if (i < users.length) items.push({ kind: "user", data: users[i] });
        if (i < pages.length) items.push({ kind: "page", data: pages[i] });
    }
    return items;
};

export default function InstagramSearchScreen() {
    const router = useRouter();
    const { currentUser } = useAppContext();

    const [tab,        setTab]        = useState<TabType>("all");
    const [search,     setSearch]     = useState("");
    const [isLoading,  setIsLoading]  = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [allUsers,   setAllUsers]   = useState<User[]>([]);
    const [allPages,   setAllPages]   = useState<PageData[]>([]);

    const loadData = useCallback(async () => {
        const userId = currentUser?.id;
        if (!userId) return;
        setIsLoading(true);
        try {
            const [users, pages] = await Promise.all([
                userService.getUsersForUser(userId),
                pageService.getAllPages(),
            ]);
            setAllUsers(users.filter((u) => String(u.id) !== String(userId)));
            setAllPages(pages);
        } catch {
        } finally {
            setIsLoading(false);
        }
    }, [currentUser?.id]);

    useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

    const blockTrigger = useBlockNotifications();
    useEffect(() => { void loadData(); }, [blockTrigger, loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    /* ── Filtered results ── */
    const q = search.trim().toLowerCase();
    const matchedUsers = q
        ? allUsers.filter(u =>
            (u.name     && u.name.toLowerCase().includes(q))     ||
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.phone    && u.phone.includes(q))
        )
        : allUsers;
    const matchedPages = q
        ? allPages.filter(p =>
            (p.name     && p.name.toLowerCase().includes(q))           ||
            (p.username && p.username?.toLowerCase().includes(q))      ||
            (p.category && p.category.toLowerCase().includes(q))
        )
        : allPages;

    const results: SearchItem[] =
        tab === "users" ? matchedUsers.map(u => ({ kind: "user", data: u })) :
        tab === "pages" ? matchedPages.map(p => ({ kind: "page", data: p })) :
        buildMixedList(matchedUsers, matchedPages);

    /* ── Row renderers ── */
    const renderItem = ({ item }: { item: SearchItem }) => {
        if (item.kind === "user") {
            const u = item.data;
            return (
                <TouchableOpacity
                    style={s.row}
                    activeOpacity={0.55}
                    onPress={() => router.push({ pathname: "/(tabs)/user-profile", params: { userId: u.id, username: u.username } })}
                >
                    {u.avatarUrl ? (
                        <Image source={{ uri: toImageUrl(u.avatarUrl) }} style={s.avatar} />
                    ) : (
                        <View style={[s.avatar, s.avatarFallback]}>
                            <Ionicons name="person" size={24} color="#AEAEB2" />
                        </View>
                    )}
                    <View style={s.info}>
                        <Text style={s.name} numberOfLines={1}>
                            {u.name || u.fullName || u.username || u.phone}
                        </Text>
                        {u.username && (
                            <Text style={s.sub} numberOfLines={1}>@{u.username}</Text>
                        )}
                    </View>
                    {tab === "all" && (
                        <View style={s.kindBadge}>
                            <Ionicons name="person-outline" size={15} color="#636366" />
                        </View>
                    )}
                </TouchableOpacity>
            );
        }

        const p = item.data;
        return (
            <TouchableOpacity
                style={s.row}
                activeOpacity={0.55}
                onPress={() => router.push({ pathname: "/(stack)/page-detail", params: { pageId: String(p.id) } })}
            >
                {p.avatarUrl ? (
                    <Image source={{ uri: toImageUrl(p.avatarUrl) }} style={s.avatar} />
                ) : (
                    <View style={[s.avatar, s.avatarFallback]}>
                        <Ionicons name="flag" size={24} color="#AEAEB2" />
                    </View>
                )}
                <View style={s.info}>
                    <View style={s.nameRow}>
                        <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                        {p.isVerified && (
                            <Ionicons name="checkmark-circle" size={14} color="#3B82F6" style={{ marginLeft: 4 }} />
                        )}
                    </View>
                    {p.username ? (
                        <Text style={s.sub} numberOfLines={1}>@{p.username}</Text>
                    ) : p.category ? (
                        <Text style={s.sub} numberOfLines={1}>{p.category}</Text>
                    ) : null}
                </View>
                {tab === "all" && (
                    <View style={s.kindBadge}>
                        <Ionicons name="flag-outline" size={15} color="#636366" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    /* ── Empty states ── */
    const EMPTY: Record<TabType, { icon: keyof typeof Ionicons.glyphMap; text: string }> = {
        all:   { icon: "compass-outline", text: search ? "Không tìm thấy kết quả"   : "Chưa có dữ liệu"    },
        users: { icon: "people-outline",  text: search ? "Không tìm thấy người dùng" : "Chưa có người dùng" },
        pages: { icon: "flag-outline",    text: search ? "Không tìm thấy trang"      : "Chưa có trang nào"  },
    };

    /* ── Render ── */
    return (
        <SafeAreaView style={s.screen} edges={["top"]}>

            {/* ── Header ── */}
            <View style={s.header}>
                <Text style={s.headerTitle}>Khám phá</Text>
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
                        placeholder={
                            tab === "users" ? "Tìm kiếm người dùng..." :
                            tab === "pages" ? "Tìm kiếm trang..."      :
                            "Tìm kiếm người dùng, trang..."
                        }
                        placeholderTextColor="#8E8E93"
                        clearButtonMode="while-editing"
                        returnKeyType="search"
                        autoCapitalize="none"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch("")}>
                            <Ionicons name="close-circle" size={16} color="#8E8E93" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── List ── */}
            {isLoading ? (
                <View style={s.center}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item, idx) => `${item.kind}-${item.data.id}-${idx}`}
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
                    contentContainerStyle={results.length === 0 ? s.emptyContainer : { paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
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

/* ── Styles ── */
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

    /* Row */
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#FFFFFF",
        gap: 12,
    },

    /* Avatar */
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        flexShrink: 0,
    },
    avatarFallback: {
        backgroundColor: "#E5E5EA",
        alignItems: "center",
        justifyContent: "center",
    },

    /* Text info */
    info: {
        flex: 1,
        justifyContent: "center",
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
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

    /* Separator */
    sep: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#E5E5EA",
        marginLeft: 16 + AVATAR_SIZE + 12,
    },

    /* Kind badge (only shown in "Tất cả" tab) */
    kindBadge: {
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
