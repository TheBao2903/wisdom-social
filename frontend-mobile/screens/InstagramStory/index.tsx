import { AppHeader, EmptyState, UserAvatar } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ImageBackground,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function InstagramStoryScreen() {
    const { storyId } = useLocalSearchParams<{ storyId: string }>();
    const router = useRouter();
    const { stories, getUserById } = useAppContext();

    const story = stories.find((item) => item.id === storyId);
    const user = story ? getUserById(story.userId) : undefined;

    if (!story || !user) {
        return (
            <SafeAreaView style={styles.container}>
                <AppHeader
                    title="Story"
                    leftAction={{
                        icon: "arrow-back",
                        onPress: () => router.back(),
                    }}
                />
                <EmptyState title="Story không tồn tại" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Story"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
            />
            <ImageBackground
                source={{ uri: story.image }}
                style={styles.cover}
                resizeMode="cover"
            >
                <View style={styles.overlay}>
                    <View style={styles.userRow}>
                        <UserAvatar
                            uri={user.avatar}
                            name={user.username}
                            size={42}
                        />
                        <Text style={styles.username}>{user.username}</Text>
                    </View>
                    <Text style={styles.hint}>
                        Tap để qua story tiếp theo (UI demo)
                    </Text>
                </View>
            </ImageBackground>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.black },
    cover: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.25)",
        padding: spacing.lg,
        justifyContent: "space-between",
    },
    userRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    username: {
        color: colors.white,
        fontWeight: "700",
        fontSize: 16,
    },
    hint: {
        color: colors.white,
        textAlign: "center",
        marginBottom: spacing.xxl,
    },
});
