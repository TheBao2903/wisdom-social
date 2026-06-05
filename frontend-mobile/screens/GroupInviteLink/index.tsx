import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { colors } from "@/constants";
import { UserAvatar } from "@/components";
import { useMessagesController } from "@/hooks/useMessagesController";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import chatService from "@/services/chatService";
import { buildConversationDisplayInfo } from "@/utils/conversationDisplayInfo";
import { buildGroupInviteUrl } from "@/utils/groupInvite";
import type { Conversation } from "@/types/chat";

export function GroupInviteLinkScreen() {
    const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
    const router = useRouter();
    const id = Number(conversationId);
    const { conversations, currentUserId, reload } = useMessagesController();
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const selectedConversation = useMemo(
        () => conversations.find((item) => item.id === id) || conversation,
        [conversation, conversations, id],
    );

    useEffect(() => {
        let disposed = false;

        const load = async () => {
            if (!Number.isFinite(id) || !currentUserId) return;
            try {
                setLoading(true);
                const response = await chatService.getConversation(id, currentUserId);
                if (disposed) return;
                if (response.success && response.data) {
                    setConversation(response.data);
                    setInviteToken(response.data.inviteToken ?? null);
                    chatRuntimeStore.setConversation(id, response.data);
                }
            } finally {
                if (!disposed) setLoading(false);
            }
        };

        void load();
        return () => {
            disposed = true;
        };
    }, [currentUserId, id]);

    useEffect(() => {
        if (selectedConversation?.inviteToken !== undefined) {
            setInviteToken(selectedConversation.inviteToken ?? null);
        }
    }, [selectedConversation?.inviteToken]);

    const cachedMembers = Object.values(chatRuntimeStore.getMembers(id));
    const members =
        cachedMembers.length > 0
            ? cachedMembers
            : selectedConversation?.members ?? [];
    const currentMember = members.find(
        (member) => Number(member.userId) === Number(currentUserId),
    );
    const canManage =
        currentMember?.role === "OWNER" || currentMember?.role === "DEPUTY";
    const displayInfo = selectedConversation
        ? buildConversationDisplayInfo({
              conversation: selectedConversation,
              currentUserId,
              members,
          })
        : null;
    const inviteUrl = inviteToken ? buildGroupInviteUrl(inviteToken) : "";

    const updateToken = async (nextToken: string | null) => {
        setInviteToken(nextToken);
        if (selectedConversation) {
            const nextConversation = {
                ...selectedConversation,
                inviteToken: nextToken,
            };
            setConversation(nextConversation);
            chatRuntimeStore.setConversation(id, nextConversation);
        }
        await reload();
    };

    const handleCreate = async () => {
        if (!canManage) return;
        try {
            setActionLoading(true);
            const token = await chatService.getOrCreateInviteLink(id);
            await updateToken(token);
        } catch {
            Alert.alert("Không thể tạo link", "Vui lòng thử lại sau.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReset = async () => {
        if (!canManage) return;
        try {
            setActionLoading(true);
            const token = await chatService.resetInviteLink(id);
            await updateToken(token);
        } catch {
            Alert.alert("Không thể đổi link", "Vui lòng thử lại sau.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisable = () => {
        if (!canManage) return;
        Alert.alert("Khóa link tham gia?", "Người khác sẽ không thể dùng link hoặc mã QR hiện tại để tham gia nhóm.", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Khóa link",
                style: "destructive",
                onPress: async () => {
                    try {
                        setActionLoading(true);
                        await chatService.disableInviteLink(id);
                        await updateToken(null);
                    } catch {
                        Alert.alert("Không thể khóa link", "Vui lòng thử lại sau.");
                    } finally {
                        setActionLoading(false);
                    }
                },
            },
        ]);
    };

    const handleCopy = async () => {
        if (!inviteUrl) return;
        await Clipboard.setStringAsync(inviteUrl);
        Alert.alert("Đã sao chép", "Link tham gia nhóm đã được sao chép.");
    };

    const handleShare = async () => {
        if (!inviteUrl) return;
        await Share.share({ message: inviteUrl, url: inviteUrl });
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Link nhóm</Text>
                {inviteToken && canManage ? (
                    <Pressable onPress={handleReset} style={styles.headerBtn}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                    </Pressable>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : !inviteToken ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconRow}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="qr-code-outline" size={38} color="#9db7dc" />
                        </View>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="link-outline" size={42} color="#9db7dc" />
                        </View>
                    </View>
                    <Text style={styles.emptyText}>
                        Mời bất kỳ ai vào nhóm mà không cần kết bạn
                    </Text>
                    {canManage ? (
                        <Pressable
                            disabled={actionLoading}
                            onPress={handleCreate}
                            style={styles.primaryButton}
                        >
                            {actionLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Tạo ngay</Text>
                            )}
                        </Pressable>
                    ) : (
                        <Text style={styles.emptyHint}>
                            Nhóm chưa có link tham gia.
                        </Text>
                    )}
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.groupHeader}>
                        <UserAvatar
                            uri={displayInfo?.avatarUrl || undefined}
                            name={displayInfo?.name || "Nhóm"}
                            size={88}
                        />
                        <Text style={styles.groupName}>{displayInfo?.name || "Nhóm"}</Text>
                        <Text style={styles.description}>
                            Mời mọi người tham gia nhóm bằng mã QR hoặc link dưới đây:
                        </Text>
                    </View>

                    <View style={styles.qrWrap}>
                        <QRCode value={inviteUrl} size={240} />
                    </View>

                    <Pressable style={styles.linkPill} onPress={handleCopy}>
                        <Text style={styles.linkText} numberOfLines={1}>
                            {inviteUrl.replace(/^https?:\/\//, "")}
                        </Text>
                    </Pressable>

                    <View style={styles.actionRow}>
                        <InviteAction icon="copy-outline" label="Sao chép link" onPress={handleCopy} />
                        <InviteAction icon="share-social-outline" label="Chia sẻ link" onPress={handleShare} />
                        {canManage ? (
                            <InviteAction
                                icon="lock-closed-outline"
                                label="Khóa link"
                                destructive
                                onPress={handleDisable}
                            />
                        ) : (
                            <InviteAction icon="qr-code-outline" label="Mã QR" onPress={() => undefined} />
                        )}
                    </View>

                    {canManage && (
                        <Pressable
                            disabled={actionLoading}
                            onPress={handleReset}
                            style={styles.resetButton}
                        >
                            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                            <Text style={styles.resetButtonText}>Đổi link</Text>
                        </Pressable>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function InviteAction({
    icon,
    label,
    onPress,
    destructive,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    destructive?: boolean;
}) {
    return (
        <Pressable style={styles.actionButton} onPress={onPress}>
            <View style={styles.actionIcon}>
                <Ionicons
                    name={icon}
                    size={28}
                    color={destructive ? colors.danger : colors.text}
                />
            </View>
            <Text style={[styles.actionLabel, destructive && styles.actionLabelDanger]}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#fff" },
    header: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyState: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: 28,
        paddingTop: 96,
    },
    emptyIconRow: { flexDirection: "row", marginBottom: 52 },
    emptyIconCircle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        backgroundColor: "#f1f6ff",
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: -4,
    },
    emptyText: {
        fontSize: 22,
        lineHeight: 30,
        textAlign: "center",
        color: "#8b8f98",
    },
    emptyHint: {
        marginTop: 28,
        color: colors.textMuted,
        fontSize: 14,
        textAlign: "center",
    },
    primaryButton: {
        marginTop: 56,
        height: 56,
        width: "100%",
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButtonText: { color: "#fff", fontSize: 20, fontWeight: "700" },
    content: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 34 },
    groupHeader: { alignItems: "center", paddingTop: 42 },
    groupName: {
        marginTop: 24,
        fontSize: 28,
        fontWeight: "900",
        color: colors.text,
        textAlign: "center",
    },
    description: {
        marginTop: 14,
        fontSize: 18,
        lineHeight: 26,
        color: "#777",
        textAlign: "center",
    },
    qrWrap: {
        marginTop: 34,
        padding: 14,
        borderRadius: 8,
        backgroundColor: "#fff",
    },
    linkPill: {
        marginTop: 18,
        maxWidth: "100%",
        borderRadius: 10,
        backgroundColor: "#eef6ff",
        paddingHorizontal: 22,
        paddingVertical: 14,
    },
    linkText: { fontSize: 18, fontWeight: "800", color: colors.primary },
    actionRow: {
        marginTop: 48,
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    actionButton: { alignItems: "center", flex: 1 },
    actionIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#eef1f4",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },
    actionLabel: {
        fontSize: 15,
        color: colors.text,
        textAlign: "center",
        fontWeight: "600",
    },
    actionLabelDanger: { color: colors.danger },
    resetButton: {
        marginTop: 32,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    resetButtonText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
});
