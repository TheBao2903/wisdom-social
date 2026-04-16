import React, { useMemo, useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import {
    AppHeader,
    EmptyState,
    PostGrid,
    ProfileHeader,
    ProfileTabSwitcher,
} from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramProfileScreen() {
    const router = useRouter();
    const { currentUser, posts, savedPostIds } = useAppContext();
    const [tab, setTab] = useState<"posts" | "saved">("posts");

    const myPosts = useMemo(
        () => posts.filter((post) => post.userId === currentUser?.id),
        [posts, currentUser?.id],
    );
    const savedPosts = useMemo(
        () => posts.filter((post) => savedPostIds.includes(post.id)),
        [posts, savedPostIds],
    );

    if (!currentUser) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState title="Bạn chưa đăng nhập" />
            </SafeAreaView>
        );
    }

    const gridData = tab === "posts" ? myPosts : savedPosts;

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title={currentUser.username}
                rightActions={[
                    {
                        icon: "settings-outline",
                        onPress: () => router.push("/(stack)/profile/settings"),
                    },
                    {
                        icon: "menu-outline",
                        onPress: () => router.push("/(stack)/profile/menu"),
                    },
                ]}
            />

            <ScrollView>
                <ProfileHeader
                    user={currentUser}
                    stats={{
                        posts: myPosts.length,
                        followers: currentUser.followers,
                        following: currentUser.following,
                    }}
                    onEditProfile={() => router.push("/(stack)/profile/edit")}
                    onOpenMenu={() => router.push("/(stack)/profile/menu")}
                />

                <View style={styles.quickActions}>
                    <Pressable
                        style={styles.quickBtn}
                        onPress={() => router.push("/(stack)/profile/my-posts")}
                    >
                        <Text style={styles.quickBtnText}>My Posts</Text>
                    </Pressable>
                    <Pressable
                        style={styles.quickBtn}
                        onPress={() =>
                            router.push("/(stack)/profile/saved-posts")
                        }
                    >
                        <Text style={styles.quickBtnText}>Saved</Text>
                    </Pressable>
                    <Pressable
                        style={styles.quickBtn}
                        onPress={() =>
                            router.push("/(stack)/profile/following")
                        }
                    >
                        <Text style={styles.quickBtnText}>Following</Text>
                    </Pressable>
                </View>

                <View style={styles.quickActions}>
                    <Pressable
                        style={styles.quickBtn}
                        onPress={() => router.push("/(stack)/friends-list")}
                    >
                        <Text style={styles.quickBtnText}>Friends</Text>
                    </Pressable>
                    <Pressable
                        style={styles.quickBtn}
                        onPress={() => router.push("/(stack)/pages")}
                    >
                        <Text style={styles.quickBtnText}>Pages</Text>
                    </Pressable>
                    <Pressable
                        style={styles.quickBtn}
                        onPress={() => router.push("/(stack)/qr-scanner")}
                    >
                        <Text style={styles.quickBtnText}>QR Login</Text>
                    </Pressable>
                </View>

                <ProfileTabSwitcher value={tab} onChange={setTab} />

                {gridData.length === 0 ? (
                    <EmptyState
                        title="Chưa có nội dung"
                        description="Hãy đăng bài hoặc lưu bài viết."
                    />
                ) : (
                    <PostGrid posts={gridData} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    quickActions: {
        flexDirection: "row",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    quickBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    quickBtnText: {
        color: colors.text,
        fontWeight: "600",
        fontSize: 13,
    },
});
