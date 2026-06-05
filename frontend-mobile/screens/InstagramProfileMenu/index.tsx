import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
    SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

type ThemeMode = "light" | "dark" | "system";

export default function InstagramProfileMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { logout } = useAppContext();
    const [themeMode, setThemeMode] = useState<ThemeMode>("light");
    const [notificationSettings, setNotificationSettings] = useState({
        pushEnabled: true,
        likesEnabled: true,
        commentsEnabled: true,
        followsEnabled: true,
        messagesEnabled: true,
        pageUpdatesEnabled: true,
    });

    const handleLogout = async () => {
        Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Đăng xuất",
                style: "destructive",
                onPress: async () => {
                    await logout();
                    router.replace("/(auth)/login");
                },
            },
        ]);
    };

    const themeModes: { label: string; value: ThemeMode; icon: string }[] = [
        { label: "Sáng", value: "light", icon: "sunny-outline" },
        { label: "Tối", value: "dark", icon: "moon-outline" },
        { label: "Hệ thống", value: "system", icon: "phone-portrait-outline" },
    ];

    const updateNotificationSetting = (key: keyof typeof notificationSettings, value: boolean) => {
        setNotificationSettings((prev) => ({ ...prev, [key]: value }));
    };

    const ds = createDynamicStyles();

    return (
        <SafeAreaView style={ds.container}>
            <View style={ds.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={ds.headerTitle}>Menu</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={ds.scrollView}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Giao diện */}
                <Text style={ds.sectionTitle}>Giao diện</Text>
                <View style={ds.card}>
                    <View style={ds.settingRow}>
                        <View style={ds.settingInfo}>
                            <View style={[ds.iconWrap, { backgroundColor: colors.surface }]}>
                                <Ionicons name="sunny" size={20} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={ds.settingLabel}>Chế độ hiển thị</Text>
                                <Text style={ds.settingDesc}>
                                    {themeMode === "system"
                                        ? "Theo hệ thống"
                                        : themeMode === "dark"
                                          ? "Chế độ tối"
                                          : "Chế độ sáng"}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={ds.themeModeRow}>
                        {themeModes.map((mode) => {
                            const isActive = themeMode === mode.value;
                            return (
                                <TouchableOpacity
                                    key={mode.value}
                                    style={[ds.themeModeBtn, isActive && ds.themeModeBtnActive]}
                                    onPress={() => setThemeMode(mode.value)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={mode.icon as any}
                                        size={20}
                                        color={isActive ? colors.white : colors.textMuted}
                                    />
                                    <Text
                                        style={[
                                            ds.themeModeBtnText,
                                            isActive && ds.themeModeBtnTextActive,
                                        ]}
                                    >
                                        {mode.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Thông báo */}
                <Text style={ds.sectionTitle}>Thông báo</Text>
                <View style={ds.card}>
                    <NotificationSwitch
                        icon="notifications"
                        label="Thông báo đẩy"
                        description="Bật/tắt tất cả thông báo"
                        value={notificationSettings.pushEnabled}
                        onValueChange={(v) => updateNotificationSetting("pushEnabled", v)}
                    />

                    <View style={ds.divider} />

                    <NotificationSwitch
                        icon="heart"
                        label="Lượt thích"
                        description="Thông báo khi bài viết được thích"
                        value={notificationSettings.likesEnabled}
                        onValueChange={(v) => updateNotificationSetting("likesEnabled", v)}
                        disabled={!notificationSettings.pushEnabled}
                    />

                    <View style={ds.divider} />

                    <NotificationSwitch
                        icon="chatbubble"
                        label="Bình luận"
                        description="Thông báo khi có bình luận mới"
                        value={notificationSettings.commentsEnabled}
                        onValueChange={(v) => updateNotificationSetting("commentsEnabled", v)}
                        disabled={!notificationSettings.pushEnabled}
                    />

                    <View style={ds.divider} />

                    <NotificationSwitch
                        icon="person-add"
                        label="Theo dõi"
                        description="Thông báo khi có người theo dõi mới"
                        value={notificationSettings.followsEnabled}
                        onValueChange={(v) => updateNotificationSetting("followsEnabled", v)}
                        disabled={!notificationSettings.pushEnabled}
                    />

                    <View style={ds.divider} />

                    <NotificationSwitch
                        icon="mail"
                        label="Tin nhắn"
                        description="Thông báo khi có tin nhắn mới"
                        value={notificationSettings.messagesEnabled}
                        onValueChange={(v) => updateNotificationSetting("messagesEnabled", v)}
                        disabled={!notificationSettings.pushEnabled}
                    />

                    <View style={ds.divider} />

                    <NotificationSwitch
                        icon="flag"
                        label="Cập nhật trang"
                        description="Thông báo từ các trang bạn theo dõi"
                        value={notificationSettings.pageUpdatesEnabled}
                        onValueChange={(v) => updateNotificationSetting("pageUpdatesEnabled", v)}
                        disabled={!notificationSettings.pushEnabled}
                    />
                </View>

                {/* Tài khoản */}
                <Text style={ds.sectionTitle}>Tài khoản</Text>
                <View style={ds.card}>
                    <TouchableOpacity
                        style={ds.menuItem}
                        onPress={() => router.push("/(stack)/qr-scanner")}
                        activeOpacity={0.7}
                    >
                        <View style={ds.settingInfo}>
                            <View style={[ds.iconWrap, { backgroundColor: colors.surface }]}>
                                <Ionicons name="qr-code" size={20} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={ds.settingLabel}>Quét mã QR</Text>
                                <Text style={ds.settingDesc}>Đăng nhập trên thiết bị khác</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={ds.divider} />

                    <TouchableOpacity style={ds.menuItem} activeOpacity={0.7}>
                        <View style={ds.settingInfo}>
                            <View style={[ds.iconWrap, { backgroundColor: colors.surface }]}>
                                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={ds.settingLabel}>Quyền riêng tư</Text>
                                <Text style={ds.settingDesc}>Quản lý quyền riêng tư</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={ds.divider} />

                    <TouchableOpacity
                        style={ds.menuItem}
                        onPress={() => router.push("/(stack)/profile/security")}
                        activeOpacity={0.7}
                    >
                        <View style={ds.settingInfo}>
                            <View style={[ds.iconWrap, { backgroundColor: colors.surface }]}>
                                <Ionicons name="lock-closed" size={20} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={ds.settingLabel}>Bảo mật</Text>
                                <Text style={ds.settingDesc}>Sinh trắc học, đăng xuất, xóa tài khoản</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={ds.divider} />

                    <TouchableOpacity style={ds.menuItem} onPress={handleLogout} activeOpacity={0.7}>
                        <View style={ds.settingInfo}>
                            <View style={[ds.iconWrap, { backgroundColor: "#FFE5E5" }]}>
                                <Ionicons name="log-out" size={20} color={colors.danger} />
                            </View>
                            <View>
                                <Text style={[ds.settingLabel, { color: colors.danger }]}>Đăng xuất</Text>
                                <Text style={ds.settingDesc}>Thoát khỏi tài khoản</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                <Text style={ds.versionText}>Wisdom Social v1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function NotificationSwitch({
    icon,
    label,
    description,
    value,
    onValueChange,
    disabled,
}: {
    icon: string;
    label: string;
    description: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    const ds = createDynamicStyles();
    return (
        <View style={[ds.settingRow, disabled && { opacity: 0.5 }]}>
            <View style={ds.settingInfo}>
                <View style={[ds.iconWrap, { backgroundColor: colors.surface }]}>
                    <Ionicons name={icon as any} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={ds.settingLabel}>{label}</Text>
                    <Text style={ds.settingDesc}>{description}</Text>
                </View>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={value ? colors.white : colors.textMuted}
                ios_backgroundColor={colors.border}
            />
        </View>
    );
}

const createDynamicStyles = () =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: "700",
            color: colors.text,
        },
        scrollView: {
            flex: 1,
        },
        sectionTitle: {
            fontSize: 13,
            fontWeight: "600",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginHorizontal: 20,
            marginTop: 24,
            marginBottom: 10,
        },
        card: {
            backgroundColor: colors.background,
            marginHorizontal: 14,
            borderRadius: 16,
            paddingVertical: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
            borderWidth: 1,
            borderColor: colors.border,
        },
        settingRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
        },
        settingInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
        },
        iconWrap: {
            width: 38,
            height: 38,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
        },
        settingLabel: {
            fontSize: 15,
            fontWeight: "600",
            color: colors.text,
        },
        settingDesc: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        divider: {
            height: 1,
            backgroundColor: colors.border,
            marginLeft: 66,
        },
        themeModeRow: {
            flexDirection: "row",
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 16,
        },
        themeModeBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 11,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        themeModeBtnActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primary,
        },
        themeModeBtnText: {
            fontSize: 13,
            fontWeight: "500",
            color: colors.textMuted,
        },
        themeModeBtnTextActive: {
            color: colors.white,
            fontWeight: "600",
        },
        menuItem: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
        },
        versionText: {
            textAlign: "center",
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 30,
        },
    });
