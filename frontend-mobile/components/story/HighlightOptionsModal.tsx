import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";

interface HighlightOptionsModalProps {
    visible: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    highlightTitle: string;
}

export default function HighlightOptionsModal({
    visible,
    onClose,
    onEdit,
    onDelete,
    highlightTitle
}: HighlightOptionsModalProps) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={s.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={s.sheet}>
                    <View style={s.indicator} />
                    <Text style={s.title}>{highlightTitle}</Text>
                    
                    <TouchableOpacity
                        style={s.option}
                        onPress={() => {
                            onClose();
                            onEdit();
                        }}
                    >
                        <Ionicons name="create-outline" size={20} color="#000" />
                        <Text style={s.optionText}>Chỉnh sửa tin nổi bật</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.option, s.deleteOption]}
                        onPress={() => {
                            onClose();
                            onDelete();
                        }}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                        <Text style={[s.optionText, s.deleteText]}>Xóa tin nổi bật</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.cancelButton} onPress={onClose}>
                        <Text style={s.cancelText}>Hủy</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 20,
        paddingBottom: 30,
        paddingTop: 8,
    },
    indicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#E5E5EA",
        alignSelf: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: "#000",
        textAlign: "center",
        marginBottom: 20,
    },
    option: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#F2F2F7",
        gap: 12,
    },
    deleteOption: {
        borderBottomWidth: 0,
    },
    optionText: {
        fontSize: 15,
        color: "#000",
        fontWeight: "500",
    },
    deleteText: {
        color: colors.danger,
    },
    cancelButton: {
        marginTop: 12,
        height: 44,
        borderRadius: 8,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#000",
    },
});
