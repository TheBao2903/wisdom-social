import { Story, StoryGroup, User } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography } from "@/constants";
import StoryBubble from "./StoryBubble";
import StoryViewer from "./StoryViewer";
import { fetchStoryFeed, groupStoriesByUser } from "@/services/storyService";
import { buildS3Url } from "@/utils/s3";
import UserAvatar from "./UserAvatar";

type Props = {
  currentUser: User | null;
  onUsersLoaded?: (users: User[]) => void;
  refreshing?: boolean;
};

export default function StoriesBar({
  currentUser,
  onUsersLoaded,
  refreshing,
}: Props) {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [snapshotGroups, setSnapshotGroups] = useState<StoryGroup[] | null>(
    null
  );
  const [snapshotInitialIdx, setSnapshotInitialIdx] = useState(0);

  const loadStories = async () => {
    setLoading(true);
    try {
      const feed = await fetchStoryFeed(0, 20);
      setStories(feed);
      const users = feed.map((story) => story.user).filter(Boolean) as User[];
      if (users.length) onUsersLoaded?.(users);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStories();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStories();
    }, [])
  );

  useEffect(() => {
    if (refreshing) {
      void loadStories();
    }
  }, [refreshing]);

  const groups = useMemo(
    () => groupStoriesByUser(stories, currentUser),
    [stories, currentUser]
  );
  const myGroup = currentUser
    ? groups.find((group) => String(group.userId) === String(currentUser.id))
    : undefined;
  const hasMyStories = Boolean(myGroup?.stories.length);

  const openViewer = (index: number) => {
    setSnapshotGroups(groups);
    setSnapshotInitialIdx(index);
    setActiveGroupIdx(index);
  };

  const handleViewed = (storyId: string) => {
    setStories((prev) =>
      prev.map((story) =>
        story.id === storyId
          ? { ...story, isViewed: true, viewed: true }
          : story
      )
    );
    // Also update snapshotGroups to keep them in sync for when viewer reopens
    setSnapshotGroups((prev) => {
      if (!prev) return prev;
      return prev.map((group) => ({
        ...group,
        stories: group.stories.map((story) =>
          story.id === storyId
            ? { ...story, isViewed: true, viewed: true }
            : story
        ),
      }));
    });
  };

  const handleDeleted = (storyId: string) => {
    setStories((prev) => prev.filter((story) => story.id !== storyId));
    setSnapshotGroups((prev) => {
      if (!prev) return prev;
      return prev
        .map((group) => ({
          ...group,
          stories: group.stories.filter((story) => story.id !== storyId),
        }))
        .filter((group) => group.stories.length > 0);
    });
  };

  const renderMyStory = () => {
    if (!currentUser) return null;
    const avatar =
      buildS3Url(currentUser.avatarUrl || currentUser.avatar) ||
      currentUser.avatarUrl ||
      currentUser.avatar ||
      "";
    const myIndex = groups.findIndex(
      (group) => String(group.userId) === String(currentUser.id)
    );

    return (
      <View style={styles.myStoryWrap}>
        {hasMyStories && myIndex >= 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openViewer(myIndex)}
            style={styles.myStoryButton}
          >
            <LinearGradient
              colors={["#34D399", "#10B981"]}
              style={styles.createRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.ringInner}>
                <UserAvatar
                  uri={avatar}
                  name={currentUser.username}
                  size={58}
                />
              </View>
            </LinearGradient>
            <TouchableOpacity
              style={styles.plusButton}
              onPress={() => router.push("/(stack)/create-story" as never)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={14} color={colors.white} />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/(stack)/create-story" as never)}
            style={styles.myStoryButton}
          >
            <View style={styles.emptyRing}>
              <UserAvatar uri={avatar} name={currentUser.username} size={58} />
            </View>
            <View style={styles.plusButton}>
              <Ionicons name="add" size={14} color={colors.white} />
            </View>
          </TouchableOpacity>
        )}
        <Text numberOfLines={1} style={styles.name}>
          Tin của bạn
        </Text>
      </View>
    );
  };

  const storyGroupsForList = groups.filter(
    (group) => !currentUser || String(group.userId) !== String(currentUser.id)
  );

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={storyGroupsForList}
        keyExtractor={(item) => item.userId}
        ListHeaderComponent={renderMyStory}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null
        }
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const groupIndex = groups.findIndex(
            (group) => group.userId === item.userId
          );
          const viewed =
            item.stories.length > 0 &&
            item.stories.every((story) => story.isViewed || story.viewed);
          return (
            <StoryBubble
              name={item.username}
              avatar={item.userAvatar}
              viewed={viewed}
              onPress={() => openViewer(groupIndex)}
            />
          );
        }}
      />

      {snapshotGroups && activeGroupIdx !== null ? (
        <StoryViewer
          visible
          groups={snapshotGroups}
          initialGroupIdx={snapshotInitialIdx}
          initialStoryIdx={0}
          currentUser={currentUser}
          onClose={() => {
            setActiveGroupIdx(null);
            setSnapshotGroups(null);
          }}
          onStoryViewed={handleViewed}
          onStoryDeleted={handleDeleted}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 6,
    borderBottomColor: colors.border,
  },
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  loader: { marginHorizontal: spacing.md, alignSelf: "center" },
  myStoryWrap: { width: 82, alignItems: "center", marginRight: spacing.sm },
  myStoryButton: { position: "relative" },
  createRing: { borderRadius: 999, padding: 2 },
  emptyRing: { padding: 4, borderRadius: 999, backgroundColor: colors.white },
  ringInner: { padding: 2, borderRadius: 999, backgroundColor: colors.white },
  plusButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  name: {
    marginTop: spacing.xs,
    ...typography.caption,
    color: colors.text,
    maxWidth: 76,
    textAlign: "center",
  },
});
