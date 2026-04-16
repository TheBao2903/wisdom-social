import React, { useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import pageService, { PageData } from "@/services/pageService";

type PageItem = PageData & {
    interaction?: {
        isLiked: boolean;
        isFollowing: boolean;
        likeCount: number;
        followCount: number;
    };
};

export default function PagesScreen() {
    const router = useRouter();
    const { currentUser } = useAppContext();
    const [tab, setTab] = useState<"discover" | "my">("discover");
    const [loading, setLoading] = useState(false);
    const [allPages, setAllPages] = useState<PageItem[]>([]);
    const [myPages, setMyPages] = useState<PageItem[]>([]);

    const numericUserId = useMemo(() => {
        const id = Number(currentUser?.id);
        return Number.isFinite(id) ? id : null;
    }, [currentUser?.id]);

    const loadPages = async () => {
        setLoading(true);
        const [all, mine] = await Promise.all([
            pageService.getAllPages(),
            pageService.getMyPages(),
        ]);

        const enrich = async (pages: PageData[]): Promise<PageItem[]> => {
            return Promise.all(
                pages.map(async (page) => {
                    const interaction =
                        await pageService.getPageInteractionStatus(page.id);
                    return { ...page, interaction };
                }),
            );
        };

        setAllPages(await enrich(all));
        setMyPages(await enrich(mine));
        setLoading(false);
    };

    useEffect(() => {
        void loadPages();
    }, []);

    const onToggleLike = async (page: PageItem) => {
        const actingUserId = numericUserId ?? 0;

        if (page.interaction?.isLiked) {
            await pageService.cancelLikePage(actingUserId, page.id);
        } else {
            await pageService.likePage(actingUserId, page.id);
        }

        await loadPages();
    };

    const onToggleFollow = async (page: PageItem) => {
        const actingUserId = numericUserId ?? 0;

        if (page.interaction?.isFollowing) {
            await pageService.cancelFollowPage(actingUserId, page.id);
        } else {
            await pageService.followPage(actingUserId, page.id);
        }

        await loadPages();
    };

    const onRequestJoin = async (page: PageItem) => {
        const actingUserId = numericUserId ?? 0;
        await pageService.requestJoinPage(actingUserId, page.id);
        await loadPages();
    };

    const data = tab === "discover" ? allPages : myPages;

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Pages"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
                rightActions={[
                    {
                        icon: "add-circle-outline",
                        onPress: () => router.push("/(stack)/create-page"),
                    },
                ]}
            />

            <View style={styles.tabWrap}>
                <Pressable
                    style={[
                        styles.tabBtn,
                        tab === "discover" && styles.tabBtnActive,
                    ]}
                    onPress={() => setTab("discover")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            tab === "discover" && styles.tabTextActive,
                        ]}
                    >
                        Discover
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tabBtn, tab === "my" && styles.tabBtnActive]}
                    onPress={() => setTab("my")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            tab === "my" && styles.tabTextActive,
                        ]}
                    >
                        My Pages
                    </Text>
                </Pressable>
            </View>

            <FlatList
                data={data}
                refreshing={loading}
                onRefresh={loadPages}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>Chưa có trang nào.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.card}
                        onPress={() =>
                            router.push({
                                pathname: "/(stack)/page-detail",
                                params: { pageId: String(item.id) },
                            })
                        }
                    >
                        <Text style={styles.pageName}>{item.name}</Text>
                        {!!item.description && (
                            <Text style={styles.pageDesc}>
                                {item.description}
                            </Text>
                        )}

                        <View style={styles.statsRow}>
                            <Text style={styles.statsText}>
                                Likes: {item.interaction?.likeCount ?? 0}
                            </Text>
                            <Text style={styles.statsText}>
                                Follows: {item.interaction?.followCount ?? 0}
                            </Text>
                        </View>

                        <View style={styles.actionRow}>
                            <CustomButton
                                title={
                                    item.interaction?.isLiked
                                        ? "Unlike"
                                        : "Like"
                                }
                                variant="outline"
                                onPress={() => onToggleLike(item)}
                                style={styles.actionBtn}
                            />
                            <CustomButton
                                title={
                                    item.interaction?.isFollowing
                                        ? "Unfollow"
                                        : "Follow"
                                }
                                variant="outline"
                                onPress={() => onToggleFollow(item)}
                                style={styles.actionBtn}
                            />
                            <CustomButton
                                title="Join"
                                onPress={() => onRequestJoin(item)}
                                style={styles.actionBtn}
                            />
                        </View>
                    </Pressable>
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
    tabWrap: {
        flexDirection: "row",
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    tabBtn: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabBtnActive: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        color: colors.textMuted,
        fontWeight: "600",
    },
    tabTextActive: {
        color: colors.primary,
    },
    listContent: {
        padding: spacing.md,
    },
    card: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: spacing.md,
        marginBottom: spacing.md,
        backgroundColor: colors.surface,
    },
    pageName: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    pageDesc: {
        marginTop: spacing.xs,
        color: colors.textMuted,
    },
    statsRow: {
        flexDirection: "row",
        marginTop: spacing.sm,
        gap: spacing.md,
    },
    statsText: {
        color: colors.textMuted,
        fontSize: 12,
    },
    actionRow: {
        flexDirection: "row",
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    actionBtn: {
        flex: 1,
    },
    emptyWrap: {
        alignItems: "center",
        marginTop: spacing.xl,
    },
    emptyText: {
        color: colors.textMuted,
    },
});
