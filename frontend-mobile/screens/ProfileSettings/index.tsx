import React from "react";
import { SafeAreaView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function ProfileSettingsScreen() {
    const router = useRouter();
    const {
        logout,
        themeMode,
        setThemeMode,
        notificationSettings,
        updateNotificationSetting,
    } = useAppContext();

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Settings"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
            />
            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Theme</Text>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Light</Text>
                    <Switch
                        value={themeMode === "dark"}
                        onValueChange={(enabled) =>
                            setThemeMode(enabled ? "dark" : "light")
                        }
                        trackColor={{
                            false: colors.border,
                            true: colors.primary,
                        }}
                    />
                    <Text style={styles.rowLabel}>Dark</Text>
                </View>

                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.rowBetween}>
                    <Text style={styles.rowLabel}>Push Notifications</Text>
                    <Switch
                        value={notificationSettings.pushEnabled}
                        onValueChange={(value) =>
                            updateNotificationSetting("pushEnabled", value)
                        }
                        trackColor={{
                            false: colors.border,
                            true: colors.primary,
                        }}
                    />
                </View>

                <View style={styles.rowBetween}>
                    <Text style={styles.rowLabel}>Likes</Text>
                    <Switch
                        value={notificationSettings.likesEnabled}
                        onValueChange={(value) =>
                            updateNotificationSetting("likesEnabled", value)
                        }
                        trackColor={{
                            false: colors.border,
                            true: colors.primary,
                        }}
                        disabled={!notificationSettings.pushEnabled}
                    />
                </View>

                <View style={styles.rowBetween}>
                    <Text style={styles.rowLabel}>Messages</Text>
                    <Switch
                        value={notificationSettings.messagesEnabled}
                        onValueChange={(value) =>
                            updateNotificationSetting("messagesEnabled", value)
                        }
                        trackColor={{
                            false: colors.border,
                            true: colors.primary,
                        }}
                        disabled={!notificationSettings.pushEnabled}
                    />
                </View>

                <CustomButton
                    title="Pages"
                    variant="outline"
                    onPress={() => router.push("/(stack)/pages")}
                    style={styles.gap}
                />
                <CustomButton
                    title="QR Login"
                    variant="outline"
                    onPress={() => router.push("/(stack)/qr-scanner")}
                    style={styles.gap}
                />
                <CustomButton
                    title="Logout"
                    onPress={() => {
                        logout();
                        router.replace("/(auth)/login");
                    }}
                    style={styles.gap}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    content: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
    },
    rowBetween: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    rowLabel: {
        color: colors.text,
        fontWeight: "500",
    },
    gap: {
        marginTop: spacing.md,
    },
});
