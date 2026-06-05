import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { colors } from "@/constants/colors";
import reportService, {
    REPORT_REASONS,
    type ReportReason,
    type ReportTargetType,
} from "@/services/reportService";

interface ReportModalProps {
    visible: boolean;
    targetType: ReportTargetType;
    targetId: number;
    targetName?: string;
    onClose: () => void;
    /** Gọi khi gửi báo cáo thành công (để hiển thị toast/alert ở màn cha nếu cần). */
    onSubmitted?: (message: string) => void;
}

export default function ReportModal({
    visible,
    targetType,
    targetId,
    targetName,
    onClose,
    onSubmitted,
}: ReportModalProps) {
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setReason(null);
            setDescription("");
            setSubmitting(false);
            setError(null);
        }
    }, [visible]);

    const targetLabel = targetType === "PAGE" ? "trang" : "tài khoản";

    const handleSubmit = async () => {
        if (submitting) return;
        if (!reason) {
            setError("Vui lòng chọn lý do báo cáo");
            return;
        }
        setSubmitting(true);
        setError(null);
        const res = await reportService.createReport({
            targetType,
            targetId,
            reason,
            description: description.trim() || undefined,
        });
        setSubmitting(false);
        if (res.ok) {
            onClose();
            onSubmitted?.(res.message);
        } else {
            setError(res.message);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={submitting ? undefined : onClose}
                />
                <View style={styles.card}>
                    <View style={styles.header}>
                        <View style={styles.headerTitle}>
                            <Ionicons name="flag" size={18} color={colors.danger} />
                            <Text style={styles.title}>Báo cáo {targetLabel}</Text>
                        </View>
                        <Pressable onPress={onClose} disabled={submitting}>
                            <Ionicons name="close" size={22} color={colors.textMuted} />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                        {!!targetName && (
                            <Text style={styles.subtitle}>
                                Bạn đang báo cáo {targetLabel}{" "}
                                <Text style={styles.subtitleStrong}>{targetName}</Text>
                            </Text>
                        )}
                        <Text style={styles.label}>
                            Lý do báo cáo <Text style={styles.required}>*</Text>
                        </Text>
                        {REPORT_REASONS.map((r) => {
                            const selected = reason === r.value;
                            return (
                                <TouchableOpacity
                                    key={r.value}
                                    style={[styles.reasonBtn, selected && styles.reasonBtnSelected]}
                                    onPress={() => setReason(r.value)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={selected ? "radio-button-on" : "radio-button-off"}
                                        size={20}
                                        color={selected ? colors.danger : colors.textMuted}
                                    />
                                    <Text
                                        style={[styles.reasonText, selected && styles.reasonTextSelected]}
                                    >
                                        {r.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}

                        <Text style={[styles.label, { marginTop: 14 }]}>
                            Mô tả chi tiết (tuỳ chọn)
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Cung cấp thêm thông tin giúp quản trị viên xử lý..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={1000}
                            value={description}
                            onChangeText={setDescription}
                        />

                        {!!error && <Text style={styles.error}>{error}</Text>}
                    </ScrollView>

                    <View style={styles.footer}>
                        <Pressable
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={onClose}
                            disabled={submitting}
                        >
                            <Text style={styles.cancelText}>Huỷ</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.btn, styles.submitBtn, (!reason || submitting) && styles.btnDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting || !reason}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <Text style={styles.submitText}>Gửi báo cáo</Text>
                            )}
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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        width: "100%",
        maxHeight: "85%",
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    headerTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontSize: 16, fontWeight: "700", color: colors.text },
    content: { paddingHorizontal: 16, paddingVertical: 14 },
    subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
    subtitleStrong: { fontWeight: "700", color: colors.text },
    label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
    required: { color: colors.danger },
    reasonBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 8,
    },
    reasonBtnSelected: {
        borderColor: colors.danger,
        backgroundColor: "rgba(237,73,86,0.08)",
    },
    reasonText: { fontSize: 14, color: colors.text, flex: 1 },
    reasonTextSelected: { color: colors.danger, fontWeight: "600" },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: colors.text,
        minHeight: 80,
        textAlignVertical: "top",
    },
    error: { color: colors.danger, fontSize: 13, marginTop: 12 },
    footer: {
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    btnDisabled: { opacity: 0.5 },
    cancelBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontSize: 15, fontWeight: "600", color: colors.text },
    submitBtn: { backgroundColor: colors.danger },
    submitText: { fontSize: 15, fontWeight: "600", color: colors.white },
});
