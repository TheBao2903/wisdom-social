import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { UserAvatar } from "@/components";
import chatService from "@/services/chatService";
import chatWebsocketService from "@/services/chatWebsocketService";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import { useAppContext } from "@/context/AppContext";
import { setActiveConversationId } from "@/hooks/useMessagesController";
import type { Conversation, ConversationPreview, InviteUserStatus } from "@/types/chat";
import { requestInviteReturnSync } from "@/utils/inviteReturnSync";

function resolveJoinedConversationId(
    payload: Conversation | { message?: string },
): number | null {
    if (!payload || typeof payload !== "object") return null;
    const record = payload as Record<string, unknown>;
    const id = Number(record.conversationId ?? record.id);
    return Number.isFinite(id) ? id : null;
}

function pickMessage(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    return (
        pickMessage(record.message) ||
        pickMessage(record.error) ||
        pickMessage(record.data) ||
        pickMessage(record.errors)
    );
}

function extractApiErrorMessage(error: unknown): string | null {
    if (error && typeof error === "object") {
        const responseData = (
            error as { response?: { data?: unknown } }
        ).response?.data;
        const fromResponse = pickMessage(responseData);
        if (fromResponse) return fromResponse;
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }

    return null;
}

export function GroupInviteScreen() {
    const { token, returnConversationId, returnTo } = useLocalSearchParams<{
        token: string;
        returnConversationId?: string;
        returnTo?: string;
    }>();
    const router = useRouter();
    const { currentUser } = useAppContext();
    const currentUserId = Number(currentUser?.id ?? 0);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<ConversationPreview | null>(null);
    const [userStatus, setUserStatus] = useState<InviteUserStatus | null>(null);

    const loadPreview = useCallback(async () => {
        if (!token) {
            setError("Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");
            const data = await chatService.previewInvite(token);
            if (data.userStatus === "ACTIVE") {
                router.replace({
                    pathname: "/(stack)/messages/[conversationId]",
                    params: {
                        conversationId: String(data.conversationId),
                        refreshAt: String(Date.now()),
                        backToMessages: "1",
                    },
                });
                return;
            }
            setPreview(data);
            setUserStatus(data.userStatus);
        } catch {
            setError("Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa.");
        } finally {
            setLoading(false);
        }
    }, [router, token]);

    useEffect(() => {
        void loadPreview();
    }, [loadPreview]);

    useFocusEffect(
        useCallback(() => {
            const sourceConversationId = Number(returnConversationId);
            if (!Number.isFinite(sourceConversationId) || !currentUserId) {
                return undefined;
            }

            let disposed = false;
            let unsubscribeMessages: (() => void) | undefined;

            setActiveConversationId(sourceConversationId);

            const markLatestAsRead = async () => {
                const cachedMessages =
                    chatRuntimeStore.getMessages(sourceConversationId);
                const lastMessageId = cachedMessages.at(-1)?.id;
                chatRuntimeStore.patchConversation(sourceConversationId, {
                    unreadCount: 0,
                });
                await chatService
                    .markAsRead(
                        sourceConversationId,
                        currentUserId,
                        lastMessageId,
                    )
                    .catch(() => undefined);
            };

            void markLatestAsRead();

            const setupRealtimeReadSync = async () => {
                try {
                    if (!chatWebsocketService.isConnected()) {
                        await chatWebsocketService.connect();
                    }
                    if (disposed) return;

                    unsubscribeMessages =
                        chatWebsocketService.subscribeToConversationMessages(
                            sourceConversationId,
                            (message) => {
                                if (
                                    Number(message.senderId) ===
                                    Number(currentUserId)
                                ) {
                                    return;
                                }

                                chatRuntimeStore.patchConversation(
                                    sourceConversationId,
                                    { unreadCount: 0 },
                                );
                                void chatService
                                    .markAsRead(
                                        sourceConversationId,
                                        currentUserId,
                                        message.id,
                                    )
                                    .catch(() => undefined);
                            },
                        );
                } catch {
                    // Best effort: if socket is unavailable, the chat screen will sync on return.
                }
            };

            void setupRealtimeReadSync();

            return () => {
                disposed = true;
                unsubscribeMessages?.();
                setActiveConversationId(null);
            };
        }, [currentUserId, returnConversationId]),
    );

    const navigateBackWithRefresh = useCallback(() => {
        const sourceConversationId = Number(returnConversationId);
        const refreshAt = String(Date.now());

        if (Number.isFinite(sourceConversationId)) {
            requestInviteReturnSync(sourceConversationId);
            router.back();
            return;
        }

        if (returnTo === "messages") {
            router.replace({
                pathname: "/(tabs)/activity",
                params: { refreshAt },
            });
            return;
        }

        router.back();
    }, [returnConversationId, returnTo, router]);

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                navigateBackWithRefresh();
                return true;
            },
        );

        return () => subscription.remove();
    }, [navigateBackWithRefresh]);

    const handleJoin = async () => {
        if (!token || userStatus !== "NOT_MEMBER") return;

        try {
            setJoining(true);
            const response = await chatService.joinByInvite(token);
            const conversationId = resolveJoinedConversationId(response);
            if (conversationId) {
                router.replace({
                    pathname: "/(stack)/messages/[conversationId]",
                    params: {
                        conversationId: String(conversationId),
                        refreshAt: String(Date.now()),
                        backToMessages: "1",
                    },
                });
                return;
            }

            setUserStatus("PENDING");
            const sourceConversationId = Number(returnConversationId);
            if (Number.isFinite(sourceConversationId)) {
                requestInviteReturnSync(sourceConversationId);
                router.back();
                setTimeout(() => {
                    Alert.alert(
                        "Đang chờ phê duyệt",
                        "Yêu cầu tham gia nhóm của bạn đã được gửi đến trưởng/phó nhóm.",
                    );
                }, 250);
                return;
            }

            router.replace({
                pathname: "/(tabs)/activity",
                params: {
                    refreshAt: String(Date.now()),
                    pendingJoinNotice: "1",
                },
            });
            return;
        } catch (err) {
            const message = extractApiErrorMessage(err);
            Alert.alert("Không thể tham gia", message || "Bạn đã bị chặn khỏi nhóm này");
        } finally {
            setJoining(false);
        }
    };

    const handleCancelRequest = async () => {
        if (!preview || userStatus !== "PENDING") return;

        try {
            setCancelling(true);
            await chatService.cancelMyJoinRequest(preview.conversationId);
            setUserStatus("NOT_MEMBER");
            Alert.alert(
                "Đã hủy yêu cầu",
                "Yêu cầu tham gia nhóm của bạn đã được hủy.",
            );
        } catch (err) {
            const message = extractApiErrorMessage(err);
            Alert.alert(
                "Không thể hủy yêu cầu",
                message || "Vui lòng thử lại sau.",
            );
        } finally {
            setCancelling(false);
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Pressable onPress={navigateBackWithRefresh} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Tham gia nhóm</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <View style={styles.errorIcon}>
                        <Ionicons name="link-outline" size={34} color={colors.danger} />
                    </View>
                    <Text style={styles.errorTitle}>Link không khả dụng</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable
                        style={styles.homeButton}
                        onPress={() => router.replace("/(tabs)/activity")}
                    >
                        <Text style={styles.homeButtonText}>Quay về trang chủ</Text>
                    </Pressable>
                </View>
            ) : preview ? (
                <View style={styles.card}>
                    <UserAvatar
                        uri={preview.imageUrl || undefined}
                        name={preview.name}
                        size={88}
                    />
                    <Text style={styles.groupName}>{preview.name}</Text>
                    <Text style={styles.memberCount}>{preview.memberCount} thành viên</Text>
                    {preview.isJoinApprovalRequired && (
                        <Text style={styles.approvalNote}>
                            Nhóm này yêu cầu Quản trị viên phê duyệt
                        </Text>
                    )}
                    <Pressable
                        disabled={joining || cancelling}
                        onPress={
                            userStatus === "PENDING"
                                ? handleCancelRequest
                                : handleJoin
                        }
                        style={[
                            styles.joinButton,
                            userStatus === "PENDING" && styles.pendingButton,
                        ]}
                    >
                        {joining || cancelling ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text
                                style={[
                                    styles.joinButtonText,
                                    userStatus === "PENDING" && styles.pendingButtonText,
                                ]}
                            >
                                {userStatus === "PENDING"
                                    ? "Hủy yêu cầu"
                                    : "Tham gia nhóm"}
                            </Text>
                        )}
                    </Pressable>
                </View>
            ) : null}
        </SafeAreaView>
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
    headerBtn: { padding: 8, marginLeft: -8 },
    headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    errorIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#fee2e2",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    errorTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
    errorText: {
        marginTop: 8,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 20,
    },
    homeButton: {
        marginTop: 24,
        height: 44,
        paddingHorizontal: 22,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    homeButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    card: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
    },
    groupName: {
        marginTop: 18,
        fontSize: 24,
        fontWeight: "800",
        color: colors.text,
        textAlign: "center",
    },
    memberCount: { marginTop: 8, fontSize: 15, color: colors.textMuted },
    approvalNote: {
        marginTop: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#fffbeb",
        color: "#b45309",
        textAlign: "center",
        lineHeight: 20,
    },
    joinButton: {
        marginTop: 30,
        height: 48,
        borderRadius: 24,
        minWidth: 210,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    pendingButton: { backgroundColor: "#e5e7eb" },
    joinButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    pendingButtonText: { color: colors.textMuted },
});
