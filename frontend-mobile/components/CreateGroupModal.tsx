import { colors, spacing } from "@/constants";
import chatService from "@/services/chatService";
import type { FriendUser } from "@/services/friendService";
import type { ChatUserSearchResult } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import UserAvatar from "@/components/UserAvatar";
import { buildS3Url } from "@/utils/s3";

type GroupImageFile = {
    uri: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
};

interface CreateGroupSubmitPayload {
    name: string;
    imageUrl?: string;
    memberIds: number[];
    inviteeUserIds?: number[];
}

interface CreateGroupModalProps {
    open: boolean;
    friends: FriendUser[];
    loadingFriends: boolean;
    friendsError: string | null;
    submitting: boolean;
    error: string | null;
    currentUserName?: string;
    onClose: () => void;
    onSubmit: (payload: CreateGroupSubmitPayload) => Promise<boolean>;
}

function getFriendDisplayName(friend: FriendUser): string {
    return friend.name || friend.username || `Nguoi dung ${friend.id}`;
}

export default function CreateGroupModal({
    open,
    friends,
    loadingFriends,
    friendsError,
    submitting,
    error,
    currentUserName,
    onClose,
    onSubmit,
}: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState("");
    const [groupImageFile, setGroupImageFile] = useState<GroupImageFile | null>(
        null,
    );
    const [imageUploadError, setImageUploadError] = useState<string | null>(
        null,
    );
    const [imageUploading, setImageUploading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedInvitees, setSelectedInvitees] = useState<ChatUserSearchResult[]>([]);
    const [phoneSearchResult, setPhoneSearchResult] = useState<ChatUserSearchResult | null>(null);
    const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);

    useEffect(() => {
        if (!open) {
            setGroupName("");
            setGroupImageFile(null);
            setImageUploadError(null);
            setImageUploading(false);
            setSearchKeyword("");
            setSelectedIds([]);
            setSelectedInvitees([]);
            setPhoneSearchResult(null);
            setPhoneSearchLoading(false);
        }
    }, [open]);

    const filteredFriends = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return friends;

        return friends.filter((friend) => {
            const searchable = [
                getFriendDisplayName(friend),
                friend.username,
            ].join(" ");
            return searchable.toLowerCase().includes(keyword);
        });
    }, [friends, searchKeyword]);

    const phoneSearchDigits = searchKeyword.replace(/\D/g, "");
    useEffect(() => {
        if (phoneSearchDigits.length !== 10) {
            setPhoneSearchResult(null);
            setPhoneSearchLoading(false);
            return;
        }
        let cancelled = false;
        setPhoneSearchLoading(true);
        chatService.searchChatUserByPhone(phoneSearchDigits)
            .then((result) => {
                if (!cancelled) setPhoneSearchResult(result);
            })
            .catch(() => {
                if (!cancelled) setPhoneSearchResult(null);
            })
            .finally(() => {
                if (!cancelled) setPhoneSearchLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [phoneSearchDigits]);

    const selectedInviteeIds = selectedInvitees.map((user) => user.userId);
    const selectedCount = selectedIds.length + selectedInviteeIds.length;
    const canSubmit =
        !submitting &&
        !imageUploading &&
        (selectedInviteeIds.length > 0
            ? selectedIds.length >= 1 && selectedCount >= 2
            : selectedIds.length >= 2);

    const toggleSelectedId = (userId: number) => {
        setSelectedIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    const clearSearch = () => {
        setSearchKeyword("");
        setPhoneSearchResult(null);
        setPhoneSearchLoading(false);
    };

    const togglePhoneSearchResult = (result: ChatUserSearchResult) => {
        if (result.friendStatus === "FRIEND") {
            toggleSelectedId(result.userId);
            clearSearch();
            return;
        }
        setSelectedInvitees((prev) =>
            prev.some((user) => user.userId === result.userId)
                ? prev.filter((user) => user.userId !== result.userId)
                : [...prev, result],
        );
        clearSearch();
    };

    const removeInvitee = (userId: number) => {
        setSelectedInvitees((prev) => prev.filter((user) => user.userId !== userId));
    };

    const pickGroupImage = async () => {
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            setImageUploadError("Can cap quyen truy cap thu vien anh.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });

        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        setImageUploadError(null);
        setGroupImageFile({
            uri: asset.uri,
            fileName: asset.fileName || "group-avatar.jpg",
            mimeType: asset.mimeType || "image/jpeg",
            fileSize: asset.fileSize || 0,
        });
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;

        let finalName = groupName.trim();
        if (!finalName) {
            const selectedFriends = friends.filter((friend) =>
                selectedIds.includes(friend.id),
            );
            finalName = [
                currentUserName?.trim(),
                ...selectedFriends.map((friend) => getFriendDisplayName(friend)),
            ]
                .filter((name): name is string => Boolean(name?.trim()))
                .join(", ");
        }

        let uploadedImageKey: string | undefined;

        setImageUploadError(null);
        if (groupImageFile) {
            try {
                setImageUploading(true);
                const { presignedUrl, objectKey } =
                    await chatService.getPresignedUrl(
                        "CONVERSATION",
                        "group-avatars",
                        "IMAGE",
                        groupImageFile.fileName,
                        groupImageFile.mimeType,
                    );
                await chatService.uploadToS3(presignedUrl, groupImageFile);
                uploadedImageKey = objectKey;
            } catch {
                setImageUploadError("Khong the tai anh nhom len. Vui long thu lai.");
                return;
            } finally {
                setImageUploading(false);
            }
        }

        await onSubmit({
            name: finalName,
            imageUrl: uploadedImageKey,
            memberIds: selectedIds,
            inviteeUserIds: selectedInviteeIds,
        });
    };

    return (
        <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.card}>
                    <View style={styles.header}>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.title}>Tao nhom moi</Text>
                            <Text style={styles.subtitle}>
                                Chon it nhat 2 ban be de tao nhom.
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <Ionicons
                                name="close"
                                size={20}
                                color={colors.textMuted}
                            />
                        </Pressable>
                    </View>

                    <View style={styles.formWrap}>
                        <TextInput
                            value={groupName}
                            onChangeText={setGroupName}
                            placeholder="Ten nhom"
                            placeholderTextColor={colors.textMuted}
                            style={styles.input}
                        />
                        <Pressable
                            style={styles.imagePickerRow}
                            onPress={() => void pickGroupImage()}
                        >
                            {groupImageFile ? (
                                <Image
                                    source={{ uri: groupImageFile.uri }}
                                    style={styles.groupImagePreview}
                                />
                            ) : (
                                <View style={styles.groupImagePlaceholder}>
                                    <Ionicons
                                        name="image-outline"
                                        size={22}
                                        color={colors.textMuted}
                                    />
                                </View>
                            )}
                            <View style={styles.imagePickerTextWrap}>
                                <Text
                                    style={styles.imagePickerTitle}
                                    numberOfLines={1}
                                >
                                    {groupImageFile?.fileName ||
                                        "Chon anh nhom tu may"}
                                </Text>
                                <Text style={styles.imagePickerSub}>
                                    JPG, PNG hoac anh tu thu vien
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={colors.textMuted}
                            />
                        </Pressable>
                    </View>

                    <View style={styles.searchWrap}>
                        <Ionicons
                            name="search-outline"
                            size={16}
                            color={colors.textMuted}
                        />
                        <TextInput
                            value={searchKeyword}
                            onChangeText={setSearchKeyword}
                            placeholder="Tim ban be"
                            placeholderTextColor={colors.textMuted}
                            style={styles.searchInput}
                        />
                        {searchKeyword.length > 0 ? (
                            <Pressable onPress={clearSearch} style={styles.clearSearchBtn}>
                                <Ionicons name="close" size={16} color={colors.textMuted} />
                            </Pressable>
                        ) : null}
                    </View>

                    {phoneSearchLoading ? (
                        <Text style={styles.statusText}>
                            Dang tim nguoi dung theo so dien thoai...
                        </Text>
                    ) : null}

                    {phoneSearchResult ? (
                        <Pressable
                            style={[styles.memberRow, styles.memberRowSelected]}
                            onPress={() => togglePhoneSearchResult(phoneSearchResult)}
                        >
                            <UserAvatar
                                uri={buildS3Url(phoneSearchResult.avatarUrl)}
                                name={phoneSearchResult.name}
                                size={38}
                            />
                            <View style={styles.memberMeta}>
                                <Text style={styles.memberName} numberOfLines={1}>
                                    {phoneSearchResult.name}
                                </Text>
                                <Text style={styles.memberUsername} numberOfLines={1}>
                                    {phoneSearchResult.friendStatus === "FRIEND"
                                        ? "Ban be - them truc tiep"
                                        : "Nguoi la - gui link moi"}
                                </Text>
                            </View>
                            <Text style={styles.resultActionText}>
                                {phoneSearchResult.friendStatus === "FRIEND"
                                    ? selectedIds.includes(phoneSearchResult.userId)
                                        ? "Da chon"
                                        : "Chon"
                                    : selectedInviteeIds.includes(phoneSearchResult.userId)
                                      ? "Da moi"
                                      : "Moi link"}
                            </Text>
                        </Pressable>
                    ) : null}

                    {selectedInvitees.length > 0 ? (
                        <View style={styles.inviteeSection}>
                            <Text style={styles.inviteeSectionTitle}>Nguoi la se nhan link moi</Text>
                            <View style={styles.inviteeChips}>
                                {selectedInvitees.map((user) => (
                                    <View key={user.userId} style={styles.inviteeChip}>
                                        <UserAvatar
                                            uri={buildS3Url(user.avatarUrl)}
                                            name={user.name}
                                            size={34}
                                        />
                                        <Text style={styles.inviteeChipName} numberOfLines={1}>
                                            {user.name}
                                        </Text>
                                        <Pressable
                                            onPress={() => removeInvitee(user.userId)}
                                            style={styles.inviteeRemoveBtn}
                                        >
                                            <Ionicons name="close" size={14} color="#64748B" />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}

                    <ScrollView style={styles.listWrap}>
                        {loadingFriends ? (
                            <Text style={styles.statusText}>
                                Dang tai danh sach ban be...
                            </Text>
                        ) : friendsError ? (
                            <Text style={styles.errorText}>{friendsError}</Text>
                        ) : filteredFriends.length === 0 ? (
                            <Text style={styles.statusText}>
                                Khong tim thay ban be phu hop.
                            </Text>
                        ) : (
                            filteredFriends.map((friend) => {
                                const checked = selectedIds.includes(friend.id);
                                return (
                                    <Pressable
                                        key={friend.id}
                                        style={[
                                            styles.memberRow,
                                            checked && styles.memberRowSelected,
                                        ]}
                                        onPress={() =>
                                            toggleSelectedId(friend.id)
                                        }
                                    >
                                        <View style={styles.checkboxOuter}>
                                            {checked ? (
                                                <View
                                                    style={styles.checkboxInner}
                                                />
                                            ) : null}
                                        </View>
                                        <UserAvatar
                                            uri={buildS3Url(friend.avatarUrl)}
                                            name={getFriendDisplayName(friend)}
                                            size={38}
                                        />
                                        <View style={styles.memberMeta}>
                                            <Text
                                                style={styles.memberName}
                                                numberOfLines={1}
                                            >
                                                {getFriendDisplayName(friend)}
                                            </Text>
                                            {friend.username ? (
                                                <Text
                                                    style={
                                                        styles.memberUsername
                                                    }
                                                    numberOfLines={1}
                                                >
                                                    @{friend.username}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </Pressable>
                                );
                            })
                        )}
                    </ScrollView>

                    {error || imageUploadError ? (
                        <Text style={styles.errorText}>
                            {error || imageUploadError}
                        </Text>
                    ) : null}

                    <View style={styles.footer}>
                        <Text style={styles.selectedText}>
                            Da chon {selectedIds.length} thanh vien, {selectedInviteeIds.length} nguoi nhan link
                        </Text>
                        <View style={styles.actions}>
                            <Pressable
                                style={styles.cancelBtn}
                                onPress={onClose}
                            >
                                <Text style={styles.cancelBtnText}>Huy</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.confirmBtn,
                                    !canSubmit && styles.confirmBtnDisabled,
                                ]}
                                onPress={() => void handleSubmit()}
                                disabled={!canSubmit}
                            >
                                <Text style={styles.confirmBtnText}>
                                    {imageUploading
                                        ? "Dang tai anh..."
                                        : submitting
                                          ? "Dang tao..."
                                          : "Tao nhom"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    card: {
        maxHeight: "90%",
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: spacing.md,
        gap: spacing.sm,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    headerTextWrap: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    subtitle: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    formWrap: {
        gap: spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        minHeight: 40,
        color: colors.text,
        paddingHorizontal: spacing.sm,
    },
    imagePickerRow: {
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    groupImagePreview: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E5E7EB",
    },
    groupImagePlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    imagePickerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    imagePickerTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    imagePickerSub: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: spacing.sm,
    },
    searchInput: {
        flex: 1,
        minHeight: 38,
        color: colors.text,
    },
    clearSearchBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    inviteeSection: {
        gap: spacing.xs,
    },
    inviteeSectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.textMuted,
    },
    inviteeChips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
    },
    inviteeChip: {
        maxWidth: "48%",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        paddingVertical: 4,
        paddingLeft: 4,
        paddingRight: 6,
    },
    inviteeChipName: {
        flex: 1,
        minWidth: 0,
        fontSize: 12,
        fontWeight: "700",
        color: colors.text,
    },
    inviteeRemoveBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E2E8F0",
    },
    listWrap: {
        maxHeight: 330,
    },
    statusText: {
        textAlign: "center",
        color: colors.textMuted,
        paddingVertical: spacing.lg,
    },
    errorText: {
        color: "#B91C1C",
        fontSize: 12,
    },
    memberRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.sm,
        marginBottom: spacing.xs,
    },
    memberRowSelected: {
        borderColor: "#93C5FD",
        backgroundColor: "#EFF6FF",
    },
    checkboxOuter: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxInner: {
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: "#2563EB",
    },
    memberMeta: {
        flex: 1,
        minWidth: 0,
    },
    memberName: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    memberUsername: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    resultActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2563EB",
    },
    footer: {
        gap: spacing.sm,
    },
    selectedText: {
        fontSize: 13,
        color: colors.textMuted,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: spacing.sm,
    },
    cancelBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 10,
        backgroundColor: "#E5E7EB",
    },
    cancelBtnText: {
        color: colors.text,
        fontWeight: "600",
    },
    confirmBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 10,
        backgroundColor: "#2563EB",
    },
    confirmBtnDisabled: {
        opacity: 0.5,
    },
    confirmBtnText: {
        color: colors.white,
        fontWeight: "700",
    },
});
