import React, { useMemo, useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    SafeAreaView,
    Switch,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { useMessagesController } from "@/hooks/useMessagesController";
import { useGroupManagement } from "@/hooks/useGroupManagement";
import { useGroupConversationRealtime } from "@/hooks/useGroupConversationRealtime";

export function ManageGroupScreen() {
    const { conversationId } = useLocalSearchParams<{
        conversationId: string;
    }>();
    const router = useRouter();
    const id = Number(conversationId);

    const { conversations, currentUserId, reload } = useMessagesController();

    const selectedConversation = useMemo(
        () => conversations.find((c) => c.id === id) || null,
        [conversations, id],
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

    const [canSendMessages, setCanSendMessages] = useState(
        !selectedConversation?.isMessageRestricted,
    );
    const [joinApprovalRequired, setJoinApprovalRequired] = useState(
        Boolean(selectedConversation?.isJoinApprovalRequired),
    );

    useEffect(() => {
        setCanSendMessages(!selectedConversation?.isMessageRestricted);
    }, [selectedConversation?.isMessageRestricted]);

    useEffect(() => {
        setJoinApprovalRequired(
            Boolean(selectedConversation?.isJoinApprovalRequired),
        );
    }, [selectedConversation?.isJoinApprovalRequired]);

    if (!selectedConversation) return null;

    const isOwner = groupManagement.currentMemberRole === "OWNER";
    const isDeputy = groupManagement.currentMemberRole === "DEPUTY";
    const isAdmin = isOwner || isDeputy;

    const handleToggleSendMessage = async (value: boolean) => {
        const nextIsRestricted = !value;
        setCanSendMessages(value);
        const success =
            await groupManagement.updateMessageRestriction(nextIsRestricted);
        if (!success) {
            setCanSendMessages(!value);
        }
    };

    const handleToggleJoinApproval = async (value: boolean) => {
        if (joinApprovalRequired && !value) {
            const localPendingCount =
                selectedConversation.pendingRequests?.length ?? 0;
            const pendingJoinRequestCount =
                localPendingCount > 0
                    ? localPendingCount
                    : await groupManagement.getPendingJoinRequestCount();

            if (pendingJoinRequestCount <= 0) {
                await commitJoinApprovalChange(value);
                return;
            }

            Alert.alert(
                "Tắt chế độ phê duyệt?",
                `Hiện có ${pendingJoinRequestCount} yêu cầu tham gia đang chờ. Nếu tắt chế độ phê duyệt, tất cả các yêu cầu này sẽ bị hủy.`,
                [
                    { text: "Hủy", style: "cancel" },
                    {
                        text: "Tắt và hủy yêu cầu",
                        style: "destructive",
                        onPress: () => {
                            void commitJoinApprovalChange(value);
                        },
                    },
                ],
            );
            return;
        }

        await commitJoinApprovalChange(value);
    };

    const commitJoinApprovalChange = async (value: boolean) => {
        setJoinApprovalRequired(value);
        const success = await groupManagement.updateJoinApproval(value);
        if (!success) {
            setJoinApprovalRequired(!value);
        }
    };

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
                        if (success) router.replace("/(tabs)/activity");
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Quản lý nhóm</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {!isAdmin && (
                    <View style={styles.notice}>
                        <Ionicons
                            name="lock-closed-outline"
                            size={14}
                            color={colors.textMuted}
                        />
                        <Text style={styles.noticeText}>
                            Tính năng chỉ dành cho quản trị viên
                        </Text>
                    </View>
                )}

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Cho phép thành viên:
                        </Text>
                    </View>

                    <ToggleRow
                        label="Gửi tin nhắn"
                        value={canSendMessages}
                        onValueChange={
                            isAdmin ? handleToggleSendMessage : undefined
                        }
                        disabled={
                            !isAdmin ||
                            groupManagement.isUpdatingMessageRestriction
                        }
                        loading={groupManagement.isUpdatingMessageRestriction}
                        isAdmin={isAdmin}
                    />
                </View>

                <View style={styles.section}>
                    <ToggleRow
                        label="Chế độ phê duyệt thành viên"
                        value={joinApprovalRequired}
                        onValueChange={
                            isAdmin ? handleToggleJoinApproval : undefined
                        }
                        disabled={
                            !isAdmin || groupManagement.isUpdatingJoinApproval
                        }
                        loading={groupManagement.isUpdatingJoinApproval}
                        isAdmin={isAdmin}
                    />
                </View>

                {isOwner && (
                    <View style={[styles.section, { borderTopWidth: 0 }]}>
                        <Pressable
                            style={styles.dangerAction}
                            onPress={handleDisbandGroup}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={20}
                                color={colors.danger}
                            />
                            <Text style={styles.dangerActionText}>
                                Giải tán nhóm
                            </Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function ToggleRow({
    label,
    value,
    onValueChange,
    disabled,
    loading,
    isAdmin,
}: {
    label: string;
    value: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    loading?: boolean;
    isAdmin?: boolean;
}) {
    return (
        <View style={styles.toggleRow}>
            <Text
                style={[
                    styles.toggleLabel,
                    isAdmin && styles.adminLabel,
                    disabled &&
                        !onValueChange &&
                        !isAdmin &&
                        styles.disabledText,
                ]}
            >
                {label}
            </Text>
            {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
            ) : (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    disabled={disabled && !onValueChange}
                    trackColor={{ false: "#e5e7eb", true: colors.primary }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#f4f5f7",
    },
    header: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.text,
    },
    content: {
        paddingBottom: 40,
    },
    notice: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#f0f0f0",
    },
    noticeText: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: "500",
    },
    section: {
        backgroundColor: "#fff",
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: colors.border,
        borderBottomColor: colors.border,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    toggleLabel: {
        fontSize: 15,
        color: colors.text,
        flex: 1,
        marginRight: 10,
    },
    adminLabel: {
        fontWeight: "700",
        color: colors.text,
    },
    disabledText: {
        color: colors.textMuted,
    },
    dangerAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    dangerActionText: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.danger,
    },
});
