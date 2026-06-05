import React, { useEffect, useRef } from "react";
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing } from "@/constants";

type Props = {
    visible: boolean;
    onClose: () => void;
    onCreatePost: () => void;
    onCreateStory: () => void;
};

export default function CreateOptionModal({
    visible,
    onClose,
    onCreatePost,
    onCreateStory,
}: Props) {
    const panY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Only capture gestures if dragging downwards
                return gestureState.dy > 10;
            },
            onPanResponderMove: (evt, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dy > 80 || gestureState.vy > 0.5) {
                    // Animate sheet sliding out of screen down, then trigger onClose
                    Animated.timing(panY, {
                        toValue: 400,
                        duration: 220,
                        useNativeDriver: true,
                    }).start(() => {
                        onClose();
                    });
                } else {
                    // Bounce back to top
                    Animated.spring(panY, {
                        toValue: 0,
                        friction: 6,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                
                <Animated.View 
                    style={[
                        styles.sheet,
                        { transform: [{ translateY: panY }] }
                    ]}
                    {...panResponder.panHandlers}
                >
                    {/* Top indicator handle */}
                    <View style={styles.handle} />

                    <Text style={styles.title}>Tạo nội dung mới</Text>
                    <Text style={styles.subtitle}>
                        Hãy chọn loại nội dung bạn muốn chia sẻ với mọi người
                    </Text>

                    <View style={styles.optionsRow}>
                        {/* Option 1: Create Post */}
                        <TouchableOpacity
                            style={styles.cardBtn}
                            onPress={onCreatePost}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={["#0088FF", "#0052CC"]}
                                style={styles.gradientCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.iconCircle}>
                                    <Ionicons
                                        name="document-text-sharp"
                                        size={28}
                                        color="#0068FF"
                                    />
                                </View>
                                <Text style={styles.cardTitle}>Bài viết mới</Text>
                                <Text style={styles.cardDesc}>
                                    Chia sẻ hình ảnh, video, suy nghĩ lên bảng tin
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Option 2: Create Story */}
                        <TouchableOpacity
                            style={styles.cardBtn}
                            onPress={onCreateStory}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[
                                    colors.storyGradientStart || "#FEDA75",
                                    colors.storyGradientMid || "#D62976",
                                    colors.storyGradientEnd || "#4F5BD5",
                                ]}
                                style={styles.gradientCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.iconCircle}>
                                    <Ionicons
                                        name="images-sharp"
                                        size={28}
                                        color="#D62976"
                                    />
                                </View>
                                <Text style={styles.cardTitle}>Tin mới (Story)</Text>
                                <Text style={styles.cardDesc}>
                                    Tin nhắn ảnh/video tương tác biến mất sau 24h
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Cancel button */}
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>Đóng</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
    },
    sheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: spacing.md,
        paddingTop: 12,
        paddingBottom: spacing.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    handle: {
        width: 38,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: "#E5E7EB",
        alignSelf: "center",
        marginBottom: 18,
    },
    title: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.text,
        textAlign: "center",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: "center",
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    optionsRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: spacing.lg,
    },
    cardBtn: {
        flex: 1,
        height: 170,
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    gradientCard: {
        flex: 1,
        padding: spacing.md,
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: colors.white,
        marginTop: spacing.sm,
    },
    cardDesc: {
        fontSize: 10,
        color: "rgba(255, 255, 255, 0.85)",
        fontWeight: "500",
        lineHeight: 13,
        marginTop: 4,
    },
    cancelBtn: {
        height: 48,
        borderRadius: 24,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
    },
    cancelText: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.textMuted,
    },
});
