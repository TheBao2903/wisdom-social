import { AppHeader, PostCard, StoryBubble } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "expo-router";
import { FlatList, SafeAreaView, StyleSheet } from "react-native";

export default function FeedScreen() {
    const router = useRouter();
    const {
        posts,
        stories,
        likedPostIds,
        savedPostIds,
        likePost,
        savePost,
        addComment,
        getUserById,
    } = useAppContext();

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Instagram"
                leftAction={{
                    icon: "flag-outline",
                    onPress: () => router.push("/(stack)/pages"),
                }}
                rightActions={[
                    {
                        icon: "scan-outline",
                        onPress: () => router.push("/(stack)/qr-scanner"),
                    },
                    {
                        icon: "notifications-outline",
                        onPress: () => router.push("/(stack)/notifications"),
                    },
                    {
                        icon: "heart-outline",
                        onPress: () => router.push("/(stack)/likes"),
                    },
                ]}
            />

            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={stories}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.storyList}
                        renderItem={({ item }) => {
                            const user = getUserById(item.userId);
                            if (!user) return null;
                            return (
                                <StoryBubble
                                    name={user.username}
                                    avatar={user.avatar}
                                    viewed={item.viewed}
                                    onPress={() =>
                                        router.push({
                                            pathname:
                                                "/(stack)/story/[storyId]",
                                            params: { storyId: item.id },
                                        })
                                    }
                                />
                            );
                        }}
                    />
                }
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        author={getUserById(item.userId)}
                        liked={likedPostIds.includes(item.id)}
                        saved={savedPostIds.includes(item.id)}
                        onLike={() => likePost(item.id)}
                        onSave={() => savePost(item.id)}
                        onAddComment={(content) => addComment(item.id, content)}
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
    storyList: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
});
