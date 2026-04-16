import { colors, spacing } from "@/constants";
import { ProfileStats, User } from "@/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
    user: User;
    stats: ProfileStats;
    onEditProfile: () => void;
    onOpenMenu: () => void;
};

export default function ProfileHeader({
    user,
    stats,
    onEditProfile,
    onOpenMenu,
}: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.rowTop}>
                <UserAvatar uri={user.avatar} name={user.username} size={82} />
                <View style={styles.statsRow}>
                    <Stat label="Posts" value={stats.posts} />
                    <Stat label="Followers" value={stats.followers} />
                    <Stat label="Following" value={stats.following} />
                </View>
            </View>

            <Text style={styles.fullName}>{user.fullName}</Text>
            <Text style={styles.bio}>{user.bio}</Text>
            {user.website ? (
                <Text style={styles.website}>{user.website}</Text>
            ) : null}

            <View style={styles.actions}>
                <Pressable style={styles.editButton} onPress={onEditProfile}>
                    <Text style={styles.editButtonText}>Edit profile</Text>
                </Pressable>
                <Pressable style={styles.menuButton} onPress={onOpenMenu}>
                    <Text style={styles.menuButtonText}>Menu</Text>
                </Pressable>
            </View>
        </View>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <View style={styles.statItem}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    rowTop: {
        flexDirection: "row",
    },
    statsRow: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    statItem: {
        alignItems: "center",
    },
    statValue: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    statLabel: {
        fontSize: 13,
        color: colors.text,
    },
    fullName: {
        marginTop: spacing.md,
        color: colors.text,
        fontWeight: "700",
    },
    bio: {
        marginTop: spacing.xs,
        color: colors.text,
    },
    website: {
        marginTop: spacing.xs,
        color: colors.primaryDark,
    },
    actions: {
        marginTop: spacing.md,
        flexDirection: "row",
        gap: spacing.sm,
    },
    editButton: {
        flex: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    menuButton: {
        width: 90,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    editButtonText: {
        color: colors.text,
        fontWeight: "600",
    },
    menuButtonText: {
        color: colors.text,
        fontWeight: "600",
    },
});
