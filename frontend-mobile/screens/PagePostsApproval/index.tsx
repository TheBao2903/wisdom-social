import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import pageService, { PagePostItem } from "@/services/pageService";
import { usePagePostEvents } from "@/hooks/usePagePostEvents";

export default function PagePostsApprovalScreen() {
    const router = useRouter();
    const { pageId } = useLocalSearchParams<{ pageId?: string }>();
    const { currentUser } = useAppContext();

    const numericPageId = Number(pageId ?? 0);
    const numericUserId = Number(currentUser?.id ?? 0);

    const [posts, setPosts] = useState<PagePostItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const loadPosts = useCallback(async () => {
        if (!numericPageId) return;
        setLoading(true);
        try {
            const data = await pageService.getPostsWaitingForApproval(numericPageId);
            setPosts(data);
        } finally {
            setLoading(false);
        }
    }, [numericPageId]);

    useEffect(() => {
        void loadPosts();
    }, [loadPosts]);

    // Real-time: tự động cập nhật danh sách bài chờ duyệt
    usePagePostEvents({
        pageId: numericPageId || undefined,
        onPostSubmitted: (_postId, post) => {
            // Bài viết mới được gửi → thêm vào đầu danh sách pending
            if (post) {
                const newPost = post as unknown as PagePostItem;
                setPosts(prev => {
                    if (prev.some(p => p.id === newPost.id)) return prev;
                    return [newPost, ...prev];
                });
            }
        },
        onPostApproved: (postId) => {
            // Bài viết được duyệt → xóa khỏi danh sách pending
            setPosts(prev => prev.filter(p => p.id !== postId));
        },
        onPostRejected: (postId) => {
            // Bài viết bị từ chối → xóa khỏi danh sách pending
            setPosts(prev => prev.filter(p => p.id !== postId));
        },
        onPostRemoved: (postId) => {
            setPosts(prev => prev.filter(p => p.id !== postId));
        },
    });

    const handleApprove = async (post: PagePostItem) => {
        setActionLoadingId(post.id);
        try {
            const ok = await pageService.approvePost(numericUserId, numericPageId, post.id);
            if (ok) {
                setPosts((prev) => prev.filter((p) => p.id !== post.id));
            } else {
                Alert.alert("Lỗi", "Không thể duyệt bài. Vui lòng thử lại.");
            }
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRemove = (post: PagePostItem) => {
        Alert.alert("Xóa bài viết", "Bạn có chắc muốn xóa bài này khỏi trang?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    setActionLoadingId(post.id);
                    try {
                        const ok = await pageService.removePostFromPage(numericUserId, numericPageId, post.id);
                        if (ok) {
                            setPosts((prev) => prev.filter((p) => p.id !== post.id));
                        } else {
                            Alert.alert("Lỗi", "Không thể xóa bài. Vui lòng thử lại.");
                        }
                    } finally {
                        setActionLoadingId(null);
                    }
                },
            },
        ]);
    };

    const handleApproveAll = () => {
        if (posts.length === 0) return;
        Alert.alert("Duyệt tất cả", `Duyệt ${posts.length} bài viết đang chờ?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Duyệt tất cả",
                onPress: async () => {
                    setLoading(true);
                    try {
                        await pageService.approveAllPosts(numericUserId, numericPageId);
                        setPosts([]);
                    } finally {
                        setLoading(false);
                    }
                },
            },
        ]);
    };

    const renderItem = ({ item }: { item: PagePostItem }) => {
        const isActing = actionLoadingId === item.id;
        const firstImage = item.images?.[0];
        const text = item.content || item.caption;

        return (
            <View style={styles.card}>
                <View style={styles.authorRow}>
                    {item.user?.avatarUrl ? (
                        <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarFallback}>
                            <Ionicons name="person" size={18} color={colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.authorInfo}>
                        <Text style={styles.authorName} numberOfLines={1}>
                            {item.user?.name || item.user?.username || "Người dùng"}
                        </Text>
                        {!!item.createdAt && (
                            <Text style={styles.createdAt}>
                                {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                            </Text>
                        )}
                    </View>
                </View>

                {!!text && (
                    <Text style={styles.content} numberOfLines={3}>{text}</Text>
                )}

                {!!firstImage && (
                    <Image source={{ uri: firstImage }} style={styles.postImage} resizeMode="cover" />
                )}

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleApprove(item)}
                        disabled={isActing}
                    >
                        {isActing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                                <Text style={styles.approveBtnText}>Duyệt</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.removeBtn]}
                        onPress={() => handleRemove(item)}
                        disabled={isActing}
                    >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        <Text style={styles.removeBtnText}>Xóa</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Duyệt bài viết</Text>
                <TouchableOpacity
                    onPress={handleApproveAll}
                    style={styles.approveAllBtn}
                    disabled={posts.length === 0 || loading}
                >
                    <Text style={[styles.approveAllText, posts.length === 0 && styles.approveAllDisabled]}>
                        Duyệt tất cả
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="checkmark-circle-outline" size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.emptyText}>Khong co bai viet cho duyet</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F5F5" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    approveAllBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: colors.zalo50,
    },
    approveAllText: { fontSize: 13, fontWeight: "600", color: colors.primary },
    approveAllDisabled: { color: colors.textMuted },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 14 },

    card: {
        backgroundColor: colors.white,
        borderRadius: 16,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    authorRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 10,
    },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.zalo50,
        alignItems: "center",
        justifyContent: "center",
    },
    authorInfo: { flex: 1 },
    authorName: { fontSize: 14, fontWeight: "600", color: colors.text },
    createdAt: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    content: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    postImage: {
        width: "auto",
        height: 200,
        borderRadius: 12,
        marginHorizontal: 12,
        marginBottom: 10,
        backgroundColor: colors.surface,
    },

    actions: {
        flexDirection: "row",
        gap: 8,
        padding: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 20,
    },
    approveBtn: { backgroundColor: colors.primary },
    approveBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
    removeBtn: {
        backgroundColor: "#FEE2E2",
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    removeBtnText: { fontSize: 13, fontWeight: "600", color: colors.danger },

    emptyContainer: { alignItems: "center", paddingTop: 80 },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.zalo50,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: { marginTop: 16, fontSize: 15, color: colors.textMuted },
});
