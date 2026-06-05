import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import pageService, { type PageMemberData, type PageRole } from "@/services/pageService";
import { usePageEvents } from "@/hooks/usePageEvents";

const ROLE_LABELS: Record<PageRole, string> = {
    ADMIN: "Admin",
    MODERATOR: "Mod",
    USER: "Thành viên",
};

const ROLE_BADGE_STYLES: Record<PageRole, { bg: string; color: string }> = {
    ADMIN: { bg: "#FEE2E2", color: "#991B1B" },
    MODERATOR: { bg: "#DBEAFE", color: "#1E40AF" },
    USER: { bg: colors.zalo50, color: colors.primary },
};

export default function PageMembersScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { pageId } = useLocalSearchParams<{ pageId?: string }>();
    const { currentUser } = useAppContext();

    const numericPageId = Number(pageId ?? 0);
    const numericUserId = useMemo(() => {
        const id = Number(currentUser?.id);
        return Number.isFinite(id) && id > 0 ? id : null;
    }, [currentUser?.id]);

    const [members, setMembers] = useState<PageMemberData[]>([]);
    const [myRole, setMyRole] = useState<PageRole>("USER");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isAdmin = myRole === "ADMIN";
    const canManage = myRole === "ADMIN" || myRole === "MODERATOR";

    const load = useCallback(async () => {
        if (!numericPageId) return;
        try {
            const data = await pageService.getPageMembers(numericPageId);
            setMembers(data);
            if (numericUserId) {
                const me = data.find((m) => m.user?.id === numericUserId);
                if (me) setMyRole(me.role);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [numericPageId, numericUserId]);

    useEffect(() => {
        void load();
    }, [load]);

    const wsRefresh = usePageEvents({ pageId: numericPageId || undefined });
    useEffect(() => {
        if (wsRefresh > 0) {
            const timer = setTimeout(() => {
                void load();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [wsRefresh, load]);

    const onRefresh = () => {
        setRefreshing(true);
        void load();
    };

    // ── Member actions ─────────────────────────────────────────────────────

    const handleRemove = (member: PageMemberData) => {
        Alert.alert("Xóa thành viên", `Xóa ${member.user?.name ?? "người dùng này"} khỏi trang?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    const ok = await pageService.removeMember(numericPageId, member.user.id);
                    if (ok) setMembers((prev) => prev.filter((m) => m.user.id !== member.user.id));
                },
            },
        ]);
    };

    const handleBlock = (member: PageMemberData) => {
        Alert.alert("Chặn thành viên", `Chặn ${member.user?.name ?? "người dùng này"}?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Chặn",
                style: "destructive",
                onPress: async () => {
                    const ok = await pageService.blockMember(numericPageId, member.user.id);
                    if (ok) setMembers((prev) => prev.filter((m) => m.user.id !== member.user.id));
                },
            },
        ]);
    };

    const handleChangeRole = (member: PageMemberData) => {
        const roles: PageRole[] = ["USER", "MODERATOR", "ADMIN"];
        const options = [...roles.map((r) => ROLE_LABELS[r]), "Hủy"];

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex: options.length - 1, title: "Thay đổi vai trò" },
                async (index) => {
                    if (index < roles.length) {
                        await pageService.authorizeMember(member.user.id, numericPageId, roles[index]);
                        void load();
                    }
                },
            );
        } else {
            Alert.alert(
                "Thay đổi vai trò",
                undefined,
                [
                    ...roles.map((role) => ({
                        text: ROLE_LABELS[role],
                        onPress: async () => {
                            await pageService.authorizeMember(member.user.id, numericPageId, role);
                            void load();
                        },
                    })),
                    { text: "Hủy", style: "cancel" },
                ],
            );
        }
    };

    const openMemberActions = (member: PageMemberData) => {
        if (!canManage || member.user.id === numericUserId) return;
        // Mods cannot manage admins
        if (!isAdmin && member.role === "ADMIN") return;

        const actions: { label: string; action: () => void; danger?: boolean }[] = [
            ...(isAdmin ? [{ label: "Thay đổi vai trò", action: () => handleChangeRole(member) }] : []),
            { label: "Xóa khỏi trang", action: () => handleRemove(member), danger: true },
            { label: "Chặn", action: () => handleBlock(member), danger: true },
        ];

        const options = [...actions.map((a) => a.label), "Hủy"];

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: options.length - 1,
                    destructiveButtonIndex: actions.reduce<number[]>((acc, a, i) => (a.danger ? [...acc, i] : acc), []),
                },
                (index) => {
                    if (index < actions.length) actions[index].action();
                },
            );
        } else {
            Alert.alert(
                member.user?.name ?? "Thành viên",
                undefined,
                [
                    ...actions.map((a) => ({ text: a.label, onPress: a.action, style: a.danger ? ("destructive" as const) : ("default" as const) })),
                    { text: "Hủy", style: "cancel" },
                ],
            );
        }
    };

    const renderMember = ({ item }: { item: PageMemberData }) => {
        const isMe = item.user.id === numericUserId;
        const badgeStyle = ROLE_BADGE_STYLES[item.role];
        return (
            <Pressable
                style={styles.memberCard}
                onLongPress={() => openMemberActions(item)}
                onPress={() => canManage && !isMe ? openMemberActions(item) : undefined}
            >
                <View style={styles.avatarWrap}>
                    {item.user?.avatarUrl ? (
                        <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Ionicons name="person-outline" size={20} color={colors.primary} />
                        </View>
                    )}
                </View>
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.user?.name ?? item.user?.username ?? "Người dùng"}</Text>
                    {!!item.user?.username && <Text style={styles.memberUsername}>@{item.user.username}</Text>}
                </View>
                <View style={[styles.roleBadge, { backgroundColor: badgeStyle.bg }]}>
                    <Text style={[styles.roleText, { color: badgeStyle.color }]}>{ROLE_LABELS[item.role]}</Text>
                </View>
                {canManage && !isMe && item.role !== "ADMIN" && (
                    <TouchableOpacity style={styles.moreBtn} onPress={() => openMemberActions(item)}>
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Thanh vien</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{members.length}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={members}
                    keyExtractor={(item) => String(item.user.id)}
                    renderItem={renderMember}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    contentContainerStyle={members.length === 0 ? styles.emptyContainer : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="people-outline" size={36} color={colors.primary} />
                            </View>
                            <Text style={styles.emptyText}>Chua co thanh vien nao</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F5F5" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
    countBadge: {
        backgroundColor: colors.zalo50,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countBadgeText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    listContent: { padding: 14, paddingTop: 8 },
    emptyContainer: { flex: 1 },
    empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, gap: spacing.md },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.zalo50,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: { color: colors.textMuted, fontSize: 15 },

    memberCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        marginBottom: 8,
        backgroundColor: colors.white,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    avatarWrap: { marginRight: spacing.md },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { backgroundColor: colors.zalo50, justifyContent: "center", alignItems: "center" },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
    memberUsername: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    roleBadge: {
        borderRadius: 12,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
    },
    roleText: { fontSize: 11, fontWeight: "600" },
    moreBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F5F5F5",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 6,
    },
});
