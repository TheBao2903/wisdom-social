import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants";

interface AIConsentModalProps {
    open: boolean;
    loading?: boolean;
    error?: string | null;
    onAccept: () => void;
    onDecline: () => void;
}

export default function AIConsentModal({
    open,
    loading = false,
    error,
    onAccept,
    onDecline,
}: AIConsentModalProps) {
    return (
        <Modal transparent animationType="fade" visible={open}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>Xác nhận sử dụng AI</Text>
                    <Text style={styles.body}>
                        Để tạo tóm tắt và gợi ý trả lời, một phần nội dung cuộc trò
                        chuyện sẽ được gửi tới AI provider theo chính sách hệ thống.
                    </Text>
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <View style={styles.actions}>
                        <Pressable
                            style={[styles.secondaryBtn, loading && styles.disabled]}
                            disabled={loading}
                            onPress={onDecline}
                        >
                            <Text style={styles.secondaryText}>Từ chối</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.primaryBtn, loading && styles.disabled]}
                            disabled={loading}
                            onPress={onAccept}
                        >
                            <Text style={styles.primaryText}>
                                {loading ? "Đang xử lý..." : "Đồng ý"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(2, 6, 23, 0.5)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
    },
    card: {
        width: "100%",
        borderRadius: 18,
        backgroundColor: colors.white,
        padding: 18,
    },
    title: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.text,
    },
    body: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 21,
        color: colors.textMuted,
    },
    error: {
        marginTop: 10,
        color: "#DC2626",
        fontSize: 13,
        fontWeight: "600",
    },
    actions: {
        marginTop: 18,
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
    },
    secondaryBtn: {
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    primaryBtn: {
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
    },
    disabled: {
        opacity: 0.6,
    },
    secondaryText: {
        color: "#374151",
        fontSize: 14,
        fontWeight: "700",
    },
    primaryText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: "800",
    },
});
