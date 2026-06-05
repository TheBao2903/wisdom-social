import { Ionicons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { colors } from "@/constants";

interface AIChatSheetProps {
    open: boolean;
    disabled?: boolean;
    summary: string | null;
    suggestions: string[];
    error: string | null;
    isSummarizing: boolean;
    isSuggesting: boolean;
    onClose: () => void;
    onSummarize: () => void;
    onSuggest: () => void;
    onSuggestionClick: (suggestion: string) => void;
}

export default function AIChatSheet({
    open,
    disabled = false,
    summary,
    suggestions,
    error,
    isSummarizing,
    isSuggesting,
    onClose,
    onSummarize,
    onSuggest,
    onSuggestionClick,
}: AIChatSheetProps) {
    const isEmpty = !summary && suggestions.length === 0 && !error;

    return (
        <Modal
            transparent
            animationType="slide"
            visible={open}
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => undefined}>
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <View style={styles.aiBadge}>
                                <Ionicons name="sparkles" size={15} color="#1D4ED8" />
                            </View>
                            <View style={styles.titleWrap}>
                                <Text style={styles.title}>AI CHAT</Text>
                                <Text style={styles.subtitle}>
                                    Tóm tắt nhanh hoặc gợi ý phản hồi
                                </Text>
                            </View>
                        </View>
                        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={20} color="#475569" />
                        </Pressable>
                    </View>

                    <View style={styles.actionRow}>
                        <Pressable
                            style={[styles.actionBtn, disabled && styles.disabled]}
                            disabled={disabled || isSummarizing}
                            onPress={onSummarize}
                        >
                            {isSummarizing ? (
                                <ActivityIndicator size="small" color="#1D4ED8" />
                            ) : (
                                <Ionicons name="sparkles-outline" size={16} color="#1D4ED8" />
                            )}
                            <Text style={styles.actionText}>
                                {isSummarizing ? "Đang tóm tắt..." : "Tóm tắt"}
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.actionBtn, styles.primaryAction, disabled && styles.disabled]}
                            disabled={disabled || isSuggesting}
                            onPress={onSuggest}
                        >
                            {isSuggesting ? (
                                <ActivityIndicator size="small" color="#1D4ED8" />
                            ) : (
                                <Ionicons name="color-wand-outline" size={16} color="#1D4ED8" />
                            )}
                            <Text style={styles.actionText}>
                                {isSuggesting ? "Đang gợi ý..." : "Gợi ý trả lời"}
                            </Text>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.resultWrap} contentContainerStyle={styles.resultContent}>
                        <Text style={styles.resultLabel}>Kết quả AI</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        {isEmpty ? (
                            <Text style={styles.emptyText}>
                                Dùng AI để tóm tắt cuộc trò chuyện hoặc nhận gợi ý phản hồi nhanh.
                            </Text>
                        ) : null}
                        {(isSummarizing || summary) ? (
                            <View style={styles.resultBox}>
                                <Text style={styles.boxTitle}>Tóm tắt cuộc trò chuyện</Text>
                                <Text style={styles.boxText}>
                                    {isSummarizing ? "Đang tạo tóm tắt..." : summary}
                                </Text>
                            </View>
                        ) : null}
                        {(isSuggesting || suggestions.length > 0) ? (
                            <View style={styles.suggestionWrap}>
                                <Text style={styles.boxTitle}>Gợi ý trả lời</Text>
                                {isSuggesting ? (
                                    <Text style={styles.boxText}>Đang tạo gợi ý...</Text>
                                ) : (
                                    <View style={styles.suggestionList}>
                                        {suggestions.map((suggestion) => (
                                            <Pressable
                                                key={suggestion}
                                                style={styles.suggestionChip}
                                                onPress={() => onSuggestionClick(suggestion)}
                                            >
                                                <Text style={styles.suggestionText}>
                                                    {suggestion}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : null}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(2, 6, 23, 0.35)",
    },
    sheet: {
        maxHeight: "78%",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        backgroundColor: colors.white,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 18,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        minWidth: 0,
    },
    aiBadge: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#DBEAFE",
    },
    titleWrap: {
        flex: 1,
        minWidth: 0,
        marginLeft: 10,
    },
    title: {
        fontSize: 14,
        fontWeight: "800",
        color: colors.text,
    },
    subtitle: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F1F5F9",
    },
    actionRow: {
        marginTop: 14,
        flexDirection: "row",
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        minHeight: 40,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        backgroundColor: "#F8FAFC",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#CBD5E1",
    },
    primaryAction: {
        backgroundColor: "#EFF6FF",
        borderColor: "#BFDBFE",
    },
    disabled: {
        opacity: 0.6,
    },
    actionText: {
        color: "#1D4ED8",
        fontSize: 12,
        fontWeight: "800",
    },
    resultWrap: {
        marginTop: 14,
    },
    resultContent: {
        paddingBottom: 8,
    },
    resultLabel: {
        fontSize: 11,
        fontWeight: "800",
        color: "#64748B",
        textTransform: "uppercase",
    },
    emptyText: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 20,
        color: colors.textMuted,
    },
    errorText: {
        marginTop: 8,
        borderRadius: 10,
        padding: 10,
        backgroundColor: "#FEF2F2",
        color: "#DC2626",
        fontSize: 13,
        fontWeight: "600",
    },
    resultBox: {
        marginTop: 10,
        borderRadius: 12,
        padding: 11,
        backgroundColor: "#F8FAFC",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#E2E8F0",
    },
    boxTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: "#334155",
    },
    boxText: {
        marginTop: 5,
        fontSize: 13,
        lineHeight: 20,
        color: colors.text,
    },
    suggestionWrap: {
        marginTop: 10,
    },
    suggestionList: {
        marginTop: 8,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    suggestionChip: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: "#EFF6FF",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#BFDBFE",
    },
    suggestionText: {
        color: "#1D4ED8",
        fontSize: 12,
        fontWeight: "700",
    },
});
