import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import friendService from "@/services/friendService";
import blockService from "@/services/blockService";
import userService from "@/services/userService";
import * as postApi from "@/services/postService";
import { useFriendNotifications } from "@/hooks/useFriendNotifications";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import type { User } from "@/services/userService";
import ReportModal from "@/components/ReportModal";

const S3_BASE = "https://cnmt-hk1-amz.s3.ap-southeast-1.amazonaws.com/";
const toImageUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http") || url.startsWith("file://") || url.startsWith("content://")) return url;
    return S3_BASE + url;
};

type FriendStatus = "NONE" | "SENT" | "RECEIVED" | "FRIEND" | "BLOCKED" | "BLOCKED_BY";

export default function UserProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userId } = useLocalSearchParams<{ userId?: string }>();
    const { currentUser } = useAppContext();
    const [selectedTab, setSelectedTab] = useState<"posts" | "tagged">("posts");
    const [friendStatus, setFriendStatus] = useState<FriendStatus>("NONE");
    const [statusLoading, setStatusLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [friendsCount, setFriendsCount] = useState<number | null>(null);

    const myId = useMemo(() => Number(currentUser?.id), [currentUser?.id]);
    const targetId = useMemo(() => Number(userId), [userId]);
    const presenceByUserId = usePresenceStatus([targetId]);
    const isTargetOnline = Boolean(
        Number.isFinite(targetId) && targetId > 0 && presenceByUserId[targetId]?.online,
    );

    const isOwnProfile = useMemo(
        () => !!userId && !!currentUser?.id && Number(userId) === Number(currentUser.id),
        [userId, currentUser?.id],
    );

    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [postsCount, setPostsCount] = useState<number | null>(null);
    const [showReportModal, setShowReportModal] = useState(false);

    const loadProfile = useCallback(async () => {
        const id = isOwnProfile ? currentUser?.id : userId;
        if (!id) { setProfileLoading(false); return; }
        try {
            const user = await userService.getUserProfile(id);
            setProfileUser(user);
        } finally {
            setProfileLoading(false);
        }
    }, [userId, isOwnProfile, currentUser?.id]);

    // Load friend status from API
    const loadFriendStatus = useCallback(async () => {
        if (isOwnProfile || !myId || !targetId || !Number.isFinite(myId) || !Number.isFinite(targetId)) return;
        setStatusLoading(true);
        try {
            const status = await friendService.getFriendStatus(myId, targetId);
            setFriendStatus(status);
        } finally {
            setStatusLoading(false);
        }
    }, [myId, targetId, isOwnProfile]);

    const loadFriendsCount = useCallback(async () => {
        const id = Number.isFinite(targetId) ? targetId : myId;
        if (!id || !Number.isFinite(id)) return;
        try {
            const friends = await friendService.getFriends(id);
            setFriendsCount(friends.length);
        } catch {
            // keep null
        }
    }, [targetId, myId]);

    const loadPostsCount = useCallback(async () => {
        const id = isOwnProfile ? currentUser?.id : userId;
        if (!id) {
            setPostsCount(null);
            return;
        }

        setPostsCount(await postApi.getUserPostsCount(id));
    }, [isOwnProfile, currentUser?.id, userId]);

    // Auto-refresh on WebSocket friend events
    const refreshTrigger = useFriendNotifications();
    const targetFriendTrigger = useFriendNotifications(
        undefined,
        !isOwnProfile ? profileUser?.phone : null,
    );

    useEffect(() => {
        void loadProfile();
        void loadFriendStatus();
        void loadFriendsCount();
        void loadPostsCount();
    }, [
        loadProfile,
        loadFriendStatus,
        loadFriendsCount,
        loadPostsCount,
        refreshTrigger,
        targetFriendTrigger,
    ]);

    // --- Friend action handlers ---
    const handleSendRequest = async () => {
        setActionLoading(true);
        await friendService.sendFriendRequest(myId, targetId);
        await loadFriendStatus();
        await loadFriendsCount();
        setActionLoading(false);
    };

    const handleCancelRequest = async () => {
        setActionLoading(true);
        await friendService.cancelFriendRequest(myId, targetId);
        await loadFriendStatus();
        await loadFriendsCount();
        setActionLoading(false);
    };

    const handleAccept = async () => {
        setActionLoading(true);
        await friendService.acceptFriendRequest(targetId, myId);
        await loadFriendStatus();
        await loadFriendsCount();
        setActionLoading(false);
    };

    const handleReject = async () => {
        setActionLoading(true);
        await friendService.rejectFriendRequest(targetId, myId);
        await loadFriendStatus();
        await loadFriendsCount();
        setActionLoading(false);
    };

    const handleUnfriend = () => {
        Alert.alert("Hủy kết bạn", "Bạn có chắc muốn hủy kết bạn?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Hủy kết bạn",
                style: "destructive",
                onPress: async () => {
                    setActionLoading(true);
                    await friendService.cancelFriendRequest(myId, targetId);
                    await loadFriendStatus();
                    await loadFriendsCount();
                    setActionLoading(false);
                },
            },
        ]);
    };

    // Menu ⋮ : cho phép Báo cáo hoặc Chặn tài khoản
    const handleOpenMenu = () => {
        const buttons: Parameters<typeof Alert.alert>[2] = [
            { text: "Báo cáo tài khoản", onPress: () => setShowReportModal(true) },
        ];
        if (friendStatus !== "BLOCKED_BY") {
            buttons.push({
                text: friendStatus === "BLOCKED" ? "Bỏ chặn" : "Chặn tài khoản",
                style: "destructive",
                onPress: friendStatus === "BLOCKED" ? handleUnblock : handleBlock,
            });
        }
        buttons.push({ text: "Hủy", style: "cancel" });
        Alert.alert(profileUser?.name || profileUser?.username || "Tài khoản", undefined, buttons);
    };

    const handleBlock = () => {
        Alert.alert("Chặn người dùng", "Bạn có chắc muốn chặn người này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Chặn",
                style: "destructive",
                onPress: async () => {
                    setActionLoading(true);
                    await blockService.blockUser(myId, targetId);
                    await loadFriendStatus();
                    await loadFriendsCount();
                    setActionLoading(false);
                },
            },
        ]);
    };

    const handleUnblock = () => {
        Alert.alert("Bỏ chặn", "Bạn có chắc muốn bỏ chặn người này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Bỏ chặn",
                style: "destructive",
                onPress: async () => {
                    setActionLoading(true);
                    await blockService.unblockUser(myId, targetId);
                    await loadFriendStatus();
                    await loadFriendsCount();
                    setActionLoading(false);
                },
            },
        ]);
    };

    // Render the friend action button based on current status
    const renderFriendButton = () => {
        if (isOwnProfile || !userId) return null;
        if (statusLoading) {
            return (
                <View style={[styles.friendBtn, styles.friendBtnLoading]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            );
        }

        if (friendStatus === "NONE") {
            return (
                <TouchableOpacity
                    style={[styles.friendBtn, styles.friendBtnPrimary]}
                    onPress={handleSendRequest}
                    disabled={actionLoading}
                >
                    {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="person-add" size={16} color="#fff" />
                            <Text style={styles.friendBtnTextWhite}>Kết bạn</Text>
                        </>
                    )}
                </TouchableOpacity>
            );
        }

        if (friendStatus === "SENT") {
            return (
                <TouchableOpacity
                    style={[styles.friendBtn, styles.friendBtnOutline]}
                    onPress={handleCancelRequest}
                    disabled={actionLoading}
                >
                    {actionLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                            <Text style={styles.friendBtnTextPrimary}>Đã gửi lời mời</Text>
                        </>
                    )}
                </TouchableOpacity>
            );
        }

        if (friendStatus === "RECEIVED") {
            return (
                <View style={styles.receivedRow}>
                    <TouchableOpacity
                        style={[styles.friendBtn, styles.friendBtnPrimary, { flex: 1 }]}
                        onPress={handleAccept}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                                <Text style={styles.friendBtnTextWhite}>Chấp nhận</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.friendBtn, styles.friendBtnDanger, { flex: 1 }]}
                        onPress={handleReject}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="close" size={16} color="#fff" />
                                <Text style={styles.friendBtnTextWhite}>Từ chối</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            );
        }

        if (friendStatus === "FRIEND") {
            return (
                <TouchableOpacity
                    style={[styles.friendBtn, styles.friendBtnOutline]}
                    onPress={handleUnfriend}
                    disabled={actionLoading}
                >
                    {actionLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="people" size={16} color={colors.primary} />
                            <Text style={styles.friendBtnTextPrimary}>Bạn bè</Text>
                        </>
                    )}
                </TouchableOpacity>
            );
        }

        if (friendStatus === "BLOCKED") {
            return (
                <View style={[styles.friendBtn, styles.friendBtnBlocked]}>
                    <Ionicons name="ban-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.friendBtnTextMuted}>Đã chặn</Text>
                </View>
            );
        }

        if (friendStatus === "BLOCKED_BY") {
            return null;
        }

        return null;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{profileUser?.username || "Hồ sơ"}</Text>
                {!isOwnProfile && (
                    <TouchableOpacity style={styles.menuButton} onPress={handleOpenMenu}>
                        <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
                    </TouchableOpacity>
                )}
                {isOwnProfile && <View style={styles.menuButton} />}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Avatar Section */}
                <View style={styles.profileHeader}>
                    {profileLoading ? (
                        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
                    ) : (
                        <>
                            <View style={styles.avatarContainer}>
                                {profileUser?.avatarUrl ? (
                                    <Image source={{ uri: toImageUrl(profileUser.avatarUrl) }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
                                        <Ionicons name="person" size={50} color={colors.primary} />
                                    </View>
                                )}
                                {isTargetOnline ? <View style={styles.onlineDot} /> : null}
                            </View>

                            <Text style={styles.name}>{profileUser?.name || profileUser?.fullName || profileUser?.username || "—"}</Text>
                            {profileUser?.username && <Text style={styles.username}>@{profileUser.username}</Text>}
                            {profileUser?.bio ? <Text style={styles.bio}>{profileUser.bio}</Text> : null}
                        </>
                    )}

                    {/* Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>
                                {postsCount !== null ? String(postsCount) : "—"}
                            </Text>
                            <Text style={styles.statLabel}>Bài viết</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() =>
                                router.push({
                                    pathname: "/(stack)/friends-list",
                                    params: { userId: userId ?? String(currentUser?.id ?? ""), tab: "friends" },
                                })
                            }
                        >
                            <Text style={styles.statNumber}>
                                {friendsCount !== null ? String(friendsCount) : "—"}
                            </Text>
                            <Text style={styles.statLabel}>Bạn bè</Text>
                        </TouchableOpacity>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{profileUser?.following ?? "—"}</Text>
                            <Text style={styles.statLabel}>Đang theo dõi</Text>
                        </View>
                    </View>

                    {/* Friend Action Button */}
                    <View style={styles.actionButtons}>
                        {renderFriendButton()}

                        {!isOwnProfile && (
                            <TouchableOpacity style={styles.messageBtn}>
                                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isOwnProfile && (
                        <TouchableOpacity
                            style={styles.blockedListBtn}
                            onPress={() =>
                                router.push({
                                    pathname: "/(stack)/friends-list",
                                    params: { tab: "blocked" },
                                })
                            }
                        >
                            <Ionicons name="ban-outline" size={16} color={colors.textMuted} />
                            <Text style={styles.blockedListText}>Danh sách đã chặn</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, selectedTab === "posts" && styles.tabActive]}
                        onPress={() => setSelectedTab("posts")}
                    >
                        <Text style={[styles.tabText, selectedTab === "posts" && styles.tabTextActive]}>
                            Bài viết
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, selectedTab === "tagged" && styles.tabActive]}
                        onPress={() => setSelectedTab("tagged")}
                    >
                        <Text style={[styles.tabText, selectedTab === "tagged" && styles.tabTextActive]}>
                            Được gắn thẻ
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Empty State */}
                <View style={styles.emptyState}>
                    <Ionicons name="images-outline" size={60} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Chưa có bài viết nào</Text>
                </View>
            </ScrollView>

            {!isOwnProfile && (
                <ReportModal
                    visible={showReportModal}
                    targetType="USER"
                    targetId={targetId}
                    targetName={profileUser?.name || profileUser?.fullName || profileUser?.username}
                    onClose={() => setShowReportModal(false)}
                    onSubmitted={(msg) => Alert.alert("Thành công", msg)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    menuButton: {
        padding: 8,
    },
    profileHeader: {
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    avatarContainer: {
        position: "relative",
        marginBottom: 12,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: "center",
        justifyContent: "center",
    },
    onlineDot: {
        position: "absolute",
        right: 6,
        bottom: 6,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 3,
        borderColor: colors.white,
        backgroundColor: "#22C55E",
    },
    name: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
        marginTop: 8,
    },
    username: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 2,
    },
    bio: {
        fontSize: 13,
        color: colors.text,
        marginTop: 8,
        textAlign: "center",
        lineHeight: 18,
    },
    statsContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    statItem: {
        alignItems: "center",
    },
    statNumber: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
    },
    actionButtons: {
        flexDirection: "row",
        gap: 8,
        marginTop: 16,
        width: "100%",
    },
    // Friend button variants
    friendBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        minHeight: 44,
    },
    friendBtnPrimary: {
        backgroundColor: colors.primary,
    },
    friendBtnOutline: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    friendBtnDanger: {
        backgroundColor: colors.danger,
    },
    friendBtnBlocked: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    friendBtnLoading: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    friendBtnTextWhite: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
    },
    friendBtnTextPrimary: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "600",
    },
    friendBtnTextMuted: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "500",
    },
    receivedRow: {
        flex: 1,
        flexDirection: "row",
        gap: 8,
    },
    messageBtn: {
        width: 45,
        height: 45,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    tabs: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabActive: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: "500",
        color: colors.textMuted,
    },
    tabTextActive: {
        color: colors.primary,
        fontWeight: "600",
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 80,
        paddingHorizontal: 16,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 12,
    },
    blockedListBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        width: "100%",
    },
    blockedListText: {
        flex: 1,
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: "500",
    },
});
