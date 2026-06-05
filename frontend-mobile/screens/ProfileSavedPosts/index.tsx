import React, { useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, EmptyState, PostCard } from "@/components";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { getSavedPostsWithDetails } from "@/services/postService";

export default function ProfileSavedPostsScreen() {
    const router = useRouter();
    const { currentUser, posts, likedPostIds, savedPostIds, likePost, savePost, addComment, removePost, updatePostPrivacyLocal, upsertPosts } = useAppContext();
    const [savedPosts, setSavedPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSavedPosts = async () => {
            if (!currentUser?.id) return;
            setLoading(true);
            try {
                const fetchedPosts = await getSavedPostsWithDetails(currentUser.id);
                setSavedPosts(fetchedPosts);
                upsertPosts(fetchedPosts);
            } catch (err) {
                console.error("Error loading saved posts:", err);
                setSavedPosts([]);
            } finally {
                setLoading(false);
            }
        };
        void loadSavedPosts();
    }, [currentUser?.id, upsertPosts]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <AppHeader title="Saved Posts" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.loadingText}>Đang tải...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const displayedPosts = savedPosts
        .map((savedItem) => posts.find((p) => p.id === savedItem.id) || savedItem)
        .filter((item) => savedPostIds.includes(item.id));

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Saved Posts" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
            <FlatList
                data={displayedPosts}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<EmptyState title="Bạn chưa lưu bài viết nào" />}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        author={item.user}
                        currentUserId={currentUser?.id}
                        liked={likedPostIds.includes(item.id) || item.isLiked}
                        saved={savedPostIds.includes(item.id)}
                        onLike={(reactionType, isToggleOff) => void likePost(item.id, reactionType, isToggleOff)}
                        onSave={() => void savePost(item.id)}
                        onAddComment={(content) => void addComment(item.id, content)}
                        onDeleted={removePost}
                        onPrivacyChanged={updatePostPrivacyLocal}
                        onOpenPost={(postId) => router.push({ pathname: "/(stack)/post/[postId]" as any, params: { postId } })}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { marginTop: 10, color: colors.textMuted },
});
