import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Alert,
    SafeAreaView,
    ActivityIndicator,
    DeviceEventEmitter,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { UserAvatar, SelectGroupMembersModal } from "@/components";
import { useMessagesController } from "@/hooks/useMessagesController";
import { useGroupManagement } from "@/hooks/useGroupManagement";
import { useGroupConversationRealtime } from "@/hooks/useGroupConversationRealtime";
import type { ConversationMember, JoinRequest, MemberRole } from "@/types/chat";
import { buildS3Url } from "@/utils/s3";
import { LOCKED_ACCOUNT_NAME } from "@/utils/lockedAccount";

export function ManageMembersScreen() {
    const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
    const router = useRouter();
    const id = Number(conversationId);

    const {
        conversations,
        currentUserId,
        reload,
    } = useMessagesController();

    const selectedConversation = useMemo(
        () => conversations.find((c) => c.id === id) || null,
        [conversations, id]
    );

    const groupManagement = useGroupManagement({
        currentUserId,
        selectedConversation,
        selectedConversationId: id,
        reloadConversations: reload,
    });

    useGroupConversationRealtime({
        conversationId: id,
        currentUserId,
        reloadConversations: reload,
    });

    const members = useMemo(() => {
        const list = (selectedConversation?.members ?? []).filter(
            (m) => !m.status || m.status === "ACTIVE"
        );
        return sortMembers(list);
    }, [selectedConversation?.members]);

    const isOwner = groupManagement.currentMemberRole === "OWNER";
    const isDeputy = groupManagement.currentMemberRole === "DEPUTY";
    const canReviewJoinRequests = isOwner || isDeputy;
    const pendingRequests = canReviewJoinRequests
        ? (selectedConversation?.pendingRequests ?? []).filter(
              (request) => request.status === "PENDING",
          )
        : [];
    const [showBlockedList, setShowBlockedList] = useState(false);
    const [blockedMembers, setBlockedMembers] = useState<ConversationMember[]>([]);
    const [blockedLoading, setBlockedLoading] = useState(false);

    const loadBlockedMembers = useCallback(async () => {
        if (!canReviewJoinRequests) return;
        setBlockedLoading(true);
        try {
            setBlockedMembers(await groupManagement.getBlockedMembers());
        } finally {
            setBlockedLoading(false);
        }
    }, [canReviewJoinRequests, groupManagement.getBlockedMembers]);

    useEffect(() => {
        if (showBlockedList) void loadBlockedMembers();
    }, [loadBlockedMembers, showBlockedList]);

    useEffect(() => {
        if (!showBlockedList) return;

        const subscription = DeviceEventEmitter.addListener(
            "conversation-blocked-members-updated",
            (event: { conversationId?: number }) => {
                if (Number(event?.conversationId) === id) {
                    void loadBlockedMembers();
                }
            },
        );

        return () => subscription.remove();
    }, [id, loadBlockedMembers, showBlockedList]);

    if (!selectedConversation) return null;

    const handleDisbandGroup = () => {
        Alert.alert(
            "Giải tán nhóm?",
            "Tất cả thành viên sẽ bị xóa khỏi nhóm và cuộc trò chuyện này sẽ kết thúc. Hành động này không thể hoàn tác.",
            [
                { text: "Hủy", style: "cancel" },
                { 
                    text: "Giải tán", 
                    style: "destructive", 
                    onPress: async () => {
                        const success = await groupManagement.disbandGroup();
                        if (success) router.dismissAll();
                    } 
                }
            ]
        );
    };

    const handleHeaderMenu = () => {
        const options: { text: string; style?: "cancel" | "destructive"; onPress: () => void }[] = [
            { text: "Hủy", style: "cancel", onPress: () => {} }
        ];

        if (isOwner) {
            options.push({
                text: "Giải tán nhóm",
                style: "destructive",
                onPress: handleDisbandGroup
            });
        }

        Alert.alert("Tùy chọn danh sách", undefined, options);
    };

    const handleMemberPress = (member: ConversationMember) => {
        if (Number(member.userId) === Number(currentUserId)) return;
        if (!isOwner && groupManagement.currentMemberRole !== "DEPUTY") return;

        const label = member.nickname || member.username || "Thành viên";
        
        const options: { text: string; style?: "cancel" | "destructive"; onPress: () => void }[] = [
            { text: "Hủy", style: "cancel", onPress: () => {} }
        ];

        if (isOwner) {
            options.push({
                text: "Chuyển trưởng nhóm",
                onPress: () => {
                    Alert.alert(
                        "Chuyển trưởng nhóm?",
                        `Bạn có chắc muốn chuyển quyền trưởng nhóm cho ${label}? Sau khi chuyển, bạn sẽ trở thành thành viên thường.`,
                        [
                            { text: "Hủy", style: "cancel" },
                            {
                                text: "Chuyển quyền",
                                onPress: () => {
                                    void groupManagement.updateMemberRole(
                                        member.userId,
                                        "OWNER",
                                    );
                                },
                            },
                        ],
                    );
                },
            });

            if (member.role === "MEMBER") {
                options.push({
                    text: "Chỉ định Phó nhóm",
                    onPress: () => groupManagement.updateMemberRole(member.userId, "DEPUTY"),
                });
            } else if (member.role === "DEPUTY") {
                options.push({
                    text: "Gỡ quyền Phó nhóm",
                    onPress: () => groupManagement.updateMemberRole(member.userId, "MEMBER"),
                });
            }
        }

        if (isOwner || (groupManagement.currentMemberRole === "DEPUTY" && member.role === "MEMBER")) {
            options.push({
                text: "Xóa khỏi nhóm",
                style: "destructive",
                onPress: () => {
                    Alert.alert(
                        "Xóa thành viên",
                        `Bạn có chắc muốn xóa ${label} khỏi nhóm?`,
                        [
                            { text: "Hủy", style: "cancel" },
                            {
                                text: "Xóa",
                                style: "destructive",
                                onPress: () => groupManagement.kickMember(member.userId),
                            },
                        ]
                    );
                },
            });
        }

        if (isOwner || (groupManagement.currentMemberRole === "DEPUTY" && member.role === "MEMBER")) {
            options.push({
                text: "Chặn khỏi nhóm",
                style: "destructive",
                onPress: () => {
                    Alert.alert(
                        "Chặn thành viên",
                        `Bạn có chắc muốn chặn ${label} khỏi nhóm? Người này sẽ không thể tham gia lại nếu chưa được bỏ chặn.`,
                        [
                            { text: "Hủy", style: "cancel" },
                            {
                                text: "Chặn",
                                style: "destructive",
                                onPress: () => {
                                    void groupManagement.blockMember(
                                        member.userId,
                                    );
                                },
                            },
                        ],
                    );
                },
            });
        }

        if (options.length > 1) {
            Alert.alert(label, "Chọn hành động", options);
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Thành viên</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={members}
                keyExtractor={(item) => String(item.userId)}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={() => (
                    <View>
                        {groupManagement.canAddMembers && (
                            <View style={styles.topActionSection}>
                                <Pressable 
                                    style={styles.addMemberBtn} 
                                    onPress={groupManagement.openAddMembersModal}
                                >
                                    <View style={styles.addIconWrap}>
                                        <Ionicons name="person-add" size={20} color={colors.text} />
                                    </View>
                                    <Text style={styles.addMemberText}>Thêm thành viên</Text>
                                </Pressable>
                            </View>
                        )}
                        {canReviewJoinRequests && (
                            <View style={styles.topActionSection}>
                                <Pressable
                                    style={styles.blockedBtn}
                                    onPress={() => {
                                        const next = !showBlockedList;
                                        setShowBlockedList(next);
                                        if (next) void loadBlockedMembers();
                                    }}
                                >
                                    <View style={styles.addIconWrap}>
                                        <Ionicons name="ban" size={20} color={colors.danger} />
                                    </View>
                                    <Text style={styles.blockedText}>Danh sách chặn</Text>
                                </Pressable>
                            </View>
                        )}
                        {showBlockedList && (
                            <View style={styles.requestSection}>
                                <Text style={styles.requestTitle}>
                                    Danh sách chặn ({blockedMembers.length})
                                </Text>
                                {blockedLoading ? (
                                    <ActivityIndicator color={colors.primary} />
                                ) : blockedMembers.length === 0 ? (
                                    <Text style={styles.requestMeta}>Chưa có ai bị chặn khỏi nhóm.</Text>
                                ) : (
                                    blockedMembers.map((member) => (
                                        <BlockedMemberItem
                                            key={member.userId}
                                            member={member}
                                            onUnblock={async () => {
                                                const ok = await groupManagement.unblockMember(member.userId);
                                                if (ok) void loadBlockedMembers();
                                            }}
                                        />
                                    ))
                                )}
                            </View>
                        )}
                        {pendingRequests.length > 0 && (
                            <View style={styles.requestSection}>
                                <Text style={styles.requestTitle}>
                                    Yêu cầu tham gia nhóm ({pendingRequests.length})
                                </Text>
                                {pendingRequests.map((request) => (
                                    <JoinRequestItem
                                        key={request.id}
                                        request={request}
                                        isPending={
                                            groupManagement.pendingJoinRequestId ===
                                            request.id
                                        }
                                        onApprove={() =>
                                            groupManagement.processJoinRequest(
                                                request.id,
                                                true,
                                            )
                                        }
                                        onReject={() =>
                                            groupManagement.processJoinRequest(
                                                request.id,
                                                false,
                                            )
                                        }
                                    />
                                ))}
                            </View>
                        )}
                        <View style={styles.listHeaderRow}>
                            <Text style={styles.listHeaderTitle}>
                                Danh sách thành viên ({members.length})
                            </Text>
                            <Pressable onPress={handleHeaderMenu} style={styles.headerActionBtn}>
                                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                            </Pressable>
                        </View>
                    </View>
                )}
                renderItem={({ item }) => (
                    <MemberItem
                        member={item}
                        isMe={Number(item.userId) === Number(currentUserId)}
                        onPress={() => handleMemberPress(item)}
                        isPending={
                            groupManagement.pendingKickUserId === item.userId ||
                            groupManagement.pendingRoleUserId === item.userId
                        }
                    />
                )}
            />

            <SelectGroupMembersModal
                open={groupManagement.isAddMembersModalOpen}
                onClose={groupManagement.closeAddMembersModal}
                onSubmit={groupManagement.addMembersToGroup}
                friends={groupManagement.availableFriends}
                existingMemberIds={groupManagement.groupMemberIds}
                loadingFriends={groupManagement.friendsLoading}
                friendsError={groupManagement.friendsError}
                submitting={groupManagement.isAddingMembers}
                error={groupManagement.actionError}
            />
        </SafeAreaView>
    );
}

function MemberItem({
    member,
    isMe,
    onPress,
    isPending,
}: {
    member: ConversationMember;
    isMe: boolean;
    onPress: () => void;
    isPending: boolean;
}) {

    return (
        <Pressable
            style={({ pressed }) => [
                styles.memberItem,
                pressed && styles.memberItemPressed,
            ]}
            onPress={onPress}
        >
            <View style={styles.memberLeft}>
                <View>
                    <UserAvatar
                        uri={member.accountLocked ? undefined : buildS3Url(member.avatar)}
                        name={member.accountLocked ? LOCKED_ACCOUNT_NAME : member.nickname || member.username || "?"}
                        size={44}
                        locked={member.accountLocked}
                    />
                    {member.role === "OWNER" && (
                        <View style={styles.ownerIcon}>
                            <Ionicons name="bookmark" size={10} color="#fbbf24" />
                        </View>
                    )}
                </View>
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                        {isMe
                            ? "Bạn"
                            : member.accountLocked
                              ? LOCKED_ACCOUNT_NAME
                              : member.nickname || member.username || "Người dùng"}
                    </Text>
                    {member.role !== "MEMBER" && (
                        <Text style={styles.roleLabel}>
                            {member.role === "OWNER" ? "Trưởng nhóm" : "Phó nhóm"}
                        </Text>
                    )}
                </View>
            </View>
            {isPending && <ActivityIndicator size="small" color={colors.primary} />}
        </Pressable>
    );
}

function formatRelativeTime(value?: string): string {
    if (!value) return "";
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "";

    const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSeconds < 60) return "Vừa xong";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${Math.floor(diffHours / 24)} ngày trước`;
}

function JoinRequestItem({
    request,
    isPending,
    onApprove,
    onReject,
}: {
    request: JoinRequest;
    isPending: boolean;
    onApprove: () => void;
    onReject: () => void;
}) {
    const requestName =
        request.userName ||
        request.nickname ||
        request.username ||
        "Thanh vien";
    const requestAvatar =
        request.userAvatar || request.avatarUrl || request.avatar || undefined;

    return (
        <View style={styles.requestItem}>
            <UserAvatar
                uri={buildS3Url(requestAvatar)}
                name={requestName}
                size={44}
            />
            <View style={styles.requestBody}>
                <Text style={styles.memberName} numberOfLines={1}>
                    {requestName}
                </Text>
                {request.inviterName ? (
                    <Text style={styles.requestMeta} numberOfLines={1}>
                        Được mời bởi: {request.inviterName}
                    </Text>
                ) : null}
                {!!formatRelativeTime(request.createdAt) && (
                    <Text style={styles.requestMeta}>
                        {formatRelativeTime(request.createdAt)}
                    </Text>
                )}
                <View style={styles.requestActions}>
                    <Pressable
                        disabled={isPending}
                        style={[styles.requestButton, styles.rejectButton]}
                        onPress={onReject}
                    >
                        <Text style={styles.rejectButtonText}>Từ chối</Text>
                    </Pressable>
                    <Pressable
                        disabled={isPending}
                        style={[styles.requestButton, styles.approveButton]}
                        onPress={onApprove}
                    >
                        {isPending ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={styles.approveButtonText}>Đồng ý</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function BlockedMemberItem({
    member,
    onUnblock,
}: {
    member: ConversationMember;
    onUnblock: () => void;
}) {
    return (
        <View style={styles.requestItem}>
            <UserAvatar
                uri={buildS3Url(member.avatar)}
                name={member.nickname || member.username || "?"}
                size={44}
            />
            <View style={styles.requestBody}>
                <Text style={styles.memberName} numberOfLines={1}>
                    {member.nickname || member.username || "Thành viên"}
                </Text>
                <Pressable
                    style={[styles.requestButton, styles.rejectButton, { marginTop: 8 }]}
                    onPress={onUnblock}
                >
                    <Text style={styles.rejectButtonText}>Bỏ chặn</Text>
                </Pressable>
            </View>
        </View>
    );
}

function sortMembers(members: ConversationMember[]): ConversationMember[] {
    const roleOrder: Record<MemberRole, number> = {
        OWNER: 0,
        DEPUTY: 1,
        MEMBER: 2,
    };

    return [...members].sort((a, b) => {
        const firstRole = a.role ?? "MEMBER";
        const secondRole = b.role ?? "MEMBER";
        if (roleOrder[firstRole] !== roleOrder[secondRole]) {
            return roleOrder[firstRole] - roleOrder[secondRole];
        }
        return (a.nickname || "").localeCompare(b.nickname || "");
    });
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    topActionSection: {
        padding: 16,
    },
    requestSection: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    requestTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 10,
    },
    requestItem: {
        flexDirection: "row",
        gap: 12,
        paddingVertical: 10,
    },
    requestBody: {
        flex: 1,
    },
    requestMeta: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    requestActions: {
        flexDirection: "row",
        gap: 8,
        marginTop: 10,
    },
    requestButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 36,
        borderRadius: 8,
    },
    rejectButton: {
        backgroundColor: "#e5e7eb",
    },
    approveButton: {
        backgroundColor: "#e8f1ff",
    },
    rejectButtonText: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    approveButtonText: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.primary,
    },
    addMemberBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
        padding: 12,
        borderRadius: 8,
        gap: 12,
    },
    addIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    addMemberText: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
    },
    blockedBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fef2f2",
        padding: 12,
        borderRadius: 8,
        gap: 12,
    },
    blockedText: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.danger,
    },
    listHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#f9fafb",
    },
    listHeaderTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    headerActionBtn: {
        padding: 4,
    },
    listContent: {
        paddingBottom: 20,
    },
    memberItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    memberItemPressed: {
        backgroundColor: "#f3f4f6",
    },
    memberLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
    },
    roleLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    ownerIcon: {
        position: "absolute",
        bottom: -2,
        right: -2,
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 2,
        borderWidth: 1,
        borderColor: "#f3f4f6",
    },
});
