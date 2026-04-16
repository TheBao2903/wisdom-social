import React from "react";
import { FlatList, SafeAreaView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, EmptyState, PostCard } from "@/components";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function ProfileMyPostsScreen() {
  const router = useRouter();
  const {
    currentUser,
    posts,
    likedPostIds,
    savedPostIds,
    likePost,
    savePost,
    addComment,
    getUserById,
  } = useAppContext();

  const myPosts = posts.filter((item) => item.userId === currentUser?.id);

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
