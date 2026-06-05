import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppHeader, EmptyState, PostCard, CommentsSection } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { fetchPostWithAuthor } from "@/services/postService";
import { Post } from "@/types";

export default function PostDetailScreen() {
    const router = useRouter();
    const { postId } = useLocalSearchParams<{ postId: string }>();
    const {
        posts,
        currentUser,
        likedPostIds,
        savedPostIds,
        likePost,
        savePost,
        getUserById,
        removePost,
        updatePostPrivacyLocal,
        upsertPosts,
    } = useAppContext();
    const [remotePost, setRemotePost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Force re-render when likedPostIds changes
    const [, setTick] = useState(0);

    const localPost = posts.find((item) => item.id === postId);
    const post = localPost || remotePost;

    // Re-render when likedPostIds or savedPostIds change so PostCard gets updated liked/saved props
    useEffect(() => {
        setTick(t => t + 1);
    }, [(likedPostIds || []).join(','), (savedPostIds || []).join(',')]);

    useEffect(() => {
        let mounted = true;
        const loadPost = async () => {
            if (!postId || localPost) return;
            setLoading(true);
            setError(null);
            try {
                const fetched = await fetchPostWithAuthor(postId);
                if (mounted) {
                    setRemotePost(fetched);
                    upsertPosts([fetched]);
                }
            } catch (err: any) {
                if (mounted) setError(err?.response?.data?.message || "Không thể tải bài viết");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        void loadPost();
        return () => {
            mounted = false;
        };
    }, [localPost, postId, upsertPosts]);

    const postHeader = post ? (
        <PostCard
            key={`${post.id}-${likedPostIds.includes(post.id)}-${savedPostIds.includes(post.id)}`}
            post={post}
            author={post.user || getUserById(post.userId)}
            currentUserId={currentUser?.id}
            liked={likedPostIds.includes(post.id) || post.isLiked}
            saved={savedPostIds.includes(post.id) || post.isSaved}
            onLike={(reactionType, isToggleOff) => void likePost(post.id, reactionType, isToggleOff)}
            onSave={() => void savePost(post.id)}
            hideCommentInput={true}
            onDeleted={(id) => {
                removePost(id);
                router.back();
            }}
            onPrivacyChanged={updatePostPrivacyLocal}
        />
    ) : undefined;

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Bài viết" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.mutedText}>Đang tải bài viết...</Text>
                </View>
            ) : error || !post ? (
                <EmptyState title={error || "Không tìm thấy bài viết"} />
            ) : (
                <CommentsSection
                    postId={post.id}
                    postAuthorId={post.userId}
                    HeaderComponent={postHeader}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    mutedText: { marginTop: spacing.sm, color: colors.textMuted },
});
