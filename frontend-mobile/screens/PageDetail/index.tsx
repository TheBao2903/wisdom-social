import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppHeader, CustomButton } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import pageService, { PageData } from "@/services/pageService";

export default function PageDetailScreen() {
    const router = useRouter();
    const { pageId } = useLocalSearchParams<{ pageId?: string }>();
    const { currentUser } = useAppContext();

    const [page, setPage] = useState<PageData | null>(null);
    const [liked, setLiked] = useState(false);
    const [following, setFollowing] = useState(false);
    const [likes, setLikes] = useState(0);
    const [follows, setFollows] = useState(0);

    const numericUserId = useMemo(() => {
        const id = Number(currentUser?.id);
        return Number.isFinite(id) ? id : null;
    }, [currentUser?.id]);

    const numericPageId = Number(pageId ?? 0);

    const loadDetail = async () => {
        if (!numericPageId) return;

        const [pageData, interaction] = await Promise.all([
            pageService.findPageById(numericPageId),
            pageService.getPageInteractionStatus(numericPageId),
        ]);

        setPage(pageData);
        setLiked(interaction.isLiked);
        setFollowing(interaction.isFollowing);
        setLikes(interaction.likeCount);
        setFollows(interaction.followCount);
    };

    useEffect(() => {
        void loadDetail();
    }, [numericPageId]);

    const toggleLike = async () => {
        if (!numericUserId || !page) {
            Alert.alert(
                "Thông báo",
                "Chức năng này yêu cầu tài khoản backend.",
            );
            return;
        }

        if (liked) {
            await pageService.cancelLikePage(numericUserId, page.id);
        } else {
            await pageService.likePage(numericUserId, page.id);
        }

        await loadDetail();
    };

    const toggleFollow = async () => {
        if (!numericUserId || !page) {
            Alert.alert(
                "Thông báo",
                "Chức năng này yêu cầu tài khoản backend.",
            );
            return;
        }

        if (following) {
            await pageService.cancelFollowPage(numericUserId, page.id);
        } else {
            await pageService.followPage(numericUserId, page.id);
        }

        await loadDetail();
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Page Detail"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
            />

            <View style={styles.content}>
                <Text style={styles.title}>{page?.name ?? "Unknown Page"}</Text>
                {!!page?.description && (
                    <Text style={styles.description}>{page.description}</Text>
                )}

                <Text style={styles.meta}>Likes: {likes}</Text>
                <Text style={styles.meta}>Follows: {follows}</Text>

                <View style={styles.actionRow}>
                    <CustomButton
                        title={liked ? "Unlike" : "Like"}
                        variant="outline"
                        onPress={toggleLike}
                        style={styles.actionBtn}
                    />
                    <CustomButton
                        title={following ? "Unfollow" : "Follow"}
                        variant="outline"
                        onPress={toggleFollow}
                        style={styles.actionBtn}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    content: {
        padding: spacing.lg,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.text,
    },
    description: {
        marginTop: spacing.sm,
        color: colors.textMuted,
    },
    meta: {
        marginTop: spacing.sm,
        color: colors.text,
        fontWeight: "500",
    },
    actionRow: {
        flexDirection: "row",
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    actionBtn: {
        flex: 1,
    },
});
