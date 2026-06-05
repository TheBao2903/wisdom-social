import { colors, spacing } from "@/constants";
import type {
    Conversation,
    ConversationMember,
    MemberRole,
} from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import UserAvatar from "@/components/UserAvatar";
import TransferOwnershipModal from "@/components/TransferOwnershipModal";
import { LOCKED_ACCOUNT_NAME } from "@/utils/lockedAccount";

interface GroupConversationPanelProps {
    conversation: Conversation;
    currentUserId: number;
    canManageMembers: boolean;
    canAddMembers: boolean;
    canUpdateRole: boolean;
    canDisbandGroup: boolean;
    isLeavingGroup: boolean;
    isDisbandingGroup: boolean;
    isTransferOwnerModalOpen: boolean;
    pendingKickUserId: number | null;
    pendingRoleUserId: number | null;
    pendingTransferOwnerUserId: number | null;
    ownerTransferCandidates: ConversationMember[];
    actionError: string | null;
    onOpenAddMembersModal: () => void;
    onLeaveGroup: () => Promise<boolean>;
    onCloseTransferOwnerModal: () => void;
    onTransferOwnershipAndLeave: (newOwnerUserId: number) => Promise<boolean>;
    onDisbandGroup: () => Promise<boolean>;
    onKickMember: (targetUserId: number) => Promise<boolean>;
    onUpdateMemberRole: (
        targetUserId: number,
        nextRole: MemberRole,
    ) => Promise<boolean>;
}

function roleLabel(role?: MemberRole): string {
    if (role === "OWNER") return "Truong nhom";
    if (role === "DEPUTY") return "Pho nhom";
    return "Thanh vien";
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

export default function GroupConversationPanel({
    conversation,
    currentUserId,
    canManageMembers,
    canAddMembers,
    canUpdateRole,
    canDisbandGroup,
    isLeavingGroup,
    isDisbandingGroup,
    isTransferOwnerModalOpen,
    pendingKickUserId,
    pendingRoleUserId,
    pendingTransferOwnerUserId,
    ownerTransferCandidates,
    actionError,
    onOpenAddMembersModal,
    onLeaveGroup,
    onCloseTransferOwnerModal,
    onTransferOwnershipAndLeave,
    onDisbandGroup,
    onKickMember,
    onUpdateMemberRole,
}: GroupConversationPanelProps) {
    const members = useMemo(
        () =>
            sortMembers(
                (conversation.members ?? []).filter(
                    (member) => !member.status || member.status === "ACTIVE",
                ),
            ),
        [conversation.members],
    );

    const memberCount = members.length;

    const handleLeaveGroup = () => {
        Alert.alert(
            "Roi khoi nhom?",
            `Ban co chac muon roi khoi nhom "${conversation.name || "nay"}"?`,
            [
                { text: "Huy", style: "cancel" },
                {
                    text: "Roi nhom",
                    style: "destructive",
                    onPress: () => {
                        void onLeaveGroup();
                    },
                },
            ],
        );
    };

    const handleDisbandGroup = () => {
        Alert.alert(
            "Giai tan nhom?",
            `Giai tan nhom "${conversation.name || "nay"}" se ket thuc cuoc tro chuyen cho tat ca thanh vien.`,
            [
                { text: "Huy", style: "cancel" },
                {
                    text: "Giai tan",
                    style: "destructive",
                    onPress: () => {
                        void onDisbandGroup();
                    },
                },
            ],
        );
    };

    const handleKick = (member: ConversationMember) => {
        const label = member.nickname || member.username || "thanh vien nay";
        Alert.alert("Duoi thanh vien?", `Ban co chac muon duoi ${label}?`, [
            { text: "Huy", style: "cancel" },
            {
                text: "Duoi",
                style: "destructive",
                onPress: () => {
                    void onKickMember(member.userId);
                },
            },
        ]);
    };

    return (
        <View style={styles.root}>
            <View style={styles.headerRow}>
                <View style={styles.headerMeta}>
                    <Text style={styles.sectionTitle}>Quan ly nhom</Text>
                    <Text style={styles.sectionSubtitle}>
                        {memberCount} thanh vien
                    </Text>
                </View>

                {canAddMembers ? (
                    <Pressable
                        style={styles.addBtn}
                        onPress={onOpenAddMembersModal}
                    >
                        <Ionicons
                            name="person-add-outline"
                            size={14}
                            color="#1D4ED8"
                        />
                        <Text style={styles.addBtnText}>Them nguoi</Text>
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.actionsWrap}>
                <Pressable
                    style={styles.leaveBtn}
                    onPress={handleLeaveGroup}
                    disabled={isLeavingGroup || isDisbandingGroup}
                >
                    <Ionicons
                        name="log-out-outline"
                        size={14}
                        color={colors.text}
                    />
                    <Text style={styles.leaveBtnText}>
                        {isLeavingGroup ? "Dang roi nhom..." : "Roi nhom"}
                    </Text>
                </Pressable>

                {canDisbandGroup ? (
                    <Pressable
                        style={styles.disbandBtn}
                        onPress={handleDisbandGroup}
                        disabled={isDisbandingGroup || isLeavingGroup}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={14}
                            color="#B91C1C"
                        />
                        <Text style={styles.disbandBtnText}>
                            {isDisbandingGroup
                                ? "Dang giai tan..."
                                : "Giai tan nhom"}
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            {actionError ? (
                <Text style={styles.errorText}>{actionError}</Text>
            ) : null}

            <ScrollView style={styles.membersWrap}>
                {members.map((member) => {
                    const isCurrentUser = member.userId === currentUserId;
                    const isOwner = member.role === "OWNER";
                    const isUpdatingRole = pendingRoleUserId === member.userId;
                    const isKicking = pendingKickUserId === member.userId;

                    return (
                        <View key={member.userId} style={styles.memberCard}>
                            <View style={styles.memberMainRow}>
                                <UserAvatar
                                    uri={member.accountLocked ? undefined : member.avatar}
                                    name={
                                        member.accountLocked
                                            ? LOCKED_ACCOUNT_NAME
                                            : member.nickname ||
                                              member.username ||
                                              "?"
                                    }
                                    size={36}
                                    locked={member.accountLocked}
                                />
                                <View style={styles.memberIdentity}>
                                    <Text
                                        style={styles.memberName}
                                        numberOfLines={1}
                                    >
                                        {member.accountLocked
                                            ? LOCKED_ACCOUNT_NAME
                                            : member.nickname ||
                                              member.username ||
                                              "Nguoi dung"}
                                        {isCurrentUser ? " (Ban)" : ""}
                                    </Text>
                                    {member.username && !member.accountLocked ? (
                                        <Text
                                            style={styles.memberUsername}
                                            numberOfLines={1}
                                        >
                                            @{member.username}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={styles.roleBadge}>
                                    <Text style={styles.roleBadgeText}>
                                        {roleLabel(member.role)}
                                    </Text>
                                </View>
                            </View>

                            {(canUpdateRole || canManageMembers) &&
                            !isCurrentUser ? (
                                <View style={styles.memberActions}>
                                    {canUpdateRole && !isOwner ? (
                                        <View style={styles.roleSwitchRow}>
                                            {(
                                                [
                                                    "MEMBER",
                                                    "DEPUTY",
                                                    "OWNER",
                                                ] as MemberRole[]
                                            ).map((role) => {
                                                const active =
                                                    (member.role ??
                                                        "MEMBER") === role;
                                                return (
                                                    <Pressable
                                                        key={`${member.userId}-${role}`}
                                                        onPress={() =>
                                                            void onUpdateMemberRole(
                                                                member.userId,
                                                                role,
                                                            )
                                                        }
                                                        disabled={
                                                            isUpdatingRole
                                                        }
                                                        style={[
                                                            styles.roleBtn,
                                                            active &&
                                                                styles.roleBtnActive,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.roleBtnText,
                                                                active &&
                                                                    styles.roleBtnTextActive,
                                                            ]}
                                                        >
                                                            {roleLabel(role)}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    ) : null}

                                    {canManageMembers && !isOwner ? (
                                        <Pressable
                                            style={styles.kickBtn}
                                            onPress={() => handleKick(member)}
                                            disabled={isKicking}
                                        >
                                            <Text style={styles.kickBtnText}>
                                                {isKicking
                                                    ? "Dang duoi..."
                                                    : "Duoi khoi nhom"}
                                            </Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    );
                })}
            </ScrollView>

            <TransferOwnershipModal
                open={isTransferOwnerModalOpen}
                members={ownerTransferCandidates}
                submitting={isLeavingGroup}
                pendingUserId={pendingTransferOwnerUserId}
                error={actionError}
                onClose={onCloseTransferOwnerModal}
                onSubmit={onTransferOwnershipAndLeave}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        gap: spacing.sm,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    headerMeta: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    sectionSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: "#BFDBFE",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: "#EFF6FF",
    },
    addBtnText: {
        color: "#1D4ED8",
        fontSize: 12,
        fontWeight: "600",
    },
    actionsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
    },
    leaveBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    leaveBtnText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "600",
    },
    disbandBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: "#FECACA",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: "#FEF2F2",
    },
    disbandBtnText: {
        color: "#B91C1C",
        fontSize: 12,
        fontWeight: "600",
    },
    errorText: {
        color: "#B91C1C",
        fontSize: 12,
    },
    membersWrap: {
        maxHeight: 420,
    },
    memberCard: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.sm,
        marginBottom: spacing.xs,
        gap: spacing.xs,
    },
    memberMainRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    memberIdentity: {
        flex: 1,
        minWidth: 0,
    },
    memberName: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    memberUsername: {
        marginTop: 1,
        fontSize: 12,
        color: colors.textMuted,
    },
    roleBadge: {
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    roleBadgeText: {
        color: "#4B5563",
        fontSize: 10,
        fontWeight: "700",
    },
    memberActions: {
        gap: spacing.xs,
    },
    roleSwitchRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    roleBtn: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    roleBtnActive: {
        borderColor: "#2563EB",
        backgroundColor: "#EFF6FF",
    },
    roleBtnText: {
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: "600",
    },
    roleBtnTextActive: {
        color: "#1D4ED8",
    },
    kickBtn: {
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: "#FECACA",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        backgroundColor: "#FEF2F2",
    },
    kickBtnText: {
        color: "#B91C1C",
        fontSize: 11,
        fontWeight: "700",
    },
});
