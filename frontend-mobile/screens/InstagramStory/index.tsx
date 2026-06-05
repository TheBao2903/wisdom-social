import { AppHeader, EmptyState, StoryViewer } from "@/components";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { fetchStoryFeed, groupStoriesByUser } from "@/services/storyService";
import { Story, StoryGroup } from "@/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";

export default function InstagramStoryScreen() {
    const { storyId } = useLocalSearchParams<{ storyId: string }>();
    const router = useRouter();
    const { currentUser, upsertUsers } = useAppContext();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const feed = await fetchStoryFeed(0, 50);
                setStories(feed);
                const users = feed.map((story) => story.user).filter(Boolean) as any[];
                if (users.length) upsertUsers(users);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [upsertUsers]);

    const groups = useMemo<StoryGroup[]>(() => groupStoriesByUser(stories, currentUser), [stories, currentUser]);
    const indices = useMemo(() => {
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
            const storyIndex = groups[groupIndex].stories.findIndex((item) => item.id === storyId);
            if (storyIndex >= 0) return { groupIndex, storyIndex };
        }
        return { groupIndex: 0, storyIndex: 0 };
    }, [groups, storyId]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={colors.primary} style={styles.loader} />
            </SafeAreaView>
        );
    }

    if (!groups.length) {
        return (
            <SafeAreaView style={styles.containerLight}>
                <AppHeader title="Story" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
                <EmptyState title="Story không tồn tại" />
            </SafeAreaView>
        );
    }

    return (
        <StoryViewer
            visible
            groups={groups}
            initialGroupIdx={indices.groupIndex}
            initialStoryIdx={indices.storyIndex}
            currentUser={currentUser}
            onClose={() => router.back()}
            onStoryViewed={(id) => setStories((prev) => prev.map((story) => story.id === id ? { ...story, viewed: true, isViewed: true } : story))}
            onStoryDeleted={(id) => setStories((prev) => prev.filter((story) => story.id !== id))}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.black, justifyContent: "center" },
    containerLight: { flex: 1, backgroundColor: colors.white },
    loader: { alignSelf: "center" },
});
