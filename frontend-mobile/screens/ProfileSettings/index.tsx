import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Switch,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import userService from "@/services/userService";

type ProfilePrivacy = "PUBLIC" | "FRIENDS" | "ONLY_ME";

const PRIVACY_OPTIONS: { value: ProfilePrivacy; label: string; desc: string; icon: string }[] = [
    { value: "PUBLIC", label: "Công khai", desc: "Tất cả mọi người đều có thể xem hồ sơ", icon: "globe-outline" },
    { value: "FRIENDS", label: "Bạn bè", desc: "Chỉ bạn bè mới có thể xem hồ sơ", icon: "people-outline" },
    { value: "ONLY_ME", label: "Chỉ mình tôi", desc: "Hồ sơ hoàn toàn riêng tư", icon: "lock-closed-outline" },
];

export default function ProfileSettingsScreen() {
    const router = useRouter();
    const { logout, themeMode, setThemeMode, notificationSettings, updateNotificationSetting, currentUser } = useAppContext();

    const [profilePrivacy, setProfilePrivacy] = useState<ProfilePrivacy>("PUBLIC");
    const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
    const [privacyLoading, setPrivacyLoading] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(true);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setLoadingInitial(true);
                try {
                    const profile = await userService.getUserProfile(currentUser?.id ?? "");
                    if (!cancelled && profile?.privacyProfile) {
                        setProfilePrivacy(profile.privacyProfile as ProfilePrivacy);
                    }
                } catch {
                    // default to PUBLIC on error
                } finally {
                    if (!cancelled) setLoadingInitial(false);
                }
            })();
            return () => { cancelled = true; };
        }, [currentUser?.id])
    );

    const handlePrivacyChange = useCallback(async (next: ProfilePrivacy) => {
        if (!currentUser?.id) return;
        setPrivacyLoading(true);
        try {
            await userService.updateUser(currentUser.id, { privacyProfile: next });
            setProfilePrivacy(next);
            setPrivacyModalVisible(false);
        } catch {
            Alert.alert("Lỗi", "Không thể cập nhật chế độ hồ sơ. Vui lòng thử lại.");
        } finally {
            setPrivacyLoading(false);
        }
    }, [currentUser?.id]);

    const currentOption = PRIVACY_OPTIONS.find((o) => o.value === profilePrivacy);

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Cài đặt"
                leftAction={{ icon: "arrow-back", onPress: () => router.back() }}
            />

            <View style={styles.content}>
                {/* Chế độ hồ sơ */}
                <Text style={styles.sectionTitle}>Quyền riêng tư</Text>
                <TouchableOpacity
                    style={styles.rowCard}
                    onPress={() => setPrivacyModalVisible(true)}
                    disabled={loadingInitial}
                >
                    <View style={styles.rowCardLeft}>
                        <View style={styles.iconWrap}>
                            <Ionicons
                                name={(currentOption?.icon ?? "globe-outline") as any}
                                size={20}
                                color={colors.primary}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowCardTitle}>Chế độ hồ sơ</Text>
                            <Text style={styles.rowCardDesc}>
                                {loadingInitial ? "Đang tải..." : currentOption?.label}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Giao diện */}
                <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Giao diện</Text>
                <View style={styles.rowCard}>
                    <View style={styles.rowCardLeft}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="moon-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.rowCardTitle}>Chế độ tối</Text>
                    </View>
                    <Switch
                        value={themeMode === "dark"}
                        onValueChange={(enabled) => setThemeMode(enabled ? "dark" : "light")}
                        trackColor={{ false: colors.border, true: colors.primary }}
                    />
                </View>

                {/* Thông báo */}
                <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Thông báo</Text>
                <View style={styles.rowCard}>
                    <View style={styles.rowCardLeft}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.rowCardTitle}>Thông báo đẩy</Text>
                    </View>
                    <Switch
                        value={notificationSettings.pushEnabled}
                        onValueChange={(v) => updateNotificationSetting("pushEnabled", v)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                    />
                </View>
                <View style={[styles.rowCard, { marginTop: 8 }]}>
                    <View style={styles.rowCardLeft}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="heart-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.rowCardTitle}>Lượt thích</Text>
                    </View>
                    <Switch
                        value={notificationSettings.likesEnabled}
                        onValueChange={(v) => updateNotificationSetting("likesEnabled", v)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        disabled={!notificationSettings.pushEnabled}
                    />
                </View>
                <View style={[styles.rowCard, { marginTop: 8 }]}>
                    <View style={styles.rowCardLeft}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.rowCardTitle}>Tin nhắn</Text>
                    </View>
                    <Switch
                        value={notificationSettings.messagesEnabled}
                        onValueChange={(v) => updateNotificationSetting("messagesEnabled", v)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        disabled={!notificationSettings.pushEnabled}
                    />
                </View>

                {/* Đăng xuất */}
                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => { logout(); router.replace("/(auth)/login"); }}
                >
                    <Text style={styles.logoutText}>Đăng xuất</Text>
                </TouchableOpacity>
            </View>

            {/* Modal chọn chế độ hồ sơ */}
            <Modal
                visible={privacyModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setPrivacyModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setPrivacyModalVisible(false)}>
                    <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Chế độ hồ sơ</Text>
                        <Text style={styles.modalSubtitle}>Chọn ai có thể xem thông tin hồ sơ của bạn</Text>

                        {PRIVACY_OPTIONS.map((opt) => {
                            const selected = profilePrivacy === opt.value;
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                                    onPress={() => handlePrivacyChange(opt.value)}
                                    disabled={privacyLoading}
                                >
                                    <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                                        <Ionicons
                                            name={opt.icon as any}
                                            size={20}
                                            color={selected ? colors.primary : colors.textMuted}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                                            {opt.label}
                                        </Text>
                                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                                    </View>
                                    {selected ? (
                                        <View style={styles.radioFilled}>
                                            <View style={styles.radioDot} />
                                        </View>
                                    ) : (
                                        <View style={styles.radioEmpty} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        {privacyLoading && (
                            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
                        )}

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setPrivacyModalVisible(false)}
                            disabled={privacyLoading}
                        >
                            <Text style={styles.cancelText}>Đóng</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    content: { padding: spacing.lg },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.textMuted,
        marginBottom: spacing.sm,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    rowCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
    },
    rowCardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
    rowCardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
    rowCardDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#EEF2FF",
        alignItems: "center",
        justifyContent: "center",
    },
    logoutBtn: {
        marginTop: spacing.xl,
        borderRadius: 12,
        backgroundColor: "#FEE2E2",
        paddingVertical: 14,
        alignItems: "center",
    },
    logoutText: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    modalSheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: "center",
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 8,
    },
    optionRowSelected: {
        borderColor: colors.primary,
        backgroundColor: "#EEF2FF",
    },
    optionIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    optionIconSelected: { backgroundColor: "#DBEAFE" },
    optionLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
    optionLabelSelected: { color: colors.primary },
    optionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    radioEmpty: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
    },
    radioFilled: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
    cancelBtn: {
        marginTop: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 13,
        alignItems: "center",
    },
    cancelText: { fontSize: 15, fontWeight: "600", color: colors.text },
});
