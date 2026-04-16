import { colors, spacing } from "@/constants";
import { User } from "@/types";
import { formatRelativeTime } from "@/utils/format";
import {
    GestureResponderEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
    user: User;
    preview: string;
    updatedAt: string;
    unreadCount?: number;
    onPress: () => void;
    onLongPress?: (event: GestureResponderEvent) => void;
    delayLongPress?: number;
};

export default function MessageItem({
    user,
    preview,
    updatedAt,
    unreadCount = 0,
    onPress,
    onLongPress,
    delayLongPress = 300,
}: Props) {
    const hasUnread = unreadCount > 0;

    return (
        <Pressable
            style={styles.container}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={delayLongPress}
        >
            <UserAvatar uri={user.avatar} name={user.username} size={52} />
            <View style={styles.content}>
                <Text style={[styles.name, hasUnread && styles.nameUnread]}>
                    {user.username}
                </Text>
                <Text
                    numberOfLines={1}
                    style={[styles.preview, hasUnread && styles.previewUnread]}
                >
                    {preview}
                </Text>
            </View>
            <View style={styles.rightMeta}>
                <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                    {formatRelativeTime(updatedAt)}
                </Text>
                {hasUnread ? (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                    </View>
                ) : null}
            </View>
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
    },
    content: {
        marginLeft: spacing.md,
        flex: 1,
    },
    name: {
        fontWeight: "600",
        color: colors.text,
        fontSize: 15,
    },
    nameUnread: {
        fontWeight: "700",
    },
    preview: {
        marginTop: 2,
        color: colors.textMuted,
        fontSize: 13,
    },
    previewUnread: {
        color: colors.text,
        fontWeight: "600",
    },
    rightMeta: {
        alignItems: "flex-end",
        justifyContent: "center",
        minWidth: 52,
    },
    time: {
        fontSize: 12,
        color: colors.textMuted,
    },
    timeUnread: {
        color: colors.text,
        fontWeight: "600",
    },
    unreadBadge: {
        marginTop: 6,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
    },
    unreadBadgeText: {
        color: colors.white,
        fontSize: 11,
        fontWeight: "700",
    },
});
