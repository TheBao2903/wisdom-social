import React from "react";
import { FlatList, SafeAreaView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, EmptyState, PostCard } from "@/components";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function ProfileMyPostsScreen() {
    const router = useRouter();
    const { currentUser, posts, likedPostIds, savedPostIds, likePost, savePost, addComment, getUserById, removePost, updatePostPrivacyLocal } = useAppContext();
    const myPosts = posts.filter((item) => item.userId === currentUser?.id || item.user?.id === currentUser?.id);

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="My Posts" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
            <FlatList
                data={myPosts}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<EmptyState title="Bạn chưa đăng bài nào" />}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        author={item.user || getUserById(item.userId)}
                        currentUserId={currentUser?.id}
                        liked={likedPostIds.includes(item.id) || item.isLiked}
                        saved={savedPostIds.includes(item.id) || item.isSaved}
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
});
