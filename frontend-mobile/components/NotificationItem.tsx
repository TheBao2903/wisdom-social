import { colors, spacing } from "@/constants";
import type { AppNotification, User } from "@/types";
import { formatRelativeTime } from "@/utils/format";
import { buildS3Url } from "@/utils/s3";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
  notification: AppNotification;
  user?: User;
  onPress?: () => void;
};

const notificationIconByType = (type: string) => {
  switch (type) {
    case "REACTION_POST":
    case "REACTION_COMMENT":
    case "REACTION_STORY":
    case "REACTION_NOTE":
    case "like":
      return "heart";
    case "COMMENT_POST":
    case "COMMENT_MENTION":
    case "REPLY_COMMENT":
    case "STORY_REPLY":
    case "comment":
      return "chatbubble-ellipses";
    case "SHARE_POST":
      return "share-social";
    case "TAG_POST":
    case "TAG_COMMENT":
    case "TAG_STORY":
      return "pricetags";
    case "STORY_MENTION":
      return "at";
    default:
      return "notifications";
  }
};

const getFallbackText = (type: string): string => {
  switch (type) {
    case "REACTION_POST":
    case "like":
      return "Đã thích bài viết của bạn";
    case "REACTION_COMMENT":
      return "Đã thích bình luận của bạn";
    case "REACTION_STORY":
      return "Đã thích story của bạn";
    case "REACTION_NOTE":
      return "Đã thích ghi chú của bạn";
    case "COMMENT_POST":
    case "comment":
      return "Đã bình luận bài viết của bạn";
    case "COMMENT_MENTION":
      return "Đã mention bạn trong bình luận";
    case "REPLY_COMMENT":
      return "Đã trả lời bình luận của bạn";
    case "SHARE_POST":
      return "Đã chia sẻ bài viết của bạn";
    case "TAG_POST":
      return "Đã tag bạn trong bài viết";
    case "TAG_COMMENT":
      return "Đã tag bạn trong bình luận";
    case "TAG_STORY":
      return "Đã tag bạn trong story";
    case "STORY_REPLY":
      return "Đã trả lời story của bạn";
    case "STORY_MENTION":
      return "Đã mention bạn trong story";
    default:
      return "Có thông báo mới";
  }
};

const isUnread = (notification: AppNotification): boolean =>
  notification.isRead === false || notification.read === false;

export default function NotificationItem({
  notification,
  user,
  onPress,
}: Props) {
  const unread = isUnread(notification);
  const actorName = user?.username ?? user?.fullName ?? "Someone";
  const content =
    notification.content ||
    notification.message ||
    getFallbackText(notification.type);
  const avatarUrl =
    buildS3Url(notification.metadata?.imageUrl) ||
    buildS3Url(user?.avatarUrl || user?.avatar) ||
    user?.avatarUrl ||
    user?.avatar;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        unread && styles.unread,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatarWrap}>
        <UserAvatar uri={avatarUrl} name={actorName} size={44} />
        <View style={styles.iconBadge}>
          <Ionicons
            name={notificationIconByType(notification.type)}
            size={13}
            color={colors.white}
          />
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.text}>{content}</Text>
        <Text style={[styles.time, unread && styles.unreadTime]}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>
      {unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  unread: {
    backgroundColor: "#F3F8FF",
  },
  pressed: {
    opacity: 0.75,
  },
  avatarWrap: {
    position: "relative",
  },
  iconBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  content: {
    marginLeft: spacing.md,
    flex: 1,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  time: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },
  unreadTime: {
    color: colors.primary,
    fontWeight: "700",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
});
