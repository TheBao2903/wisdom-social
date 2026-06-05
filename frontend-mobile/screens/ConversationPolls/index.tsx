import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import DateTimePicker, {
    type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import chatService from "@/services/chatService";
import { useMessagesController } from "@/hooks/useMessagesController";
import type { Message } from "@/types/chat";

function roundToNextFiveMinutes(date: Date): Date {
    const next = new Date(date);
    next.setSeconds(0, 0);
    const remainder = next.getMinutes() % 5;
    if (remainder !== 0) {
        next.setMinutes(next.getMinutes() + (5 - remainder));
    }
    return next;
}

function formatPollExpiryLabel(date: Date | null): string {
    if (!date) return "Không thời hạn";
    return date.toLocaleString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

type PickerMode = "date" | "time";

export function ConversationPollsScreen() {
    const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
    const router = useRouter();
    const id = Number(conversationId);
    const { currentUserId } = useMessagesController();

    const [pollMessages, setPollMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [pollModalOpen, setPollModalOpen] = useState(false);
    const [pollTitle, setPollTitle] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [pollAllowMultipleChoices, setPollAllowMultipleChoices] = useState(true);
    const [pollAllowAddOption, setPollAllowAddOption] = useState(true);
    const [pollAnonymous, setPollAnonymous] = useState(false);
    const [pollExpiresAt, setPollExpiresAt] = useState<Date | null>(null);
    const [expiryModalOpen, setExpiryModalOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const loadPollMessages = useCallback(async () => {
        if (!Number.isFinite(id) || !currentUserId) {
            setPollMessages([]);
            return;
        }

        const cachedPolls = chatRuntimeStore
            .getMessages(id)
            .filter((message) => message.type === "POLL");
        if (cachedPolls.length > 0) {
            setPollMessages(cachedPolls);
        }

        setLoading(true);
        try {
            const response = await chatService.getMessages(
                id,
                currentUserId,
                null,
                100,
            );
            const items = response.data?.data ?? [];
            setPollMessages(items.filter((message) => message.type === "POLL"));
        } catch {
            if (cachedPolls.length === 0) {
                setPollMessages([]);
            }
        } finally {
            setLoading(false);
        }
    }, [currentUserId, id]);

    useEffect(() => {
        void loadPollMessages();
    }, [loadPollMessages]);

    const resetForm = useCallback(() => {
        setPollTitle("");
        setPollOptions(["", ""]);
        setPollAllowMultipleChoices(true);
        setPollAllowAddOption(true);
        setPollAnonymous(false);
        setPollExpiresAt(null);
        setExpiryModalOpen(false);
        setPickerMode(null);
    }, []);

    const closeModal = useCallback(() => {
        if (submitting) return;
        setPollModalOpen(false);
        resetForm();
    }, [resetForm, submitting]);

    const submitPoll = useCallback(async () => {
        const title = pollTitle.trim();
        const options = pollOptions
            .map((option) => option.trim())
            .filter(Boolean);
        const seen = new Set<string>();
        const hasDuplicate = options.some((option) => {
            const key = option.toLowerCase();
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
        });
        if (hasDuplicate) {
            Alert.alert("Lua chon bi trung", "Moi lua chon phai khac nhau.");
            return;
        }
        if (!title || options.length < 2 || submitting) return;
        const expiresAtIso = pollExpiresAt ? pollExpiresAt.toISOString() : null;
        if (pollExpiresAt && pollExpiresAt.getTime() <= Date.now()) {
            Alert.alert("Thời hạn không hợp lệ", "Thời hạn bình chọn phải ở tương lai.");
            return;
        }

        setSubmitting(true);
        try {
            await chatService.createPoll({
                conversationId: id,
                title,
                options,
                allowMultipleChoices: pollAllowMultipleChoices,
                allowAddOption: pollAllowAddOption,
                anonymous: pollAnonymous,
                expiresAt: expiresAtIso,
            });
            setPollModalOpen(false);
            resetForm();
            void loadPollMessages();
        } catch {
            Alert.alert("Không thể tạo bình chọn", "Vui lòng thử lại sau.");
        } finally {
            setSubmitting(false);
        }
    }, [
        id,
        loadPollMessages,
        pollAllowAddOption,
        pollAllowMultipleChoices,
        pollAnonymous,
        pollExpiresAt,
        pollOptions,
        pollTitle,
        resetForm,
        submitting,
    ]);

    const openExpiryPicker = useCallback((mode: PickerMode) => {
        setPollExpiresAt((current) =>
            current ?? roundToNextFiveMinutes(new Date(Date.now() + 60 * 60 * 1000)),
        );
        setPickerMode(mode);
    }, []);

    const handleExpiryPickerChange = useCallback(
        (event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === "dismissed") {
                setPickerMode(null);
                return;
            }
            if (!selectedDate) return;
            setPollExpiresAt((current) => {
                const base = current ?? roundToNextFiveMinutes(new Date(Date.now() + 60 * 60 * 1000));
                const next = new Date(base);
                if (pickerMode === "date") {
                    next.setFullYear(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate(),
                    );
                } else {
                    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                }
                if (next.getTime() <= Date.now()) {
                    return roundToNextFiveMinutes(new Date(Date.now() + 5 * 60 * 1000));
                }
                return next;
            });
            if (pickerMode === "date") {
                setPickerMode("time");
                return;
            }
            setPickerMode(null);
            setExpiryModalOpen(false);
        },
        [pickerMode],
    );

    const normalizedOptions = pollOptions
        .map((option) => option.trim())
        .filter(Boolean);
    const duplicatedOptionValues = normalizedOptions.filter(
        (option, index, arr) =>
            arr.findIndex((item) => item.toLowerCase() === option.toLowerCase()) !== index,
    );
    const optionCount = normalizedOptions.length;
    const canSubmit =
        pollTitle.trim().length > 0 &&
        optionCount >= 2 &&
        duplicatedOptionValues.length === 0 &&
        !submitting;

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Bình chọn</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {pollMessages.length > 0 ? (
                    <View style={styles.pollList}>
                        {pollMessages.map((message) => (
                            <Pressable
                                key={message.id}
                                style={styles.pollListItem}
                                onPress={() =>
                                    router.replace(`/messages/${id}?openMessageId=${message.id}` as any)
                                }
                            >
                                <View style={styles.pollListIcon}>
                                    <Ionicons
                                        name="stats-chart-outline"
                                        size={20}
                                        color={colors.primary}
                                    />
                                </View>
                                <View style={styles.pollListText}>
                                    <Text style={styles.pollListTitle} numberOfLines={1}>
                                        {message.poll?.title ||
                                            message.content ||
                                            "Bình chọn"}
                                    </Text>
                                    <Text style={styles.pollListMeta}>
                                        {message.poll
                                            ? `${message.poll.options.length} lựa chọn · ${message.poll.totalVoteCount} lượt chọn`
                                            : "Bình chọn trong đoạn chat"}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={colors.textMuted}
                                />
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIllustration}>
                            {loading ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Ionicons
                                    name="stats-chart-outline"
                                    size={48}
                                    color={colors.primary}
                                />
                            )}
                        </View>
                        <Text style={styles.emptyText}>
                            {loading ? "Đang tải bình chọn..." : "Chưa có bình chọn"}
                        </Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={styles.createPollButton}
                    onPress={() => setPollModalOpen(true)}
                >
                    <Ionicons
                        name="stats-chart-outline"
                        size={18}
                        color={colors.primary}
                    />
                    <Text style={styles.createPollButtonText}>Tạo bình chọn</Text>
                </Pressable>
            </View>

            <Modal
                visible={pollModalOpen}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tạo bình chọn</Text>
                            <Pressable onPress={closeModal} hitSlop={8}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </Pressable>
                        </View>
                        <ScrollView
                            style={styles.modalBody}
                            contentContainerStyle={styles.modalBodyContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.fieldLabel}>Chủ đề bình chọn</Text>
                            <TextInput
                                value={pollTitle}
                                onChangeText={(value) =>
                                    setPollTitle(value.slice(0, 200))
                                }
                                placeholder="Đặt câu hỏi bình chọn"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                maxLength={200}
                                style={styles.titleInput}
                            />
                            <Text style={styles.counter}>{pollTitle.length}/200</Text>

                            <Text style={styles.fieldLabel}>Các lựa chọn</Text>
                            {pollOptions.map((option, optionIndex) => {
                                const normalized = option.trim().toLowerCase();
                                const duplicated =
                                    normalized.length > 0 &&
                                    pollOptions.findIndex(
                                        (item) => item.trim().toLowerCase() === normalized,
                                    ) !== optionIndex;

                                return (
                                    <View key={optionIndex} style={styles.optionInputRow}>
                                        <TextInput
                                            value={option}
                                            onChangeText={(value) =>
                                                setPollOptions((items) =>
                                                    items.map((item, index) =>
                                                        index === optionIndex ? value : item,
                                                    ),
                                                )
                                            }
                                            placeholder={`Lựa chọn ${optionIndex + 1}`}
                                            placeholderTextColor={colors.textMuted}
                                            style={[
                                                styles.optionInput,
                                                duplicated && styles.optionInputError,
                                            ]}
                                        />
                                        {pollOptions.length > 2 ? (
                                            <Pressable
                                                onPress={() =>
                                                    setPollOptions((items) =>
                                                        items.filter((_, index) => index !== optionIndex),
                                                    )
                                                }
                                                style={styles.removeOptionButton}
                                            >
                                                <Ionicons
                                                    name="close"
                                                    size={16}
                                                    color={colors.textMuted}
                                                />
                                            </Pressable>
                                        ) : null}
                                    </View>
                                );
                            })}
                            {duplicatedOptionValues.length > 0 ? (
                                <Text style={styles.optionErrorText}>
                                    Không được trùng lựa chọn
                                </Text>
                            ) : null}
                            <Pressable
                                style={styles.addOptionButton}
                                onPress={() => setPollOptions((items) => [...items, ""])}
                            >
                                <Ionicons name="add" size={18} color={colors.primary} />
                                <Text style={styles.addOptionButtonText}>Thêm lựa chọn</Text>
                            </Pressable>

                            <Text style={styles.fieldLabel}>Thời hạn bình chọn</Text>
                            <Pressable
                                style={styles.expiryInlineField}
                                onPress={() => setExpiryModalOpen(true)}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.expiryInlineTitle}>Đặt thời hạn</Text>
                                    <Text style={styles.expiryInlineValue}>
                                        {pollExpiresAt
                                            ? formatPollExpiryLabel(pollExpiresAt)
                                            : "Không có thời hạn"}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </Pressable>

                            <View style={styles.settingGroup}>
                                <Text style={styles.settingTitle}>Thiết lập nâng cao</Text>
                                <View style={styles.settingRow}>
                                    <Text style={styles.settingLabel}>Chọn nhiều phương án</Text>
                                    <Switch
                                        value={pollAllowMultipleChoices}
                                        onValueChange={setPollAllowMultipleChoices}
                                        trackColor={{ false: "#D1D5DB", true: colors.primary }}
                                        thumbColor="#FFFFFF"
                                        ios_backgroundColor="#D1D5DB"
                                    />
                                </View>
                                <View style={styles.settingRow}>
                                    <Text style={styles.settingLabel}>Có thể thêm phương án</Text>
                                    <Switch
                                        value={pollAllowAddOption}
                                        onValueChange={setPollAllowAddOption}
                                        trackColor={{ false: "#D1D5DB", true: colors.primary }}
                                        thumbColor="#FFFFFF"
                                        ios_backgroundColor="#D1D5DB"
                                    />
                                </View>
                                <View style={styles.settingRow}>
                                    <Text style={styles.settingLabel}>Ẩn người bình chọn</Text>
                                    <Switch
                                        value={pollAnonymous}
                                        onValueChange={setPollAnonymous}
                                        trackColor={{ false: "#D1D5DB", true: colors.primary }}
                                        thumbColor="#FFFFFF"
                                        ios_backgroundColor="#D1D5DB"
                                    />
                                </View>
                            </View>
                        </ScrollView>
                        <View style={styles.modalActions}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={closeModal}
                                disabled={submitting}
                            >
                                <Text style={styles.cancelButtonText}>Hủy</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.submitButton,
                                    !canSubmit && styles.submitButtonDisabled,
                                ]}
                                disabled={!canSubmit}
                                onPress={() => void submitPoll()}
                            >
                                <Text style={styles.submitButtonText}>
                                    {submitting ? "Đang tạo..." : "Tạo bình chọn"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                    {expiryModalOpen ? (
                        <View style={styles.expirySheetOverlay}>
                            <Pressable
                                style={styles.expirySheetBackdrop}
                                onPress={() => {
                                    setPickerMode(null);
                                    setExpiryModalOpen(false);
                                }}
                            />
                            <View style={styles.expirySheet}>
                                <View style={styles.expirySheetHandle} />
                                <Pressable
                                    style={styles.expirySheetRow}
                                    onPress={() => {
                                        setPollExpiresAt(null);
                                        setPickerMode(null);
                                        setExpiryModalOpen(false);
                                    }}
                                >
                                    <View
                                        style={[
                                            styles.expiryRadio,
                                            !pollExpiresAt && styles.expiryRadioActive,
                                        ]}
                                    >
                                        {!pollExpiresAt ? (
                                            <Ionicons name="checkmark" size={22} color="#fff" />
                                        ) : null}
                                    </View>
                                    <Text style={styles.expirySheetRowText}>
                                        Không giới hạn thời gian
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={styles.expirySheetRow}
                                    onPress={() => openExpiryPicker("date")}
                                >
                                    <View
                                        style={[
                                            styles.expiryRadio,
                                            pollExpiresAt && styles.expiryRadioActive,
                                        ]}
                                    >
                                        {pollExpiresAt ? (
                                            <Ionicons name="checkmark" size={22} color="#fff" />
                                        ) : null}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.expirySheetRowText}>
                                            Chọn thời điểm kết thúc
                                        </Text>
                                        {pollExpiresAt ? (
                                            <Text style={styles.expirySheetSubText}>
                                                {formatPollExpiryLabel(pollExpiresAt)}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={22}
                                        color={colors.textMuted}
                                    />
                                </Pressable>

                                {pickerMode ? (
                                    <View style={styles.expiryPickerPanel}>
                                        <Text style={styles.expiryPickerTitle}>
                                            {pickerMode === "date" ? "Chọn ngày kết thúc" : "Chọn giờ kết thúc"}
                                        </Text>
                                        <DateTimePicker
                                            value={
                                                pollExpiresAt ??
                                                roundToNextFiveMinutes(new Date(Date.now() + 60 * 60 * 1000))
                                            }
                                            mode={pickerMode}
                                            display="spinner"
                                            accentColor={colors.primary}
                                            themeVariant="light"
                                            textColor={colors.text}
                                            style={styles.expiryNativePicker}
                                            minimumDate={new Date()}
                                            onChange={handleExpiryPickerChange}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ) : null}
                </View>
            </Modal>
        </SafeAreaView>
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
        flexGrow: 1,
        padding: 20,
        paddingBottom: 96,
    },
    pollList: {
        gap: 10,
    },
    pollListItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#fff",
    },
    pollListIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: "#eff6ff",
        alignItems: "center",
        justifyContent: "center",
    },
    pollListText: {
        flex: 1,
    },
    pollListTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    pollListMeta: {
        marginTop: 3,
        fontSize: 12,
        color: colors.textMuted,
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 420,
    },
    emptyIllustration: {
        width: 150,
        height: 112,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#dbeafe",
        backgroundColor: "#eff6ff",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: "600",
    },
    footer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: "#fff",
    },
    createPollButton: {
        height: 42,
        borderRadius: 6,
        backgroundColor: "#eaf3ff",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    createPollButtonText: {
        color: colors.primary,
        fontSize: 15,
        fontWeight: "700",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        paddingHorizontal: 18,
        position: "relative",
    },
    modalCard: {
        borderRadius: 10,
        backgroundColor: "#fff",
        overflow: "hidden",
    },
    modalHeader: {
        minHeight: 56,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    modalBody: {
        maxHeight: 520,
    },
    modalBodyContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
    },
    titleInput: {
        minHeight: 106,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        textAlignVertical: "top",
        color: colors.text,
    },
    counter: {
        textAlign: "right",
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
        marginBottom: 16,
    },
    optionInputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    optionInput: {
        flex: 1,
        minHeight: 40,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 12,
        color: colors.text,
    },
    optionInputError: {
        borderColor: "#DC2626",
        backgroundColor: "#FEF2F2",
    },
    optionErrorText: {
        marginBottom: 8,
        color: "#DC2626",
        fontSize: 12,
        fontWeight: "600",
    },
    removeOptionButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    addOptionButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
        marginBottom: 16,
    },
    addOptionButtonText: {
        color: colors.primary,
        fontWeight: "700",
    },
    expiryInlineField: {
        minHeight: 72,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    expiryInlineTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: "700",
    },
    expiryInlineValue: {
        marginTop: 8,
        color: colors.textMuted,
        fontSize: 15,
    },
    expirySheetOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    expirySheetBackdrop: {
        flex: 1,
    },
    expirySheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: "hidden",
        paddingTop: 8,
    },
    expirySheetHandle: {
        alignSelf: "center",
        width: 42,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#D1D5DB",
        marginBottom: 8,
    },
    expirySheetRow: {
        minHeight: 78,
        paddingHorizontal: 22,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#EEF0F3",
    },
    expiryRadio: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: "#D1D5DB",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    expiryRadioActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    expirySheetRowText: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "700",
    },
    expirySheetSubText: {
        marginTop: 4,
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "500",
    },
    expiryPickerPanel: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 18,
        backgroundColor: "#fff",
    },
    expiryPickerTitle: {
        textAlign: "center",
        color: colors.text,
        fontSize: 15,
        fontWeight: "800",
        marginBottom: 4,
    },
    expiryNativePicker: {
        alignSelf: "stretch",
        backgroundColor: "#FFFFFF",
    },
    settingGroup: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 14,
        gap: 10,
    },
    settingTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    settingRow: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    settingLabel: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
    },
    modalActions: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
    },
    cancelButton: {
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 6,
        backgroundColor: "#e5e7eb",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelButtonText: {
        color: colors.text,
        fontWeight: "700",
    },
    submitButton: {
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 6,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    submitButtonDisabled: {
        opacity: 0.45,
    },
    submitButtonText: {
        color: "#fff",
        fontWeight: "700",
    },
});
