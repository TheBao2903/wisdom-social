import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Image, StyleSheet, View } from "react-native";

export default function TabsLayout() {
    const { currentUser, loggedIn } = useAppContext();

    if (!loggedIn) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: false,
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarStyle: {
                    borderTopColor: colors.border,
                    backgroundColor: colors.white,
                    height: 62,
                },
                tabBarIcon: ({ color, size, focused }) => {
                    if (route.name === "profile" && currentUser?.avatar) {
                        return (
                            <View
                                style={[
                                    styles.profileAvatarRing,
                                    focused && styles.profileAvatarRingActive,
                                ]}
                            >
                                <Image
                                    source={{ uri: currentUser.avatar }}
                                    style={styles.profileAvatar}
                                />
                            </View>
                        );
                    }

                    let icon: keyof typeof Ionicons.glyphMap = "ellipse";

                    if (route.name === "index")
                        icon = focused ? "home" : "home-outline";
                    if (route.name === "search")
                        icon = focused ? "search" : "search-outline";
                    if (route.name === "add") icon = "add-circle-outline";
                    if (route.name === "activity")
                        icon = focused
                            ? "chatbubble-ellipses"
                            : "chatbubble-ellipses-outline";
                    if (route.name === "profile")
                        icon = focused ? "person" : "person-outline";

                    return (
                        <Ionicons name={icon} color={color} size={size + 2} />
                    );
                },
            })}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="search" />
            <Tabs.Screen name="add" />
            <Tabs.Screen name="activity" />
            <Tabs.Screen name="profile" />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    profileAvatarRing: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "transparent",
    },
    profileAvatarRingActive: {
        borderColor: colors.text,
    },
    profileAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
    },
});
