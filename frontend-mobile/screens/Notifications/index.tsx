import { AppHeader, NotificationItem } from "@/components";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { FlatList, SafeAreaView, StyleSheet } from "react-native";

export default function NotificationsScreen() {
    const router = useRouter();
    const segments = useSegments();
    const { notifications, getUserById, markNotificationsRead } =
        useAppContext();

    useEffect(() => {
        markNotificationsRead();
        // Mark all as read once when screen is opened.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Activity"
                leftAction={
                    segments[0] === "(stack)"
                        ? { icon: "arrow-back", onPress: () => router.back() }
                        : undefined
                }
            />
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <NotificationItem
                        notification={item}
                        user={getUserById(item.userId)}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
});
