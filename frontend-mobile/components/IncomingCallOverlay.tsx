import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants";

interface IncomingCallOverlayProps {
    visible: boolean;
    callerName: string;
    callType: "audio" | "video";
    onAccept: () => void;
    onReject: () => void;
}

export default function IncomingCallOverlay({
    visible,
    callerName,
    callType,
    onAccept,
    onReject,
}: IncomingCallOverlayProps) {
    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <Ionicons
                            name={
                                callType === "video"
                                    ? "videocam-outline"
                                    : "call-outline"
                            }
                            size={24}
                            color="#2563EB"
                        />
                    </View>

                    <Text style={styles.title}>Cuoc goi den</Text>
                    <Text style={styles.subtitle} numberOfLines={2}>
                        {callerName} dang goi{" "}
                        {callType === "video" ? "video" : "thoai"}
                    </Text>

                    <View style={styles.actions}>
                        <Pressable
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={onReject}
                        >
                            <Ionicons
                                name="call"
                                size={18}
                                color={colors.white}
                            />
                        </Pressable>
                        <Pressable
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={onAccept}
                        >
                            <Ionicons
                                name={
                                    callType === "video" ? "videocam" : "call"
                                }
                                size={18}
                                color={colors.white}
                            />
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
        backgroundColor: "rgba(2, 6, 23, 0.45)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    card: {
        width: "100%",
        maxWidth: 360,
        borderRadius: 20,
        backgroundColor: colors.white,
        paddingHorizontal: 20,
        paddingVertical: 24,
        alignItems: "center",
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#DBEAFE",
    },
    title: {
        marginTop: 14,
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
    },
    subtitle: {
        marginTop: 8,
        textAlign: "center",
        fontSize: 14,
        lineHeight: 20,
        color: "#4B5563",
    },
    actions: {
        marginTop: 24,
        flexDirection: "row",
        alignItems: "center",
        gap: 20,
    },
    actionBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    rejectBtn: {
        backgroundColor: "#EF4444",
        transform: [{ rotate: "135deg" }],
    },
    acceptBtn: {
        backgroundColor: "#22C55E",
    },
});
