import { colors, spacing } from "@/constants";
import { AppNotification, User } from "@/types";
import { formatRelativeTime } from "@/utils/format";
import { StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
    notification: AppNotification;
    user?: User;
};

export default function NotificationItem({ notification, user }: Props) {
    return (
        <View style={[styles.container, !notification.read && styles.unread]}>
            <UserAvatar
                uri={user?.avatar}
                name={user?.username ?? "?"}
                size={40}
            />
            <View style={styles.content}>
                <Text style={styles.text}>
                    <Text style={styles.username}>
                        {user?.username ?? "Someone"}
                    </Text>{" "}
                    {notification.message}
                </Text>
                <Text style={styles.time}>
                    {formatRelativeTime(notification.createdAt)}
                </Text>
            </View>
        </View>
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
    content: {
        marginLeft: spacing.md,
        flex: 1,
    },
    text: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    username: {
        fontWeight: "700",
    },
    time: {
        marginTop: 2,
        color: colors.textMuted,
        fontSize: 12,
    },
});
