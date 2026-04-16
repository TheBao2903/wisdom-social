import React from "react";
import { FlatList, SafeAreaView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, EmptyState, PostCard } from "@/components";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function ProfileSavedPostsScreen() {
  const router = useRouter();
  const {
    posts,
    savedPostIds,
    likedPostIds,
    savePost,
    likePost,
    addComment,
    getUserById,
  } = useAppContext();

  const savedPosts = posts.filter((item) => savedPostIds.includes(item.id));

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Saved Posts" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState title="Bạn chưa lưu bài viết nào" />}
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
});
