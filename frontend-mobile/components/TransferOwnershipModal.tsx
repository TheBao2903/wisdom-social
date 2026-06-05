import { colors, spacing } from "@/constants";
import type { ConversationMember } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import UserAvatar from "@/components/UserAvatar";

interface TransferOwnershipModalProps {
    open: boolean;
    members: ConversationMember[];
    submitting: boolean;
    pendingUserId: number | null;
    error: string | null;
    onClose: () => void;
    onSubmit: (newOwnerUserId: number) => Promise<boolean>;
}

function getDisplayName(member: ConversationMember): string {
    return member.nickname || member.username || `Nguoi dung ${member.userId}`;
}

export default function TransferOwnershipModal({
    open,
    members,
    submitting,
    pendingUserId,
    error,
    onClose,
    onSubmit,
}: TransferOwnershipModalProps) {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

    useEffect(() => {
        if (!open) {
            setSearchKeyword("");
            setSelectedUserId(null);
            return;
        }

        if (members.length > 0) {
            setSelectedUserId((prev) => prev ?? members[0].userId);
        }
    }, [members, open]);

    const filteredMembers = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return members;

        return members.filter((member) => {
            const searchable = [
                getDisplayName(member),
                member.username || "",
            ].join(" ");
            return searchable.toLowerCase().includes(keyword);
        });
    }, [members, searchKeyword]);

    const handleSubmit = async () => {
        if (!selectedUserId || submitting) return;
        await onSubmit(selectedUserId);
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
                        <Text style={styles.title}>
                            Chon truong nhom moi truoc khi roi
                        </Text>
                        <Pressable
                            onPress={onClose}
                            disabled={submitting}
                            style={styles.closeBtn}
                        >
                            <Ionicons
                                name="close"
                                size={20}
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
                            placeholder="Tim kiem"
                            placeholderTextColor={colors.textMuted}
                            style={styles.searchInput}
                        />
                    </View>

                    <ScrollView style={styles.listWrap}>
                        {filteredMembers.length === 0 ? (
                            <Text style={styles.emptyText}>
                                Khong tim thay thanh vien phu hop.
                            </Text>
                        ) : (
                            filteredMembers.map((member) => {
                                const checked =
                                    Number(selectedUserId) ===
                                    Number(member.userId);

                                return (
                                    <Pressable
                                        key={member.userId}
                                        style={[
                                            styles.memberRow,
                                            checked && styles.memberRowSelected,
                                        ]}
                                        onPress={() =>
                                            setSelectedUserId(member.userId)
                                        }
                                    >
                                        <View style={styles.radioOuter}>
                                            {checked ? (
                                                <View
                                                    style={styles.radioInner}
                                                />
                                            ) : null}
                                        </View>
                                        <UserAvatar
                                            uri={member.avatar}
                                            name={getDisplayName(member)}
                                            size={38}
                                        />
                                        <View style={styles.memberMeta}>
                                            <Text
                                                style={styles.memberName}
                                                numberOfLines={1}
                                            >
                                                {getDisplayName(member)}
                                            </Text>
                                            {member.username ? (
                                                <Text
                                                    style={
                                                        styles.memberUsername
                                                    }
                                                    numberOfLines={1}
                                                >
                                                    @{member.username}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </Pressable>
                                );
                            })
                        )}
                    </ScrollView>

                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    <View style={styles.actions}>
                        <Pressable
                            style={styles.cancelBtn}
                            onPress={onClose}
                            disabled={submitting}
                        >
                            <Text style={styles.cancelBtnText}>Huy</Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.confirmBtn,
                                (!selectedUserId || submitting) &&
                                    styles.confirmBtnDisabled,
                            ]}
                            onPress={() => void handleSubmit()}
                            disabled={!selectedUserId || submitting}
                        >
                            <Text style={styles.confirmBtnText}>
                                {pendingUserId
                                    ? "Dang chuyen truong nhom..."
                                    : "Chon va tiep tuc"}
                            </Text>
                        </Pressable>
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
        maxHeight: "86%",
        borderRadius: 16,
        backgroundColor: colors.white,
        padding: spacing.md,
        gap: spacing.sm,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingHorizontal: spacing.sm,
    },
    searchInput: {
        flex: 1,
        minHeight: 38,
        color: colors.text,
    },
    listWrap: {
        maxHeight: 330,
    },
    emptyText: {
        textAlign: "center",
        color: colors.textMuted,
        paddingVertical: spacing.lg,
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
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
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
    errorText: {
        color: "#B91C1C",
        fontSize: 12,
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
