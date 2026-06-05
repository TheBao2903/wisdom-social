import {
  AppHeader,
  EmptyState,
  PostCard,
  StoriesBar,
  CreateOptionModal,
  NotificationBell,
} from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function FeedScreen() {
  const router = useRouter();
  const {
    posts,
    currentUser,
    upsertUsers,
    loggedIn,
    likedPostIds,
    savedPostIds,
    likePost,
    savePost,
    addComment,
    getUserById,
    refreshPosts,
    loadMorePosts,
    hasMorePosts,
    loadingMorePosts,
    removePost,
    updatePostPrivacyLocal,
  } = useAppContext();
  const [refreshing, setRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const da = new Date(a.rankingTime || a.createdAt).getTime();
        const db = new Date(b.rankingTime || b.createdAt).getTime();
        if (Number.isNaN(da) || Number.isNaN(db)) return 0;
        return db - da;
      }),
    [posts]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshPosts();
    } finally {
      setRefreshing(false);
    }
  }, [refreshPosts]);

  const handleCreateOption = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Wisdom Social"
        leftActions={[
          { icon: "flag-outline", onPress: () => router.push("/(tabs)/pages") },
          { icon: "add-outline", onPress: handleCreateOption },
        ]}
        rightActions={[
          {
            icon: "scan-outline",
            onPress: () => router.push("/(stack)/qr-scanner"),
          },
        ]}
        notificationBell={<NotificationBell />}
      />

      <FlatList
        data={sortedPosts}
        keyExtractor={(item) => item.id}
        extraData={{ likedPostIds, savedPostIds }}
        ListHeaderComponent={
          <StoriesBar
            currentUser={currentUser}
            onUsersLoaded={upsertUsers}
            refreshing={refreshing}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {refreshing ? (
              <ActivityIndicator color={colors.primary} />
            ) : loggedIn ? (
              <EmptyState
                title="Chưa có bài viết"
                description="Hãy theo dõi bạn bè hoặc tạo bài viết mới để xem bảng tin."
              />
            ) : (
              <Text style={styles.loginText}>
                Vui lòng đăng nhập để xem bài viết
              </Text>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (hasMorePosts && !loadingMorePosts) {
            void loadMorePosts();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMorePosts ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingMoreText}>Đang tải thêm...</Text>
            </View>
          ) : !hasMorePosts && posts.length > 0 ? (
            <Text style={styles.endOfFeed}>Bạn đã xem hết bài viết</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard
            key={`${item.id}-${likedPostIds.includes(item.id)}-${savedPostIds.includes(item.id)}`}
            post={item}
            author={item.user || getUserById(item.userId)}
            currentUserId={currentUser?.id}
            liked={likedPostIds.includes(item.id) || item.isLiked}
            saved={savedPostIds.includes(item.id) || item.isSaved}
            onLike={(reactionType, isToggleOff) => void likePost(item.id, reactionType, isToggleOff)}
            onSave={() => void savePost(item.id)}
            onAddComment={(content) => void addComment(item.id, content)}
            onDeleted={removePost}
            onPrivacyChanged={updatePostPrivacyLocal}
            onOpenPost={(postId) =>
              router.push({
                pathname: "/(stack)/post/[postId]" as any,
                params: { postId },
              })
            }
          />
        )}
      />

      <CreateOptionModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreatePost={() => {
          setCreateModalOpen(false);
          router.push("/(stack)/create-post" as any);
        }}
        onCreateStory={() => {
          setCreateModalOpen(false);
          router.push("/(stack)/create-story" as any);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  emptyWrap: { paddingVertical: spacing.xxl },
  loginText: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.xl,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingMoreText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  endOfFeed: {
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuText: { color: colors.text, fontWeight: "600", fontSize: 15 },
});
