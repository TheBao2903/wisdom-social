import { colors, spacing } from "@/constants";
import { ProfileStats, User } from "@/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
    user: User;
    stats: ProfileStats;
    onEditProfile: () => void;
};

export default function ProfileHeader({
    user,
    stats,
    onEditProfile,
}: Props) {
    return (
        <View style={styles.container}>
            {/* Avatar + Info Section (Horizontal Layout) */}
            <View style={styles.topSection}>
                {/* Avatar */}
                <View style={styles.avatarColumn}>
                    <UserAvatar uri={user.avatar} name={user.username} size={80} />
                </View>

                {/* Info Column */}
                <View style={styles.infoColumn}>
                    {/* Name & Username */}
                    <Text style={styles.fullName} numberOfLines={1}>
                        {user.fullName || user.username}
                    </Text>
                    <Text style={styles.username} numberOfLines={1}>
                        @{user.username}
                    </Text>

                    {/* Bio */}
                    {user.bio ? (
                        <Text style={styles.bio} numberOfLines={2}>
                            {user.bio}
                        </Text>
                    ) : null}

                    {/* Gender & Birthday */}
                    <View style={styles.metaRow}>
                        {user.gender && (
                            <Text style={styles.metaText}>
                                👥 {user.gender === "MALE" ? "Nam" : user.gender === "FEMALE" ? "Nữ" : "Ẩn"}
                            </Text>
                        )}
                        {user.birthday && (
                            <Text style={styles.metaText}>
                                📅 {user.birthday}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.posts}</Text>
                    <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.followers}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.following}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                </View>
            </View>

            {/* Edit Button */}
            <Pressable style={styles.editButton} onPress={onEditProfile}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>

            {/* Website */}
            {user.website ? (
                <Text style={styles.website} numberOfLines={1}>
                    🔗 {user.website}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    topSection: {
        flexDirection: "row",
        gap: spacing.lg,
        marginBottom: spacing.lg,
    },
    avatarColumn: {
        alignItems: "center",
    },
    infoColumn: {
        flex: 1,
        justifyContent: "center",
    },
    fullName: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
        marginBottom: spacing.xs,
    },
    username: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: "500",
        marginBottom: spacing.xs,
    },
    bio: {
        fontSize: 13,
        color: colors.text,
        lineHeight: 18,
        marginBottom: spacing.xs,
    },
    metaRow: {
        flexDirection: "row",
        gap: spacing.md,
        marginTop: spacing.xs,
    },
    metaText: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: "500",
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
        marginBottom: spacing.xs,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: "500",
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
    },
    editButton: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingVertical: spacing.sm,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    website: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: "500",
    },
});
