import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import pageService, { PageData } from "@/services/pageService";
import { buildS3Url } from "@/utils/s3";
import chatWebsocketService from "@/services/chatWebsocketService";
import pageWebsocketService, { type PageListEvent } from "@/services/pageWebsocketService";

const FB_BG = "#F0F2F5";
const FB_BLUE = colors.primary;

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OWNER:     { label: "Chủ sở hữu", color: "#92400E", bg: "#FEF3C7" },
  ADMIN:     { label: "Quản trị viên", color: "#1E40AF", bg: "#DBEAFE" },
  MODERATOR: { label: "Kiểm duyệt viên", color: "#065F46", bg: "#D1FAE5" },
};

// ─── Card: Discover (full-width, cover + avatar overlap) ───────────────────

function DiscoverCard({
  item,
  onPress,
  onFollow,
  onLike,
  followed,
  following,
  liked,
  liking,
}: {
  item: PageData & { memberCount?: number; followCount?: number };
  onPress: () => void;
  onFollow: () => void;
  onLike: () => void;
  followed: boolean;
  following: boolean;
  liked: boolean;
  liking: boolean;
}) {
  const coverUri = item.coverUrl ? buildS3Url(item.coverUrl) : null;
  const avatarUri = item.avatarUrl ? buildS3Url(item.avatarUrl) : null;

  return (
    <TouchableOpacity style={c.card} activeOpacity={0.93} onPress={onPress}>
      {/* Cover photo */}
      <View style={c.coverWrap}>
        {coverUri ? (
          <Image source={{ uri: `${coverUri}?t=${item.updatedAt}` }} style={c.cover} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={["#1a73e8", "#0d47a1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={c.cover}
          />
        )}

        {/* Privacy badge */}
        {item.status === "PRIVATE" && (
          <View style={c.privacyBadge}>
            <Ionicons name="lock-closed" size={10} color="#fff" />
            <Text style={c.privacyBadgeText}>Riêng tư</Text>
          </View>
        )}
      </View>

      {/* Bottom info section */}
      <View style={c.info}>
        {/* Avatar overlap (positioned over the cover/info boundary) */}
        <View style={c.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: `${avatarUri}?t=${item.updatedAt}` }} style={c.avatar} />
          ) : (
            <View style={[c.avatar, c.avatarPlaceholder]}>
              <Ionicons name="flag" size={22} color={FB_BLUE} />
            </View>
          )}
        </View>

        {/* Text info */}
        <View style={c.textBlock}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={c.pageName} numberOfLines={1}>{item.name}</Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color={FB_BLUE} />
            )}
          </View>

          <View style={c.metaRow}>
            {item.category ? (
              <Text style={c.metaChip}>{item.category}</Text>
            ) : null}
            {item.memberCount !== undefined && item.memberCount > 0 ? (
              <Text style={c.metaCount}>
                {item.category ? " · " : ""}
                {item.memberCount.toLocaleString()} thành viên
              </Text>
            ) : null}
          </View>
        </View>

        {/* Like + Follow buttons */}
        <View style={c.actions}>
          {/* Like (toggle) */}
          <TouchableOpacity
            style={[c.iconBtn, liked && c.iconBtnActive]}
            onPress={onLike}
            disabled={liking}
            activeOpacity={0.75}
          >
            {liking ? (
              <ActivityIndicator size="small" color={liked ? FB_BLUE : colors.textMuted} />
            ) : (
              <Ionicons
                name={liked ? "thumbs-up" : "thumbs-up-outline"}
                size={16}
                color={liked ? FB_BLUE : colors.textMuted}
              />
            )}
          </TouchableOpacity>

          {/* Follow (toggle) */}
          <TouchableOpacity
            style={[c.followBtn, followed && c.followBtnActive]}
            onPress={onFollow}
            disabled={following}
            activeOpacity={0.75}
          >
            {following ? (
              <ActivityIndicator size="small" color={followed ? colors.textMuted : FB_BLUE} />
            ) : (
              <Ionicons
                name={followed ? "checkmark" : "add"}
                size={16}
                color={followed ? colors.textMuted : FB_BLUE}
              />
            )}
            <Text style={[c.followBtnText, followed && c.followBtnTextActive]}>
              {followed ? "Đã theo dõi" : "Theo dõi"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Card: My Pages (horizontal compact row) ───────────────────────────────

function MyPageCard({
  item,
  onPress,
}: {
  item: PageData & { memberCount?: number; userRole?: string };
  onPress: () => void;
}) {
  const avatarUri = item.avatarUrl ? buildS3Url(item.avatarUrl) : null;
  const coverUri = item.coverUrl ? buildS3Url(item.coverUrl) : null;
  const role = item.userRole ? ROLE_CONFIG[item.userRole] : null;

  return (
    <TouchableOpacity style={m.row} activeOpacity={0.9} onPress={onPress}>
      {/* Avatar / Cover thumbnail */}
      <View style={m.thumbWrap}>
        {coverUri ? (
          <Image source={{ uri: `${coverUri}?t=${item.updatedAt}` }} style={m.coverThumb} resizeMode="cover" />
        ) : (
          <LinearGradient colors={["#1a73e8", "#0d47a1"]} style={m.coverThumb} />
        )}
        {/* Avatar overlaying bottom-left of cover thumb */}
        <View style={m.avatarOver}>
          {avatarUri ? (
            <Image source={{ uri: `${avatarUri}?t=${item.updatedAt}` }} style={m.avatar} />
          ) : (
            <View style={[m.avatar, m.avatarPlaceholder]}>
              <Ionicons name="flag" size={14} color={FB_BLUE} />
            </View>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={m.infoBlock}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={m.name} numberOfLines={1}>{item.name}</Text>
          {item.isVerified && <Ionicons name="checkmark-circle" size={13} color={FB_BLUE} />}
        </View>

        {item.category ? (
          <Text style={m.category} numberOfLines={1}>{item.category}</Text>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          {role && (
            <View style={[m.roleBadge, { backgroundColor: role.bg }]}>
              <Text style={[m.roleText, { color: role.color }]}>{role.label}</Text>
            </View>
          )}
          {item.status === "PRIVATE" && (
            <View style={m.lockChip}>
              <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
              <Text style={m.lockText}>Riêng tư</Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.border} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function PagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppContext();

  const [activeTab, setActiveTab] = useState<"discover" | "my-pages">("discover");
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [followingId, setFollowingId] = useState<number | null>(null);
  const [likingId, setLikingId] = useState<number | null>(null);

  // Seed the optimistic like/follow Sets from the per-user state the backend
  // embeds on the discover list (/page/all).
  const seedInteraction = useCallback((data: PageData[], tab: string) => {
    if (tab !== "discover") {
      setFollowedIds(new Set());
      setLikedIds(new Set());
      return;
    }
    const liked = new Set<number>();
    const followed = new Set<number>();
    data.forEach((p) => {
      if (p.isLiked) liked.add(p.id);
      if (p.isFollowing) followed.add(p.id);
    });
    setLikedIds(liked);
    setFollowedIds(followed);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = activeTab === "discover"
        ? await pageService.getAllPages()
        : await pageService.getMyPages();
      setPages(data);
      seedInteraction(data, activeTab);
    } finally {
      setLoading(false);
    }
  }, [activeTab, seedInteraction]);

  useEffect(() => { void loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try { await chatWebsocketService.connect(); } catch {}
      if (cancelled) return;
      pageWebsocketService.subscribeToPageList((event: PageListEvent) => {
        if (event.eventType === "PAGE_CREATED") {
          if (event.page) {
            const np = event.page as unknown as PageData;
            setPages(prev => prev.some(p => p.id === np.id) ? prev : [np, ...prev]);
          } else {
            void loadDataRef.current();
          }
        } else if (event.eventType === "PAGE_DELETED" && event.pageId) {
          setPages(prev => prev.filter(p => p.id !== event.pageId));
        } else if (event.eventType === "PAGE_UPDATED" && event.page) {
          const up = event.page as unknown as PageData;
          setPages(prev => prev.map(p => p.id === up.id ? { ...p, ...up } : p));
        }
      });
    };
    void setup();
    return () => { cancelled = true; pageWebsocketService.unsubscribeFromPageList(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = activeTab === "discover"
        ? await pageService.getAllPages()
        : await pageService.getMyPages();
      setPages(data);
      seedInteraction(data, activeTab);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.toLowerCase();
    return pages.filter(p =>
      p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)
    );
  }, [pages, searchQuery]);

  const handleFollow = async (page: PageData) => {
    if (!currentUser?.id || followingId) return;
    const uid = Number(currentUser.id);
    const wasFollowing = followedIds.has(page.id);
    setFollowingId(page.id);
    // Optimistic toggle
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(page.id);
      else next.add(page.id);
      return next;
    });
    try {
      if (wasFollowing) await pageService.cancelFollowPage(uid, page.id);
      else await pageService.followPage(uid, page.id);
    } catch {
      // Revert on failure
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(page.id);
        else next.delete(page.id);
        return next;
      });
    } finally {
      setFollowingId(null);
    }
  };

  const handleLike = async (page: PageData) => {
    if (!currentUser?.id || likingId) return;
    const uid = Number(currentUser.id);
    const wasLiked = likedIds.has(page.id);
    setLikingId(page.id);
    // Optimistic toggle
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(page.id);
      else next.add(page.id);
      return next;
    });
    try {
      if (wasLiked) await pageService.cancelLikePage(uid, page.id);
      else await pageService.likePage(uid, page.id);
    } catch {
      // Revert on failure
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(page.id);
        else next.delete(page.id);
        return next;
      });
    } finally {
      setLikingId(null);
    }
  };

  const goToDetail = (item: PageData) =>
    router.push({ pathname: "/(stack)/page-detail", params: { pageId: String(item.id) } });

  const renderDiscover = ({ item }: { item: PageData }) => (
    <DiscoverCard
      item={item as any}
      onPress={() => goToDetail(item)}
      onFollow={() => handleFollow(item)}
      onLike={() => handleLike(item)}
      followed={followedIds.has(item.id)}
      following={followingId === item.id}
      liked={likedIds.has(item.id)}
      liking={likingId === item.id}
    />
  );

  const renderMyPage = ({ item }: { item: PageData }) => (
    <MyPageCard item={item as any} onPress={() => goToDetail(item)} />
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Pages</Text>
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color="#8E8E93" />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm kiếm Pages..."
            placeholderTextColor="#8E8E93"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === "discover" && s.tabActive]}
          onPress={() => setActiveTab("discover")}
        >
          <Text style={[s.tabText, activeTab === "discover" && s.tabTextActive]}>
            Khám phá
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "my-pages" && s.tabActive]}
          onPress={() => setActiveTab("my-pages")}
        >
          <Text style={[s.tabText, activeTab === "my-pages" && s.tabTextActive]}>
            Pages của tôi
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={FB_BLUE} />
        </View>
      ) : activeTab === "discover" ? (
        <FlatList
          key="discover"
          data={filteredPages}
          keyExtractor={i => String(i.id)}
          renderItem={renderDiscover}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FB_BLUE} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<EmptyState tab="discover" onCreate={() => router.push("/(stack)/create-page")} />}
        />
      ) : (
        <FlatList
          key="my-pages"
          data={filteredPages}
          keyExtractor={i => String(i.id)}
          renderItem={renderMyPage}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FB_BLUE} />}
          contentContainerStyle={s.listContentCompact}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            filteredPages.length > 0 ? (
              <TouchableOpacity
                style={s.createPageRow}
                onPress={() => router.push("/(stack)/create-page")}
              >
                <View style={s.createPageIcon}>
                  <Ionicons name="add" size={22} color={FB_BLUE} />
                </View>
                <Text style={s.createPageText}>Tạo trang mới</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.border} />
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={<EmptyState tab="my-pages" onCreate={() => router.push("/(stack)/create-page")} />}
        />
      )}
    </View>
  );
}

function EmptyState({ tab, onCreate }: { tab: "discover" | "my-pages"; onCreate: () => void }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Ionicons name="flag-outline" size={36} color={colors.textMuted} />
      </View>
      <Text style={s.emptyTitle}>
        {tab === "discover" ? "Chưa có trang nào" : "Bạn chưa quản lý trang nào"}
      </Text>
      <Text style={s.emptySubtitle}>
        {tab === "discover"
          ? "Hãy quay lại sau hoặc tạo trang của bạn"
          : "Tạo trang để kết nối cộng đồng của bạn"}
      </Text>
      {tab === "my-pages" && (
        <TouchableOpacity style={s.emptyBtn} onPress={onCreate}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.emptyBtnText}>Tạo trang mới</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: FB_BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header (matches Explore "Khám phá" header)
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    letterSpacing: -0.4,
  },

  // Search (matches Explore search bar)
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
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
  searchInput: { flex: 1, fontSize: 15, color: "#1C1C1E", padding: 0 },

  // Tab bar (underline style, same as profile)
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: FB_BLUE },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: FB_BLUE, fontWeight: "700" },

  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  listContentCompact: { paddingBottom: 24 },

  // Create page row (My Pages tab header)
  createPageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    marginBottom: 1,
  },
  createPageIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.zalo50,
    alignItems: "center",
    justifyContent: "center",
  },
  createPageText: { flex: 1, fontSize: 15, fontWeight: "600", color: FB_BLUE },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: "center", lineHeight: 18 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, backgroundColor: FB_BLUE,
  },
  emptyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

// ─── Discover card styles ──────────────────────────────────────────────────

const c = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  coverWrap: { position: "relative" },
  cover: { width: "100%", height: 150 },

  privacyBadge: {
    position: "absolute", bottom: 8, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  privacyBadgeText: { fontSize: 11, color: "#fff", fontWeight: "600" },

  info: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
    paddingBottom: 14,
    paddingTop: 6,
    gap: 10,
  },

  avatarWrap: {
    marginTop: -22,
    marginLeft: 14,
    flexShrink: 0,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 3, borderColor: colors.white,
  },
  avatarPlaceholder: {
    backgroundColor: colors.zalo50,
    alignItems: "center", justifyContent: "center",
  },

  textBlock: { flex: 1, paddingTop: 10 },
  pageName: { fontSize: 15, fontWeight: "700", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 3, flexWrap: "wrap" },
  metaChip: { fontSize: 12, color: colors.textMuted },
  metaCount: { fontSize: 12, color: colors.textMuted },

  actions: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-end", flexShrink: 0,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#EEF0F2",
  },
  iconBtnActive: { backgroundColor: colors.zalo50 },
  followBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.zalo50,
    flexShrink: 0, minWidth: 96, justifyContent: "center",
  },
  followBtnActive: { backgroundColor: "#EEF0F2" },
  followBtnText: { fontSize: 13, fontWeight: "700", color: FB_BLUE },
  followBtnTextActive: { color: colors.textMuted },
});

// ─── My Pages card styles ──────────────────────────────────────────────────

const m = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },

  thumbWrap: {
    position: "relative",
    width: 72,
    height: 52,
    borderRadius: 10,
    overflow: "visible",
    flexShrink: 0,
  },
  coverThumb: { width: 72, height: 52, borderRadius: 10 },
  avatarOver: {
    position: "absolute",
    bottom: -8,
    left: -4,
  },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.white,
  },
  avatarPlaceholder: {
    backgroundColor: colors.zalo50,
    alignItems: "center", justifyContent: "center",
  },

  infoBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  category: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, marginTop: 4,
  },
  roleText: { fontSize: 11, fontWeight: "700" },

  lockChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    marginTop: 4,
  },
  lockText: { fontSize: 11, color: colors.textMuted },
});
