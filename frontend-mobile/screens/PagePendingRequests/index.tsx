import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
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
import pageService, { type PageMemberData } from "@/services/pageService";
import { usePageEvents } from "@/hooks/usePageEvents";

export default function PagePendingRequestsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { pageId } = useLocalSearchParams<{ pageId?: string }>();
    const { currentUser } = useAppContext();

    const numericPageId = Number(pageId ?? 0);
    const numericUserId = useMemo(() => {
        const id = Number(currentUser?.id);
        return Number.isFinite(id) && id > 0 ? id : null;
    }, [currentUser?.id]);

    const [requests, setRequests] = useState<PageMemberData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

    const load = useCallback(async () => {
        if (!numericPageId) return;
        try {
            const data = await pageService.getPendingJoinRequests(numericPageId);
            setRequests(data);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [numericPageId]);

    useEffect(() => {
        void load();
    }, [load]);

    // real-time: new requests arrive via WebSocket
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

    const setProcessing = (userId: number, value: boolean) => {
        setProcessingIds((prev) => {
            const next = new Set(prev);
            if (value) next.add(userId);
            else next.delete(userId);
            return next;
        });
    };

    const handleApprove = async (member: PageMemberData) => {
        const uid = member.user.id;
        setProcessing(uid, true);
        try {
            const ok = await pageService.approveJoinRequest(numericPageId, uid);
            if (ok) {
                setRequests((prev) => prev.filter((r) => r.user.id !== uid));
            } else {
                Alert.alert("Lỗi", "Không thể duyệt yêu cầu này.");
            }
        } finally {
            setProcessing(uid, false);
        }
    };

    const handleReject = (member: PageMemberData) => {
        const uid = member.user.id;
        Alert.alert("Từ chối", `Từ chối yêu cầu của ${member.user?.name ?? "người dùng này"}?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Từ chối",
                style: "destructive",
                onPress: async () => {
                    setProcessing(uid, true);
                    try {
                        const ok = await pageService.rejectJoinRequest(numericPageId, uid);
                        if (ok) setRequests((prev) => prev.filter((r) => r.user.id !== uid));
                        else Alert.alert("Lỗi", "Không thể từ chối yêu cầu này.");
                    } finally {
                        setProcessing(uid, false);
                    }
                },
            },
        ]);
    };

    const handleApproveAll = () => {
        if (requests.length === 0) return;
        Alert.alert("Duyệt tất cả", `Duyệt ${requests.length} yêu cầu?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Duyệt tất cả",
                onPress: async () => {
                    const results = await Promise.allSettled(
                        requests.map((r) => pageService.approveJoinRequest(numericPageId, r.user.id)),
                    );
                    const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value)).length;
                    void load();
                    if (failed > 0) Alert.alert("Thông báo", `${results.length - failed} duyệt thành công, ${failed} thất bại.`);
                },
            },
        ]);
    };

    const renderRequest = ({ item }: { item: PageMemberData }) => {
        const isProcessing = processingIds.has(item.user.id);
        return (
            <View style={styles.requestCard}>
                <View style={styles.requestCardTop}>
                    <View style={styles.avatarWrap}>
                        {item.user?.avatarUrl ? (
                            <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person-outline" size={20} color={colors.primary} />
                            </View>
                        )}
                    </View>

                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.user?.name ?? item.user?.username ?? "Người dùng"}</Text>
                        {!!item.user?.username && <Text style={styles.userUsername}>@{item.user.username}</Text>}
                        {!!item.joinedAt && (
                            <Text style={styles.requestDate}>
                                {new Date(item.joinedAt).toLocaleDateString("vi-VN")}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.btnGroup}>
                    <Pressable
                        style={[styles.btn, styles.approveBtn, isProcessing && styles.btnDisabled]}
                        onPress={() => handleApprove(item)}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={16} color={colors.white} />
                                <Text style={styles.approveBtnText}>Dong y</Text>
                            </>
                        )}
                    </Pressable>
                    <Pressable
                        style={[styles.btn, styles.rejectBtn, isProcessing && styles.btnDisabled]}
                        onPress={() => handleReject(item)}
                        disabled={isProcessing}
                    >
                        <Ionicons name="close" size={16} color={colors.danger} />
                        <Text style={styles.rejectBtnText}>Tu choi</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Yeu cau tham gia ({requests.length})</Text>
                {requests.length > 0 && (
                    <TouchableOpacity onPress={handleApproveAll} style={styles.approveAllBtn}>
                        <Text style={styles.approveAllText}>Duyet tat ca</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={(item) => String(item.user.id)}
                    renderItem={renderRequest}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="person-add-outline" size={36} color={colors.primary} />
                            </View>
                            <Text style={styles.emptyText}>Khong co yeu cau nao dang cho</Text>
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
    headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
    approveAllBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: colors.zalo50,
    },
    approveAllText: { fontSize: 13, fontWeight: "600", color: colors.primary },
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

    requestCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    requestCardTop: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    avatarWrap: { marginRight: spacing.md },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { backgroundColor: colors.zalo50, justifyContent: "center", alignItems: "center" },
    userInfo: { flex: 1 },
    userName: { fontSize: 14, fontWeight: "600", color: colors.text },
    userUsername: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    requestDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    btnGroup: { flexDirection: "row", gap: spacing.sm },
    btn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 10,
        borderRadius: 20,
    },
    approveBtn: { backgroundColor: colors.primary },
    approveBtnText: { fontSize: 13, fontWeight: "600", color: colors.white },
    rejectBtn: { backgroundColor: "#FEE2E2" },
    rejectBtnText: { fontSize: 13, fontWeight: "600", color: colors.danger },
    btnDisabled: { opacity: 0.5 },
});
