import { AppHeader, EmptyState, NotificationItem } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "@/services/notificationService";
import type { AppNotification } from "@/types";
import { useRouter, useSegments } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const parsePostIdFromDeepLink = (deepLink?: string): string | undefined => {
  if (!deepLink) return undefined;
  const clean = deepLink.split("?")[0].replace(/\/+$/, "");
  const segments = clean.split("/").filter(Boolean);
  return segments[segments.length - 1];
};

const parseExtraData = (extraData?: string): { commentId?: string } => {
  if (!extraData) return {};
  try {
    const parsed = JSON.parse(extraData) as { commentId?: string };
    return parsed || {};
  } catch {
    return {};
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const segments = useSegments();
  const {
    getUserById,
    markNotificationsRead,
  } = useAppContext();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const remoteNotifications = await getNotifications(0, 50);
      // Deduplicate by ID to avoid showing same notification twice
      const uniqueMap = new Map<string, AppNotification>();
      remoteNotifications.forEach(n => uniqueMap.set(n.id, n));
      setNotifications(Array.from(uniqueMap.values()));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    markNotificationsRead();
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, isRead: true, read: true }))
    );
    await markAllAsRead();
  };

  const resolveActorId = (notification: AppNotification): string | undefined =>
    notification.actorIds?.[0] || notification.userId;

  const handleNotificationPress = async (notification: AppNotification) => {
    if (notification.isRead === false || notification.read === false) {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true, read: true }
            : item
        )
      );
      await markAsRead(notification.id);
    }

    const deepLink = notification.metadata?.deepLink;
    const postId =
      notification.postId ||
      notification.targetId ||
      parsePostIdFromDeepLink(deepLink);
    const { commentId } = parseExtraData(notification.metadata?.extraData);

    if (
      postId &&
      ["POST", "COMMENT", "POST_SHARE", undefined].includes(
        notification.targetType
      )
    ) {
      router.push({
        pathname: "/(stack)/post/[postId]" as any,
        params: {
          postId,
          ...(commentId ? { commentId } : {}),
        },
      });
      return;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Thông báo"
        leftAction={
          segments[0] === "(stack)"
            ? { icon: "arrow-back", onPress: () => router.back() }
            : undefined
        }
      />
      <View style={styles.toolbar}>
        <Text style={styles.title}>Hoạt động gần đây</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markAllText}>Đánh dấu đã đọc</Text>
        </TouchableOpacity>
      </View>
      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>Đang tải thông báo...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              user={getUserById(resolveActorId(item) || "")}
              onPress={() => void handleNotificationPress(item)}
            />
          )}
          ListEmptyComponent={<EmptyState title="Chưa có thông báo" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  mutedText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
});
