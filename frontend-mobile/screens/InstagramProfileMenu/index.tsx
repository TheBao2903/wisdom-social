import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramProfileMenuScreen() {
    const router = useRouter();
    const { logout } = useAppContext();

    const menu = [
        { label: "My Posts", route: "/(stack)/profile/my-posts" },
        { label: "Saved Posts", route: "/(stack)/profile/saved-posts" },
        { label: "Settings", route: "/(stack)/profile/settings" },
        { label: "Following", route: "/(stack)/profile/following" },
        { label: "Friends", route: "/(stack)/friends-list" },
        { label: "Pages", route: "/(stack)/pages" },
        { label: "QR Login", route: "/(stack)/qr-scanner" },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Menu"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
            />
            <View>
                {menu.map((item) => (
                    <Pressable
                        key={item.label}
                        style={styles.row}
                        onPress={() => router.push(item.route as never)}
                    >
                        <Text style={styles.rowText}>{item.label}</Text>
                    </Pressable>
                ))}

                <Pressable
                    style={styles.row}
                    onPress={() => {
                        logout();
                        router.replace("/(auth)/login");
                    }}
                >
                    <Text style={[styles.rowText, styles.logout]}>Logout</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    row: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    rowText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "500",
    },
    logout: {
        color: colors.danger,
    },
});
