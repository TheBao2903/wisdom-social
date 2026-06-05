import React, { useMemo, useState, ComponentProps } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    SafeAreaView,
    ActivityIndicator,
    Modal,
    Image,
    Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors } from "@/constants";
import { UserAvatar, TransferOwnershipModal } from "@/components";
import {
    setActiveConversationId,
    useMessagesController,
} from "@/hooks/useMessagesController";
import { useGroupManagement } from "@/hooks/useGroupManagement";
import { formatRelativeTime } from "@/utils/format";
import { useGroupConversationRealtime } from "@/hooks/useGroupConversationRealtime";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import chatService from "@/services/chatService";
import chatWebsocketService from "@/services/chatWebsocketService";
import { buildConversationDisplayInfo } from "@/utils/conversationDisplayInfo";
import type {
    Conversation,
    ConversationMediaItem,
    ConversationMediaType,
    LocalUploadFile,
} from "@/types/chat";

export function ConversationDetailsScreen() {
    const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
    const router = useRouter();
    const id = Number(conversationId);

    const {
        conversations,
        currentUserId,
        clearUnreadCount,
        reload,
    } = useMessagesController();
    const [fetchedConversation, setFetchedConversation] =
        useState<Conversation | null>(null);
    const [groupImageUploading, setGroupImageUploading] = useState(false);
    const [groupImageError, setGroupImageError] = useState<string | null>(null);
    const [mediaPanelType, setMediaPanelType] =
        useState<ConversationMediaType | null>(null);
    const [mediaItems, setMediaItems] = useState<ConversationMediaItem[]>([]);
    const [mediaCursor, setMediaCursor] = useState<string | null>(null);
    const [mediaHasMore, setMediaHasMore] = useState(false);
    const [mediaLoading, setMediaLoading] = useState(false);

    const selectedConversation = useMemo(
        () =>
            conversations.find((c) => c.id === id) ||
            fetchedConversation ||
            chatRuntimeStore.getConversation(id) ||
            null,
        [conversations, fetchedConversation, id]
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

    useFocusEffect(
        React.useCallback(() => {
            if (!Number.isFinite(id) || !currentUserId) return undefined;

            let unsubscribeMessages: (() => void) | undefined;
            let disposed = false;

            setActiveConversationId(id);
            clearUnreadCount(id);

            const cachedMessages = chatRuntimeStore.getMessages(id);
            const lastMessageId = cachedMessages.at(-1)?.id;
            void chatService
                .markAsRead(id, currentUserId, lastMessageId)
                .catch(() => undefined);
            void chatService
                .getConversation(id, currentUserId)
                .then((response) => {
                    if (disposed) return;
                    if (response.success && response.data) {
                        chatRuntimeStore.setConversation(id, response.data);
                        setFetchedConversation(response.data);
                    }
                })
                .catch(() => undefined);
            const setupMessageReadSync = async () => {
                try {
                    if (!chatWebsocketService.isConnected()) {
                        await chatWebsocketService.connect();
                    }
                    if (disposed) return;

                    unsubscribeMessages =
                        chatWebsocketService.subscribeToConversationMessages(
                            id,
                            (message) => {
                                if (
                                    Number(message.senderId) ===
                                    Number(currentUserId)
                                ) {
                                    return;
                                }

                                clearUnreadCount(id);
                                void chatService
                                    .markAsRead(
                                        id,
                                        currentUserId,
                                        message.id,
                                    )
                                    .catch(() => undefined);
                            },
                        );
                } catch {
                    // The user-conversation subscription still keeps the unread badge local state in sync.
                }
            };

            void setupMessageReadSync();

            return () => {
                disposed = true;
                unsubscribeMessages?.();
                setActiveConversationId(null);
            };
        }, [clearUnreadCount, currentUserId, id]),
    );

    const loadConversationMedia = React.useCallback(
        async (type: ConversationMediaType, cursor: string | null = null) => {
            if (!Number.isFinite(id) || mediaLoading) return;
            setMediaLoading(true);
            try {
                const response = await chatService.getConversationMedia(
                    id,
                    type,
                    cursor,
                    20,
                );
                setMediaItems((prev) =>
                    cursor ? [...prev, ...response.items] : response.items,
                );
                setMediaCursor(response.nextCursor);
                setMediaHasMore(response.hasMore);
            } catch {
                Alert.alert("Thông báo", "Không thể tải nội dung. Vui lòng thử lại.");
            } finally {
                setMediaLoading(false);
            }
        },
        [id, mediaLoading],
    );

    const openMediaPanel = React.useCallback(
        (type: ConversationMediaType) => {
            setMediaPanelType(type);
            setMediaItems([]);
            setMediaCursor(null);
            setMediaHasMore(false);
            void loadConversationMedia(type, null);
        },
        [loadConversationMedia],
    );

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        media: true,
        privacy: true,
    });

    const activityStatus = useMemo(() => {
        if (!selectedConversation?.updatedAt) return "Đang hoạt động gần đây";
        return `Hoạt động ${formatRelativeTime(selectedConversation.updatedAt)} trước`;
    }, [selectedConversation?.updatedAt]);

    if (!selectedConversation) {
        return (
            <SafeAreaView style={styles.root}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.headerBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </Pressable>
                </View>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>Không tìm thấy hội thoại</Text>
                </View>
            </SafeAreaView>
        );
    }

    const isGroup = String(selectedConversation.type).toUpperCase() === "GROUP";
    const cachedMembers = Object.values(chatRuntimeStore.getMembers(id));
    const conversationDisplayInfo = buildConversationDisplayInfo({
        conversation: selectedConversation,
        currentUserId,
        members: cachedMembers.length > 0 ? cachedMembers : undefined,
    });
    const memberCount = groupManagement.groupMembers.length;
    const canReviewJoinRequests =
        groupManagement.currentMemberRole === "OWNER" ||
        groupManagement.currentMemberRole === "DEPUTY";
    const pendingRequestCount = canReviewJoinRequests
        ? (selectedConversation.pendingRequests ?? []).filter(
              (request) => request.status === "PENDING",
          ).length
        : 0;

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleLeaveGroup = () => {
        // If owner and can transfer, skip alert and open modal directly
        if (groupManagement.currentMemberRole === "OWNER" && groupManagement.ownerTransferCandidates.length > 0) {
            groupManagement.leaveGroup();
            return;
        }

        Alert.alert(
            "Rời khỏi nhóm?",
            `Bạn có chắc muốn rời khỏi nhóm "${selectedConversation.name || "này"}"?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Rời nhóm",
                    style: "destructive",
                    onPress: async () => {
                        const success = await groupManagement.leaveGroup();
                        if (success) router.replace("/(tabs)/activity");
                    },
                },
            ]
        );
    };

    const pickAndUploadGroupImage = async () => {
        if (groupImageUploading) return;
        if (!isGroup) {
            Alert.alert("Thong bao", "Chi nhom chat moi co the doi anh dai dien.");
            return;
        }

        try {
            const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                const message = "Can cap quyen thu vien anh de doi anh nhom.";
                setGroupImageError(message);
                Alert.alert("Thong bao", message);
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsMultipleSelection: false,
                quality: 1,
                selectionLimit: 1,
            });

            if (result.canceled || result.assets.length === 0) return;

            const asset = result.assets[0];
            if (asset.type === "video") {
                const message = "Vui long chon anh de lam anh nhom.";
                setGroupImageError(message);
                Alert.alert("Thong bao", message);
                return;
            }

            const fileName =
                asset.fileName ||
                asset.uri.split("/").pop() ||
                `group-avatar-${Date.now()}.jpg`;
            const file: LocalUploadFile = {
                uri: asset.uri,
                fileName,
                mimeType: asset.mimeType || "image/jpeg",
                fileSize: asset.fileSize ?? 1,
            };

            setGroupImageUploading(true);
            setGroupImageError(null);
            const { presignedUrl, objectKey } = await chatService.getPresignedUrl(
                "CONVERSATION",
                String(id),
                "IMAGE",
                file.fileName,
                file.mimeType,
            );
            await chatService.uploadToS3(presignedUrl, file);
            const updatedConversation = await chatService.updateGroupImage(
                id,
                objectKey,
            );
            chatRuntimeStore.setConversation(id, updatedConversation);
            setFetchedConversation(updatedConversation);
            await reload();
        } catch {
            const message = "Khong the cap nhat anh nhom. Vui long thu lai.";
            setGroupImageError(message);
            Alert.alert("Thong bao", message);
        } finally {
            setGroupImageUploading(false);
        }
    };

    const mediaPanelTitle =
        mediaPanelType === "MEDIA"
            ? "File phương tiện"
            : mediaPanelType === "FILE"
              ? "File"
              : "Link";

    const formatMediaDate = (value?: string) => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
        });
    };

    const openMediaItem = (item: ConversationMediaItem) => {
        const target = item.url || item.content;
        if (target) void Linking.openURL(target);
    };

    return (
        <SafeAreaView style={styles.root}>
            {/* Custom Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Chi tiết đoạn chat</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <Pressable
                        style={styles.groupAvatarButton}
                        disabled={groupImageUploading}
                        onPress={pickAndUploadGroupImage}
                        hitSlop={12}
                        android_ripple={{ color: "#E0E7FF", borderless: true }}
                    >
                        <UserAvatar
                            uri={conversationDisplayInfo.avatarUrl || undefined}
                            name={conversationDisplayInfo.name || "?"}
                            size={80}
                        />
                        {isGroup ? (
                            <View pointerEvents="none" style={styles.groupAvatarBadge}>
                                {groupImageUploading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="camera" size={16} color="#fff" />
                                )}
                            </View>
                        ) : null}
                    </Pressable>
                    {groupImageError ? (
                        <Text style={styles.groupImageError}>
                            {groupImageError}
                        </Text>
                    ) : null}
                    <Text style={styles.conversationName}>
                        {conversationDisplayInfo.name}
                    </Text>
                    <Text style={styles.activityStatus}>{activityStatus}</Text>
                    
                    <View style={styles.encryptionBadge}>
                        <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                        <Text style={styles.encryptionText}>Được mã hóa đầu cuối</Text>
                    </View>

                    {/* Quick Actions Row */}
                    <View style={styles.quickActions}>
                        {!isGroup && (
                            <QuickActionBtn
                                icon="person-circle-outline"
                                label="Trang cá nhân"
                                onPress={() => {}}
                            />
                        )}
                        <QuickActionBtn
                            icon="notifications-outline"
                            label="Tắt thông báo"
                            onPress={() => {}}
                        />
                        <QuickActionBtn
                            icon="search-outline"
                            label="Tìm kiếm"
                            onPress={() =>
                                router.replace(`/messages/${id}?openSearch=1`)
                            }
                        />
                        {isGroup && (
                            <QuickActionBtn
                                icon="settings-outline"
                                label="Quản lý nhóm"
                                onPress={() => router.push(`/messages/details/settings/${id}`)}
                                
                            />
                        )}
                    </View>
                </View>

                {/* Sections */}
                <View style={styles.divider} />

                {/* Member Section (Groups only) */}
                {isGroup && (
                    <CollapsibleSection
                        title="Thành viên"
                        isOpen={true} // Member list usually simple link here or collapsible
                        onToggle={() => router.push(`/messages/details/members/${id}`)}
                    >
                        <Pressable 
                            style={styles.memberSummary}
                            onPress={() => router.push(`/messages/details/members/${id}`)}
                        >
                            <View style={styles.memberIconWrap}>
                                <Ionicons name="people" size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.memberSummaryText}>
                                <Text style={styles.memberCountText}>{memberCount} thành viên</Text>
                                {pendingRequestCount > 0 && (
                                    <Text style={styles.pendingRequestText}>
                                        Có {pendingRequestCount} yêu cầu tham gia nhóm
                                    </Text>
                                )}
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </Pressable>
                    </CollapsibleSection>
                )}

                <View style={styles.divider} />

                {isGroup && (
                    <>
                        <DetailItem
                            icon="link-outline"
                            label="Link tham gia nhóm"
                            onPress={() =>
                                router.push(
                                    `/messages/details/invite-link/${id}`,
                                )
                            }
                        />
                        <View style={styles.divider} />
                    </>
                )}

                {isGroup && (
                    <>
                        <DetailItem
                            icon="stats-chart-outline"
                            label="Bình chọn"
                            onPress={() => router.push(`/messages/details/polls/${id}`)}
                        />

                        <View style={styles.divider} />
                    </>
                )}

                <CollapsibleSection
                    title="File phương tiện, File & Link"
                    isOpen={expandedSections.media}
                    onToggle={() => toggleSection("media")}
                >
                    <DetailItem icon="images-outline" label="File phương tiện" onPress={() => openMediaPanel("MEDIA")} />
                    <DetailItem icon="document-text-outline" label="File" onPress={() => openMediaPanel("FILE")} />
                    <DetailItem icon="link-outline" label="Link" onPress={() => openMediaPanel("LINK")} />
                </CollapsibleSection>

                <View style={styles.divider} />

                <CollapsibleSection
                    title="Quyền riêng tư và hỗ trợ"
                    isOpen={expandedSections.privacy}
                    onToggle={() => toggleSection("privacy")}
                >
                    <DetailItem icon="notifications-off-outline" label="Tắt thông báo" onPress={() => {}} />
                    <DetailItem icon="eye-off-outline" label="Hạn chế" onPress={() => {}} />
                    <DetailItem icon="ban-outline" label="Chặn" onPress={() => {}} />
                    <DetailItem 
                        icon="flag-outline" 
                        label="Báo cáo" 
                        subLabel="Đóng góp ý kiến và báo cáo cuộc trò chuyện"
                        onPress={() => {}} 
                    />
                    {isGroup && (
                        <DetailItem 
                            icon="log-out-outline" 
                            label="Rời khỏi nhóm" 
                            onPress={handleLeaveGroup} 
                            destructive 
                        />
                    )}
                </CollapsibleSection>
            </ScrollView>

            <TransferOwnershipModal
                open={groupManagement.isTransferOwnerModalOpen}
                onClose={groupManagement.closeTransferOwnerModal}
                onSubmit={async (newOwnerId) => {
                    const success = await groupManagement.transferOwnershipAndLeave(newOwnerId);
                    if (success) {
                        groupManagement.closeTransferOwnerModal();
                        router.replace("/(tabs)/activity");
                    }
                    return success;
                }}
                members={groupManagement.ownerTransferCandidates}
                submitting={groupManagement.isLeavingGroup}
                pendingUserId={groupManagement.pendingTransferOwnerUserId}
                error={groupManagement.actionError}
            />
            <Modal
                visible={Boolean(mediaPanelType)}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setMediaPanelType(null)}
            >
                <SafeAreaView style={styles.mediaModalRoot}>
                    <View style={styles.mediaModalHeader}>
                        <Text style={styles.mediaModalTitle}>{mediaPanelTitle}</Text>
                        <Pressable
                            onPress={() => setMediaPanelType(null)}
                            hitSlop={10}
                            style={styles.mediaModalCloseBtn}
                        >
                            <Ionicons name="close" size={22} color={colors.text} />
                        </Pressable>
                    </View>
                    <ScrollView
                        contentContainerStyle={styles.mediaModalContent}
                        showsVerticalScrollIndicator
                    >
                        {mediaItems.length === 0 && !mediaLoading ? (
                            <View style={styles.mediaEmptyState}>
                                <Text style={styles.mediaEmptyText}>Chưa có nội dung</Text>
                            </View>
                        ) : mediaPanelType === "MEDIA" ? (
                            <View style={styles.mediaGrid}>
                                {mediaItems.map((item) => (
                                    <Pressable
                                        key={`${item.messageId}-${item.url}`}
                                        style={styles.mediaGridItem}
                                        onPress={() => openMediaItem(item)}
                                    >
                                        {item.type === "VIDEO" ? (
                                            <>
                                                <Image
                                                    source={{ uri: item.url }}
                                                    style={styles.mediaGridImage}
                                                />
                                                <View style={styles.mediaVideoBadge}>
                                                    <Ionicons name="play" size={16} color="#fff" />
                                                </View>
                                            </>
                                        ) : (
                                            <Image
                                                source={{ uri: item.url }}
                                                style={styles.mediaGridImage}
                                            />
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.mediaList}>
                                {mediaItems.map((item) => (
                                    <Pressable
                                        key={`${item.messageId}-${item.url}`}
                                        style={styles.mediaListItem}
                                        onPress={() => openMediaItem(item)}
                                    >
                                        <View style={styles.mediaListIcon}>
                                            <Ionicons
                                                name={mediaPanelType === "LINK" ? "link-outline" : "document-text-outline"}
                                                size={20}
                                                color={colors.primary}
                                            />
                                        </View>
                                        <View style={styles.mediaListBody}>
                                            <Text numberOfLines={2} style={styles.mediaListTitle}>
                                                {item.fileName || item.content || item.url}
                                            </Text>
                                            <Text style={styles.mediaListMeta}>
                                                {formatMediaDate(item.createdAt)}
                                            </Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                        {mediaLoading ? (
                            <ActivityIndicator style={styles.mediaLoading} color={colors.primary} />
                        ) : null}
                        {mediaHasMore ? (
                            <Pressable
                                style={styles.mediaLoadMoreBtn}
                                disabled={mediaLoading}
                                onPress={() =>
                                    mediaPanelType &&
                                    loadConversationMedia(mediaPanelType, mediaCursor)
                                }
                            >
                                <Text style={styles.mediaLoadMoreText}>Xem thêm</Text>
                            </Pressable>
                        ) : null}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

function QuickActionBtn({ icon, label, onPress, disabled }: { icon: ComponentProps<typeof Ionicons>["name"], label: string, onPress: () => void, disabled?: boolean }) {
    return (
        <Pressable 
            style={[styles.quickActionBtn, disabled && styles.quickActionBtnDisabled]} 
            onPress={onPress}
        >
            <View style={styles.quickActionIconWrap}>
                <Ionicons name={icon} size={20} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel}>{label}</Text>
        </Pressable>
    );
}

function CollapsibleSection({ 
    title, 
    isOpen, 
    onToggle, 
    children 
}: { 
    title: string; 
    isOpen: boolean; 
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.collapsibleContainer}>
            <Pressable style={styles.collapsibleHeader} onPress={onToggle}>
                <Text style={styles.collapsibleTitle}>{title}</Text>
                <Ionicons 
                    name={isOpen ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color={colors.textMuted} 
                />
            </Pressable>
            {isOpen && <View style={styles.collapsibleContent}>{children}</View>}
        </View>
    );
}

function DetailItem({
    icon,
    label,
    subLabel,
    onPress,
    destructive,
}: {
    icon: ComponentProps<typeof Ionicons>["name"];
    label: string;
    subLabel?: string;
    onPress: () => void;
    destructive?: boolean;
}) {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.detailItem,
                pressed && styles.detailItemPressed,
            ]}
            onPress={onPress}
        >
            <View style={styles.detailItemLeft}>
                <Ionicons
                    name={icon}
                    size={22}
                    color={destructive ? colors.danger : colors.text}
                />
                <View style={styles.detailItemText}>
                    <Text
                        style={[
                            styles.detailItemLabel,
                            destructive && styles.detailItemLabelDestructive,
                        ]}
                    >
                        {label}
                    </Text>
                    {subLabel && <Text style={styles.detailItemSubLabel}>{subLabel}</Text>}
                </View>
            </View>
        </Pressable>
    );
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
    headerBtn: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    content: {
        paddingBottom: 40,
    },
    profileSection: {
        alignItems: "center",
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 16,
    },
    groupAvatarButton: {
        position: "relative",
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    groupAvatarBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
        borderWidth: 2,
        borderColor: "#fff",
    },
    groupImageError: {
        marginTop: 8,
        color: colors.danger,
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },
    conversationName: {
        fontSize: 22,
        fontWeight: "700",
        color: colors.text,
        marginTop: 16,
        textAlign: "center",
    },
    activityStatus: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 4,
    },
    encryptionBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#f3f4f6",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 16,
    },
    encryptionText: {
        fontSize: 12,
        fontWeight: "500",
        color: colors.textMuted,
    },
    quickActions: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        width: "100%",
        marginTop: 24,
    },
    quickActionBtn: {
        alignItems: "center",
        width: 80,
    },
    quickActionBtnDisabled: {
        opacity: 0.4,
    },
    quickActionIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    quickActionLabel: {
        fontSize: 11,
        color: colors.text,
        textAlign: "center",
        fontWeight: "500",
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginHorizontal: 16,
    },
    collapsibleContainer: {
        paddingVertical: 8,
    },
    collapsibleHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    collapsibleTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.text,
    },
    collapsibleContent: {
        paddingBottom: 8,
    },
    memberSummary: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 12,
    },
    memberIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
        justifyContent: "center",
    },
    memberCountText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    memberSummaryText: {
        flex: 1,
    },
    pendingRequestText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.primary,
        marginTop: 3,
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    detailItemPressed: {
        backgroundColor: "#f9fafb",
    },
    detailItemLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    detailItemText: {
        flex: 1,
    },
    detailItemLabel: {
        fontSize: 15,
        color: colors.text,
        fontWeight: "500",
    },
    detailItemSubLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    detailItemLabelDestructive: {
        color: colors.danger,
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    errorText: {
        color: colors.textMuted,
        fontSize: 16,
    },
    mediaModalRoot: {
        flex: 1,
        backgroundColor: "#fff",
    },
    mediaModalHeader: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    mediaModalTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    mediaModalCloseBtn: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
    },
    mediaModalContent: {
        padding: 16,
        paddingBottom: 32,
    },
    mediaEmptyState: {
        minHeight: 220,
        alignItems: "center",
        justifyContent: "center",
    },
    mediaEmptyText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    mediaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
    },
    mediaGridItem: {
        width: "32.5%",
        aspectRatio: 1,
        borderRadius: 6,
        overflow: "hidden",
        backgroundColor: "#f3f4f6",
    },
    mediaGridImage: {
        width: "100%",
        height: "100%",
    },
    mediaVideoBadge: {
        position: "absolute",
        left: 8,
        bottom: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        alignItems: "center",
        justifyContent: "center",
    },
    mediaList: {
        gap: 8,
    },
    mediaListItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    mediaListIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: "#eef4ff",
        alignItems: "center",
        justifyContent: "center",
    },
    mediaListBody: {
        flex: 1,
    },
    mediaListTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    mediaListMeta: {
        marginTop: 4,
        fontSize: 12,
        color: colors.textMuted,
    },
    mediaLoading: {
        marginVertical: 16,
    },
    mediaLoadMoreBtn: {
        marginTop: 16,
        height: 42,
        borderRadius: 8,
        backgroundColor: "#eef2f7",
        alignItems: "center",
        justifyContent: "center",
    },
    mediaLoadMoreText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "700",
    },
});
