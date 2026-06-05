import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppContext } from "@/context/AppContext";
import { colors } from "@/constants";
import userService from "@/services/userService";
import friendService from "@/services/friendService";
import blockService from "@/services/blockService";
import chatService from "@/services/chatService";
import { useFriendNotifications } from "@/hooks/useFriendNotifications";
import { useBlockNotifications } from "@/hooks/useBlockNotifications";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import type { User } from "@/services/userService";
import { buildS3Url } from "@/utils/s3";
import {
  getUserHighlights,
  deleteHighlight,
} from "@/services/highlightService";
import type { StoryHighlight, StoryGroup, PrivacyType } from "@/types";
import { StoryViewer, PostGrid, NoteModal } from "@/components";
import HighlightModal from "@/components/story/HighlightModal";
import HighlightOptionsModal from "@/components/story/HighlightOptionsModal";
import { LinearGradient } from "expo-linear-gradient";
import * as postApi from "@/services/postService";
import { useProfileNote } from "@/hooks/useProfileNote";

const { width: SW } = Dimensions.get("window");
const GRID_GAP = 1.5;
const GRID_SIZE = (SW - GRID_GAP * 2) / 3;

const GENDER_LABEL: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  HIDDEN: "Ẩn",
};

const TEXT_GRADIENTS: readonly [string, string][] = [
  ["#7C3AED", "#EF4444"],
  ["#2563EB", "#14B8A6"],
  ["#F97316", "#FACC15"],
  ["#059669", "#84CC16"],
  ["#4F46E5", "#EC4899"],
];

const getGradientIndex = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % TEXT_GRADIENTS.length;
};

type FriendStatus =
  | "NONE"
  | "SENT"
  | "RECEIVED"
  | "FRIEND"
  | "BLOCKED"
  | "BLOCKED_BY";
type ProfileTab = "posts" | "tagged" | "saved" | "shared" | "blocked";

const OWN_TABS: {
  key: ProfileTab;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "posts", icon: "grid", iconOutline: "grid-outline" },
  { key: "tagged", icon: "at", iconOutline: "at" },
  { key: "saved", icon: "bookmark", iconOutline: "bookmark-outline" },
  { key: "shared", icon: "paper-plane", iconOutline: "paper-plane-outline" },
  { key: "blocked", icon: "shield", iconOutline: "shield-outline" },
];

const OTHER_TABS: {
  key: ProfileTab;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "posts", icon: "grid", iconOutline: "grid-outline" },
  { key: "tagged", icon: "at", iconOutline: "at" },
  { key: "shared", icon: "paper-plane", iconOutline: "paper-plane-outline" },
];

export default function InstagramProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId: paramUserId, username: paramUsername } =
    useLocalSearchParams<{ userId?: string; username?: string }>();
  const { currentUser, logout } = useAppContext();

  const isViewingOther = useMemo(
    () => !!paramUserId && String(paramUserId) !== String(currentUser?.id),
    [paramUserId, currentUser?.id]
  );
  const myId = useMemo(() => Number(currentUser?.id), [currentUser?.id]);
  const targetId = useMemo(() => Number(paramUserId), [paramUserId]);
  const profilePresenceUserId = isViewingOther ? targetId : myId;
  const presenceByUserId = usePresenceStatus([profilePresenceUserId]);
  const isProfileOnline = Boolean(
    Number.isFinite(profilePresenceUserId) &&
      profilePresenceUserId > 0 &&
      presenceByUserId[profilePresenceUserId]?.online
  );

  // ── Other-user state ──────────────────────────────────────────────────────
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("NONE");
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [otherFriendsCount, setOtherFriendsCount] = useState<number | null>(
    null
  );
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  const isPrivateProfile = isViewingOther && profileUser?.isPrivate === true;

  const [infoModalVisible, setInfoModalVisible] = useState(false);

  // ── Own-profile / Tab state ─────────────────────────────────────────────────────
  const [selectedTab, setSelectedTab] = useState<ProfileTab>("posts");
  const [tabPosts, setTabPosts] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [friendsCount, setFriendsCount] = useState(0);
  const [profilePostsCount, setProfilePostsCount] = useState<number | null>(
    null
  );
  const refreshTrigger = useFriendNotifications();
  const profileFriendTrigger = useFriendNotifications(
    undefined,
    isViewingOther ? profileUser?.phone : null
  );
  const blockTrigger = useBlockNotifications();

  // ── Highlight state ────────────────────────────────────────────────────────
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightModalVisible, setHighlightModalVisible] = useState(false);
  const [selectedHighlight, setSelectedHighlight] =
    useState<StoryHighlight | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [longPressedHighlight, setLongPressedHighlight] =
    useState<StoryHighlight | null>(null);

  // StoryViewer state for Highlights
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [viewerGroups, setViewerGroups] = useState<StoryGroup[]>([]);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);

  const noteUserId = useMemo(() => {
    return isViewingOther ? String(targetId) : String(currentUser?.id);
  }, [isViewingOther, targetId, currentUser?.id]);

  const { note, showNoteModal, openNoteModal, closeNoteModal, setNote } =
    useProfileNote(noteUserId);

  const displayPosts = useMemo(() => {
    return tabPosts;
  }, [tabPosts]);

  // ── Load other-user data ──────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!paramUserId) return;
    setProfileLoading(true);
    try {
      setProfileUser(await userService.getUserProfile(paramUserId));
    } finally {
      setProfileLoading(false);
    }
  }, [paramUserId]);

  const loadFriendStatus = useCallback(async () => {
    if (!isViewingOther || !myId || !targetId) return;
    setStatusLoading(true);
    try {
      setFriendStatus(await friendService.getFriendStatus(myId, targetId));
    } finally {
      setStatusLoading(false);
    }
  }, [isViewingOther, myId, targetId]);

  const loadOtherFriendsCount = useCallback(async () => {
    if (!isViewingOther || !targetId) return;
    try {
      const list = await friendService.getFriends(targetId);
      setOtherFriendsCount(list.length);
    } catch {}
  }, [isViewingOther, targetId]);

  const loadPostsCount = useCallback(async () => {
    const activeUserId = isViewingOther
      ? String(targetId)
      : String(currentUser?.id);
    if (
      !activeUserId ||
      activeUserId === "undefined" ||
      activeUserId === "NaN"
    ) {
      setProfilePostsCount(null);
      return;
    }

    const count = await postApi.getUserPostsCount(activeUserId);
    setProfilePostsCount(count);
  }, [isViewingOther, targetId, currentUser?.id]);

  const loadHighlights = useCallback(async () => {
    const activeUserId = isViewingOther
      ? String(targetId)
      : String(currentUser?.id);
    if (!activeUserId) return;
    setHighlightsLoading(true);
    try {
      const data = await getUserHighlights(activeUserId);
      setHighlights(data);
    } catch (err) {
      console.error("Error loading highlights:", err);
    } finally {
      setHighlightsLoading(false);
    }
  }, [isViewingOther, targetId, currentUser?.id]);

  const mapHighlightStoryToStory = (hs: any, user: any) => {
    // Properly process media URL through buildS3Url
    const mediaUrl = hs.media?.url ? buildS3Url(hs.media.url) || hs.media.url : "";
    const thumbnailUrl = hs.media?.thumbnailUrl ? buildS3Url(hs.media.thumbnailUrl) || hs.media.thumbnailUrl : "";

    return {
      id: hs.id,
      userId: hs.userId,
      image: mediaUrl || hs.image || "",
      viewed: true,
      isViewed: true,
      createdAt: hs.createdAt,
      text: hs.text || "",
      content: hs.text || "",
      media: hs.media
        ? {
            url: mediaUrl,
            type: hs.media.type,
            thumbnailUrl: thumbnailUrl,
          }
        : undefined,
      user: user
        ? {
            id: String(user.id),
            username: user.username || "",
            fullName: user.fullName || user.name || user.username || "",
            name: user.name || user.fullName || user.username || "",
            bio: user.bio || "",
            avatarUrl: user.avatarUrl || user.avatar || "",
            avatar: user.avatar || user.avatarUrl || "",
            followers: user.followers || 0,
            following: user.following || 0,
          }
        : undefined,
      privacy: "PUBLIC" as PrivacyType,
      allowReplies: false,
      allowReactions: false,
      allowSharing: false,
      viewCount: 0,
    };
  };

  const handlePlayHighlight = (index: number) => {
    const groups = highlights.map((hl) => ({
      userId: String(profileUser?.id || currentUser?.id),
      username: hl.title,
      userAvatar: hl.coverImageUrl || "",
      stories: hl.stories.map((hs) =>
        mapHighlightStoryToStory(hs, profileUser || currentUser)
      ),
      highlightId: hl.id,
    }));

    setViewerGroups(groups);
    setViewerGroupIdx(index);
    setStoryViewerVisible(true);
  };

  const handleLongPressHighlight = (hl: StoryHighlight) => {
    if (isViewingOther) return;
    setLongPressedHighlight(hl);
    setOptionsModalVisible(true);
  };

  useFocusEffect(
    useCallback(() => {
      if (isViewingOther) {
        void loadProfile();
        void loadFriendStatus();
        void loadOtherFriendsCount();
        void loadHighlights();
        void loadPostsCount();
      }
    }, [
      isViewingOther,
      loadProfile,
      loadFriendStatus,
      loadOtherFriendsCount,
      loadHighlights,
      loadPostsCount,
      refreshTrigger,
      profileFriendTrigger,
    ])
  );

  // ── Load own-profile data ─────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (isViewingOther || !currentUser?.id) return;
      friendService
        .getFriends(Number(currentUser.id))
        .then((list) => setFriendsCount(list.length))
        .catch(() => {});
      void loadHighlights();
      void loadPostsCount();
    }, [
      isViewingOther,
      currentUser?.id,
      loadHighlights,
      loadPostsCount,
      loadOtherFriendsCount,
      refreshTrigger,
    ])
  );

  useEffect(() => {
    if (isViewingOther || !currentUser?.id) return;

    friendService
      .getFriends(Number(currentUser.id))
      .then((list) => setFriendsCount(list.length))
      .catch(() => {});
  }, [isViewingOther, currentUser?.id, refreshTrigger]);

  const loadBlockedUsers = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingBlocked(true);
    try {
      setBlockedUsers(
        await blockService.getBlockedUsers(Number(currentUser.id))
      );
    } catch {
    } finally {
      setIsLoadingBlocked(false);
    }
  }, [currentUser?.id]);

  const loadTabContent = useCallback(async () => {
    const activeUserId = isViewingOther
      ? String(targetId)
      : String(currentUser?.id);
    if (!activeUserId) return;
    if (isPrivateProfile) {
      setTabPosts([]);
      return;
    }

    setTabLoading(true);
    try {
      if (selectedTab === "posts") {
        const res = await postApi.getUserPostsWithDetails(activeUserId);
        setTabPosts(res);
        void loadPostsCount();
      } else if (selectedTab === "saved") {
        if (!isViewingOther) {
          const res = await postApi.getSavedPostsWithDetails(activeUserId);
          setTabPosts(res);
        } else {
          setTabPosts([]);
        }
      } else if (selectedTab === "tagged") {
        const res = await postApi.getTaggedPostsWithDetails(activeUserId);
        setTabPosts(res);
      } else if (selectedTab === "shared") {
        const res = await postApi.getSharedPostsWithDetails(activeUserId);
        setTabPosts(res);
      } else if (selectedTab === "blocked") {
        // blocked tab không cần load ở đây, xử lý riêng bằng loadBlockedUsers
        setTabPosts([]);
      } else {
        setTabPosts([]);
      }
    } catch (err) {
      console.error("Error loading tab content:", err);
      setTabPosts([]);
    } finally {
      setTabLoading(false);
    }
  }, [
    isViewingOther,
    targetId,
    currentUser?.id,
    selectedTab,
    isPrivateProfile,
    loadPostsCount,
  ]);

  useEffect(() => {
    void loadTabContent();
  }, [loadTabContent, selectedTab, targetId, refreshTrigger, blockTrigger]);

  useEffect(() => {
    if (!isViewingOther && selectedTab === "blocked") void loadBlockedUsers();
  }, [blockTrigger, isViewingOther, selectedTab, loadBlockedUsers]);

  // ── Friend action handlers ────────────────────────────────────────────────
  const handleSendRequest = async () => {
    setActionLoading(true);
    await friendService.sendFriendRequest(myId, targetId);
    await loadFriendStatus();
    await loadOtherFriendsCount();
    setActionLoading(false);
  };
  const handleCancelRequest = async () => {
    setActionLoading(true);
    await friendService.cancelFriendRequest(myId, targetId);
    await loadFriendStatus();
    await loadOtherFriendsCount();
    setActionLoading(false);
  };
  const handleAccept = async () => {
    setActionLoading(true);
    await friendService.acceptFriendRequest(targetId, myId);
    await loadFriendStatus();
    await loadOtherFriendsCount();
    setActionLoading(false);
  };
  const handleReject = async () => {
    setActionLoading(true);
    await friendService.rejectFriendRequest(targetId, myId);
    await loadFriendStatus();
    await loadOtherFriendsCount();
    setActionLoading(false);
  };
  const handleUnfriend = () => {
    Alert.alert("Hủy kết bạn", "Bạn có chắc muốn hủy kết bạn?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Hủy kết bạn",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          await friendService.cancelFriendRequest(myId, targetId);
          await loadFriendStatus();
          await loadOtherFriendsCount();
          setActionLoading(false);
        },
      },
    ]);
  };
  const handleBlock = () => {
    Alert.alert(
      "Chặn người dùng",
      `Chặn @${
        profileUser?.username || "người này"
      }? Họ sẽ không thể nhắn tin hoặc xem hồ sơ của bạn.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chặn",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            await blockService.blockUser(myId, targetId);
            await loadFriendStatus();
            await loadOtherFriendsCount();
            setActionLoading(false);
          },
        },
      ]
    );
  };
  const handleUnblockOther = () => {
    Alert.alert("Bỏ chặn", "Bạn có chắc muốn bỏ chặn người này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Bỏ chặn",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          await blockService.unblockUser(myId, targetId);
          await loadFriendStatus();
          await loadOtherFriendsCount();
          setActionLoading(false);
        },
      },
    ]);
  };
  const handleMoreOptions = () => {
    if (friendStatus === "BLOCKED") {
      handleUnblockOther();
    } else {
      Alert.alert(
        profileUser?.name || profileUser?.username || "Người dùng",
        undefined,
        [
          {
            text: "Chặn người dùng",
            style: "destructive",
            onPress: handleBlock,
          },
          { text: "Hủy", style: "cancel" },
        ]
      );
    }
  };
  // Mở cuộc trò chuyện trực tiếp — giống luồng tìm người trong tin nhắn:
  // lấy quan hệ chat, mở cuộc đã có hoặc tạo/resolve cuộc mới rồi điều hướng.
  const [messageLoading, setMessageLoading] = useState(false);
  const handleMessage = async () => {
    const uid = Number(profileUser?.id ?? targetId);
    if (!Number.isFinite(uid) || uid <= 0 || messageLoading) return;
    setMessageLoading(true);
    try {
      // Quan hệ chat chỉ để lấy peer params + id cuộc đã có (không bắt buộc).
      let result: Awaited<
        ReturnType<typeof chatService.getChatUserRelationship>
      > | null = null;
      try {
        result = await chatService.getChatUserRelationship(uid);
      } catch {
        result = null;
      }

      // Luôn mở/resolve cuộc trò chuyện trực tiếp rồi điều hướng — giống search.
      let conversationId = result?.existingDirectConversationId ?? null;
      if (!conversationId) {
        const conversation = await chatService.resolveDirectConversation(uid);
        conversationId = conversation.id;
      }

      router.push({
        pathname: "/(stack)/messages/[conversationId]",
        params: {
          conversationId: String(conversationId),
          peerFriendStatus: result?.friendStatus ?? "STRANGER",
          peerMutualGroupsCount: String(result?.mutualGroupsCount ?? 0),
        },
      });
    } catch {
      Alert.alert("Thông báo", "Không thể mở cuộc trò chuyện");
    } finally {
      setMessageLoading(false);
    }
  };
  const handleUnblockOwn = (userId: string) => {
    Alert.alert("Bỏ chặn", "Bạn có chắc muốn bỏ chặn người dùng này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Bỏ chặn",
        style: "destructive",
        onPress: async () => {
          try {
            await blockService.unblockUser(
              Number(currentUser?.id),
              Number(userId)
            );
            setBlockedUsers((prev) =>
              prev.filter((u) => String(u.id) !== userId)
            );
          } catch {
            Alert.alert("Lỗi", "Không thể bỏ chặn. Vui lòng thử lại.");
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // ── Friend button (other user) ────────────────────────────────────────────
  const renderFriendButton = () => {
    if (statusLoading) {
      return (
        <View style={[s.btn, s.btnGray, { flex: 1 }]}>
          <ActivityIndicator size="small" color="#000" />
        </View>
      );
    }
    switch (friendStatus) {
      case "NONE":
        return (
          <TouchableOpacity
            style={[s.btn, s.btnBlue, { flex: 1 }]}
            onPress={handleSendRequest}
            disabled={actionLoading}
            activeOpacity={0.75}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.btnBlueText}>Kết bạn</Text>
            )}
          </TouchableOpacity>
        );
      case "SENT":
        return (
          <TouchableOpacity
            style={[s.btn, s.btnGray, { flex: 1 }]}
            onPress={handleCancelRequest}
            disabled={actionLoading}
            activeOpacity={0.75}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={s.btnGrayText}>Đã gửi lời mời</Text>
            )}
          </TouchableOpacity>
        );
      case "RECEIVED":
        return (
          <>
            <TouchableOpacity
              style={[s.btn, s.btnBlue, { flex: 1 }]}
              onPress={handleAccept}
              disabled={actionLoading}
              activeOpacity={0.75}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.btnBlueText}>Chấp nhận</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnGray, { flex: 1 }]}
              onPress={handleReject}
              disabled={actionLoading}
              activeOpacity={0.75}
            >
              <Text style={s.btnGrayText}>Từ chối</Text>
            </TouchableOpacity>
          </>
        );
      case "FRIEND":
        return (
          <TouchableOpacity
            style={[s.btn, s.btnGray, { flex: 1 }]}
            onPress={handleUnfriend}
            disabled={actionLoading}
            activeOpacity={0.75}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={s.btnGrayText}>Bạn bè ▾</Text>
            )}
          </TouchableOpacity>
        );
      case "BLOCKED":
        return (
          <TouchableOpacity
            style={[s.btn, s.btnRed, { flex: 1 }]}
            onPress={handleUnblockOther}
            disabled={actionLoading}
            activeOpacity={0.75}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={s.btnRedText}>Đã chặn</Text>
            )}
          </TouchableOpacity>
        );
    }
  };

  const renderHighlights = () => {
    if (highlightsLoading) {
      return (
        <View style={s.highlightsLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (!isViewingOther && highlights.length === 0) {
      return (
        <View style={s.highlightsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.highlightsScroll}
          >
            <TouchableOpacity
              style={s.highlightItem}
              onPress={() => {
                setSelectedHighlight(null);
                setHighlightModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={s.addHighlightCircle}>
                <Ionicons name="add" size={28} color="#000" />
              </View>
              <Text style={s.highlightTitle} numberOfLines={1}>
                Mới
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    if (highlights.length === 0) return null;

    return (
      <View style={s.highlightsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.highlightsScroll}
        >
          {/* "+" Button for own profile */}
          {!isViewingOther && (
            <TouchableOpacity
              style={s.highlightItem}
              onPress={() => {
                setSelectedHighlight(null);
                setHighlightModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={s.addHighlightCircle}>
                <Ionicons name="add" size={28} color="#000" />
              </View>
              <Text style={s.highlightTitle} numberOfLines={1}>
                Mới
              </Text>
            </TouchableOpacity>
          )}

          {/* Highlights List */}
          {highlights.map((hl, idx) => {
            const hasCoverText = hl.coverImageUrl?.startsWith("text-story:");
            return (
              <TouchableOpacity
                key={hl.id}
                style={s.highlightItem}
                onPress={() => handlePlayHighlight(idx)}
                onLongPress={() => handleLongPressHighlight(hl)}
                activeOpacity={0.8}
              >
                <View style={s.highlightCircleWrap}>
                  {hasCoverText ? (
                    (() => {
                      const text = hl.coverImageUrl!.replace("text-story:", "");
                      const gradIdx = getGradientIndex(text);
                      return (
                        <LinearGradient
                          colors={TEXT_GRADIENTS[gradIdx]}
                          style={s.highlightCover}
                        >
                          <Text numberOfLines={2} style={s.highlightCoverText}>
                            {text}
                          </Text>
                        </LinearGradient>
                      );
                    })()
                  ) : hl.coverImageUrl ? (
                    <Image
                      source={{ uri: buildS3Url(hl.coverImageUrl) }}
                      style={s.highlightCover}
                    />
                  ) : (
                    <View style={[s.highlightCover, s.highlightCoverFallback]}>
                      <Ionicons
                        name="images-outline"
                        size={24}
                        color="#8E8E93"
                      />
                    </View>
                  )}
                </View>
                <Text style={s.highlightTitle} numberOfLines={1}>
                  {hl.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ── Render: OTHER USER ────────────────────────────────────────────────────
  if (isViewingOther) {
    const u = profileUser;
    return (
      <View style={s.screen}>
        {profileLoading ? (
          <View style={s.fullCenter}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: insets.top + 12,
              paddingBottom: 40,
            }}
          >
            {/* Avatar (trái) + username / stats (phải) */}
            <View style={s.profileTopRow}>
              <View>
                {/* Note bubble - other user */}
                {note && (
                  <TouchableOpacity
                    style={s.noteBubble}
                    onPress={openNoteModal}
                    activeOpacity={0.8}
                  >
                    {note.content?.trim() ? (
                      <Text style={s.noteBubbleText} numberOfLines={2}>
                        {note.content}
                      </Text>
                    ) : note.music?.title ? (
                      <Text style={s.noteBubbleText} numberOfLines={1}>
                        🎵 {note.music.title}
                      </Text>
                    ) : note.location?.trim() ? (
                      <Text style={s.noteBubbleText} numberOfLines={1}>
                        📍 {note.location}
                      </Text>
                    ) : null}
                    <View style={s.noteBubbleArrow} />
                  </TouchableOpacity>
                )}
                <View style={s.avatarPresenceWrap}>
                  {u?.avatarUrl ? (
                    <Image
                      source={{ uri: buildS3Url(u.avatarUrl) }}
                      style={s.avatar}
                    />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback]}>
                      <Ionicons name="person" size={38} color="#C7C7CC" />
                    </View>
                  )}
                  {isProfileOnline ? <View style={s.onlineDotLarge} /> : null}
                </View>
              </View>
              <View style={s.profileRightCol}>
                <Text style={s.profileUsername} numberOfLines={1}>
                  {isPrivateProfile
                    ? paramUsername || u?.username || "Người dùng"
                    : u?.username || u?.name || "Người dùng"}
                </Text>
                <View style={s.statsRow}>
                  <StatItem
                    value={String(profilePostsCount ?? 0)}
                    label="Bài viết"
                  />
                  <StatItem
                    value={
                      isPrivateProfile
                        ? otherFriendsCount !== null
                          ? String(otherFriendsCount)
                          : "—"
                        : otherFriendsCount !== null
                        ? String(otherFriendsCount)
                        : "—"
                    }
                    label="Bạn bè"
                  />
                </View>
              </View>
            </View>

            {/* Info */}
            <View style={s.infoBlock}>
              {!isPrivateProfile && (u?.name || u?.fullName) ? (
                <Text style={s.displayName}>{u?.name || u?.fullName}</Text>
              ) : null}
              {!isPrivateProfile && u?.gender && GENDER_LABEL[u.gender] ? (
                <Text style={s.infoMeta}>{GENDER_LABEL[u.gender]}</Text>
              ) : null}
              {!isPrivateProfile && u?.birthday ? (
                <Text style={s.infoMeta}>{u.birthday}</Text>
              ) : null}
              {!isPrivateProfile && u?.bio ? (
                <Text style={s.bio}>{u.bio}</Text>
              ) : null}
            </View>

            {/* Action buttons */}
            <View style={s.actionRow}>
              {renderFriendButton()}
              <TouchableOpacity
                style={[s.btn, s.btnGray, { flex: 1 }]}
                onPress={handleMessage}
                disabled={messageLoading}
                activeOpacity={0.75}
              >
                {messageLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={s.btnGrayText}>Nhắn tin</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnGray, s.btnIcon]}
                onPress={() => setInfoModalVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#000"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnGray, s.btnIcon]}
                onPress={handleMoreOptions}
                activeOpacity={0.75}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Highlights */}
            {renderHighlights()}

            {/* Info modal */}
            <Modal
              visible={infoModalVisible}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setInfoModalVisible(false)}
            >
              <View style={s.modalContainer}>
                <View style={s.modalHandle} />
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Thông tin</Text>
                  <TouchableOpacity
                    onPress={() => setInfoModalVisible(false)}
                    hitSlop={12}
                  >
                    <Ionicons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  contentContainerStyle={s.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Avatar + name */}
                  <View style={s.modalProfileRow}>
                    {u?.avatarUrl ? (
                      <Image
                        source={{ uri: buildS3Url(u.avatarUrl) }}
                        style={s.modalAvatar}
                      />
                    ) : (
                      <View style={[s.modalAvatar, s.avatarFallback]}>
                        <Ionicons name="person" size={28} color="#C7C7CC" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalName}>
                        {isPrivateProfile
                          ? paramUsername || "Người dùng"
                          : u?.name ||
                            u?.fullName ||
                            u?.username ||
                            "Người dùng"}
                      </Text>
                      {(isPrivateProfile ? paramUsername : u?.username) ? (
                        <Text style={s.modalSub}>
                          @{isPrivateProfile ? paramUsername : u?.username}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={s.modalDivider} />

                  {/* Info rows */}
                  <InfoModalRow
                    icon="at"
                    label="Tên người dùng"
                    value={
                      isPrivateProfile
                        ? "**********"
                        : u?.username
                        ? `@${u.username}`
                        : ""
                    }
                  />
                  <InfoModalRow
                    icon="person-outline"
                    label="Họ và tên"
                    value={
                      isPrivateProfile
                        ? "***********"
                        : u?.name || u?.fullName || ""
                    }
                  />
                  {isPrivateProfile || u?.birthday ? (
                    <InfoModalRow
                      icon="calendar-outline"
                      label="Ngày sinh"
                      value={isPrivateProfile ? "**/***/****" : u!.birthday!}
                    />
                  ) : null}
                  {isPrivateProfile || (u?.gender && GENDER_LABEL[u.gender]) ? (
                    <InfoModalRow
                      icon="people-outline"
                      label="Giới tính"
                      value={
                        isPrivateProfile ? "******" : GENDER_LABEL[u!.gender!]
                      }
                    />
                  ) : null}
                  {isPrivateProfile || u?.bio ? (
                    <InfoModalRow
                      icon="chatbubble-outline"
                      label="Giới thiệu"
                      value={isPrivateProfile ? "**************" : u!.bio!}
                    />
                  ) : null}
                  {isPrivateProfile || u?.phone ? (
                    <InfoModalRow
                      icon="call-outline"
                      label="Số điện thoại"
                      value={isPrivateProfile ? "**********" : u!.phone!}
                    />
                  ) : null}
                  {typeof otherFriendsCount === "number" ? (
                    <InfoModalRow
                      icon="people"
                      label="Bạn bè"
                      value={`${otherFriendsCount} người`}
                    />
                  ) : null}
                </ScrollView>
              </View>
            </Modal>

            {/* Tab bar */}
            <View style={s.tabBar}>
              {OTHER_TABS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.tabItem, selectedTab === t.key && s.tabItemActive]}
                  onPress={() => {
                    setSelectedTab(t.key);
                    if (t.key === "blocked") void loadBlockedUsers();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={selectedTab === t.key ? t.icon : t.iconOutline}
                    size={22}
                    color={selectedTab === t.key ? "#000" : "#8E8E93"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab content */}
            {isPrivateProfile ? (
              <PrivateAccountLock />
            ) : tabLoading ? (
              <View style={{ paddingVertical: 32 }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : displayPosts.length > 0 ? (
              <PostGrid
                posts={displayPosts}
                onPressPost={(post) =>
                  router.push({
                    pathname: "/(stack)/post/[postId]",
                    params: { postId: post.id },
                  })
                }
              />
            ) : (
              <View style={s.emptyWrap}>
                <View style={s.emptyCircle}>
                  <Ionicons
                    name={
                      selectedTab === "tagged"
                        ? "at"
                        : selectedTab === "shared"
                        ? "paper-plane-outline"
                        : "camera-outline"
                    }
                    size={38}
                    color="#C7C7CC"
                  />
                </View>
                <Text style={s.emptyTitle}>
                  {selectedTab === "tagged"
                    ? "Chưa có bài viết gắn thẻ"
                    : selectedTab === "shared"
                    ? "Chưa có bài viết chia sẻ"
                    : "Chưa có bài viết"}
                </Text>
                <Text style={s.emptySub}>
                  {selectedTab === "tagged"
                    ? "Bài viết họ được gắn thẻ sẽ hiển thị ở đây"
                    : selectedTab === "shared"
                    ? "Bài viết họ đã chia sẻ sẽ hiển thị ở đây"
                    : "Bài viết của họ sẽ hiển thị ở đây"}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <StoryViewer
          visible={storyViewerVisible}
          groups={viewerGroups}
          initialGroupIdx={viewerGroupIdx}
          currentUser={currentUser}
          onClose={() => setStoryViewerVisible(false)}
          onStoryRemovedFromHighlight={loadHighlights}
          onEditHighlight={(hlId) => {
            const found = highlights.find((h) => String(h.id) === String(hlId));
            if (found) {
              setSelectedHighlight(found);
              setHighlightModalVisible(true);
            }
          }}
        />

        {/* Note Modal */}
        <NoteModal
          visible={showNoteModal}
          userId={noteUserId}
          isOwnProfile={false}
          onClose={closeNoteModal}
          onNoteChange={setNote}
        />
      </View>
    );
  }

  // ── Render: OWN PROFILE ───────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <View style={s.fullCenter}>
        <Ionicons name="person-circle-outline" size={64} color="#C7C7CC" />
        <Text style={{ fontSize: 15, color: "#8E8E93", marginTop: 8 }}>
          Không có dữ liệu người dùng
        </Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}
      >
        {/* Avatar (trái) + username / stats / settings (phải) — cùng một hàng */}
        <View style={s.profileTopRow}>
          <View>
            {/* Note bubble - own profile */}
            <TouchableOpacity
              style={s.noteBubble}
              onPress={openNoteModal}
              activeOpacity={0.8}
            >
              {note ? (
                <>
                  {note.content?.trim() ? (
                    <Text style={s.noteBubbleText} numberOfLines={2}>
                      {note.content}
                    </Text>
                  ) : note.music?.title ? (
                    <Text style={s.noteBubbleText} numberOfLines={1}>
                      🎵 {note.music.title}
                    </Text>
                  ) : note.location?.trim() ? (
                    <Text style={s.noteBubbleText} numberOfLines={1}>
                      📍 {note.location}
                    </Text>
                  ) : (
                    <Text style={s.noteBubblePlaceholder}>
                      Bấm để cập nhật ghi chú
                    </Text>
                  )}
                </>
              ) : (
                <Text style={s.noteBubblePlaceholder}>✏️ Thêm ghi chú...</Text>
              )}
              <View style={s.noteBubbleArrow} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(stack)/profile/edit")}
              activeOpacity={0.85}
            >
              <View style={s.avatarPresenceWrap}>
                {currentUser.avatarUrl ? (
                  <Image
                    source={{ uri: buildS3Url(currentUser.avatarUrl) }}
                    style={s.avatar}
                  />
                ) : (
                  <View style={[s.avatar, s.avatarFallback]}>
                    <Ionicons name="person" size={38} color="#C7C7CC" />
                  </View>
                )}
                {isProfileOnline ? <View style={s.onlineDotLarge} /> : null}
              </View>
            </TouchableOpacity>
          </View>

          <View style={s.profileRightCol}>
            {/* Username + settings */}
            <View style={s.profileUsernameRow}>
              <Text style={s.profileUsername} numberOfLines={1}>
                {currentUser.username || currentUser.name}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(stack)/profile/menu")}
                hitSlop={12}
                style={s.topRowIcon}
              >
                <Ionicons name="settings-outline" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <StatItem
                value={String(profilePostsCount ?? 0)}
                label="Bài viết"
              />
              <StatItem value={String(friendsCount)} label="Bạn bè" />
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={s.infoBlock}>
          {currentUser.name || currentUser.fullName ? (
            <Text style={s.displayName}>
              {currentUser.name || currentUser.fullName}
            </Text>
          ) : null}
          {currentUser.gender && GENDER_LABEL[currentUser.gender] ? (
            <Text style={s.infoMeta}>{GENDER_LABEL[currentUser.gender]}</Text>
          ) : null}
          {currentUser.birthday ? (
            <Text style={s.infoMeta}>{currentUser.birthday}</Text>
          ) : null}
          {currentUser.bio ? (
            <Text style={s.bio}>{currentUser.bio}</Text>
          ) : null}
          {currentUser.phone ? (
            <Text style={s.infoPhone}>{currentUser.phone}</Text>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.btn, s.btnGray, { flex: 1 }]}
            onPress={() => router.push("/(stack)/profile/edit")}
            activeOpacity={0.75}
          >
            <Text style={s.btnGrayText}>Chỉnh sửa hồ sơ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnGray, s.btnIcon]}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Highlights */}
        {renderHighlights()}

        {/* Tab bar */}
        <View style={s.tabBar}>
          {OWN_TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabItem, selectedTab === t.key && s.tabItemActive]}
              onPress={() => setSelectedTab(t.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selectedTab === t.key ? t.icon : t.iconOutline}
                size={22}
                color={selectedTab === t.key ? "#000" : "#8E8E93"}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {selectedTab === "blocked" ? (
          isLoadingBlocked ? (
            <View style={s.emptyWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : blockedUsers.length > 0 ? (
            blockedUsers.map((bu) => (
              <View key={bu.id} style={s.blockedRow}>
                {bu.avatar || bu.avatarUrl ? (
                  <Image
                    source={{ uri: bu.avatar || buildS3Url(bu.avatarUrl) }}
                    style={s.blockedAvatar}
                  />
                ) : (
                  <View style={[s.blockedAvatar, s.avatarFallback]}>
                    <Ionicons name="person" size={20} color="#C7C7CC" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.blockedName} numberOfLines={1}>
                    {bu.name || bu.username}
                  </Text>
                  {bu.username && (
                    <Text style={s.blockedSub} numberOfLines={1}>
                      @{bu.username}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[s.btn, s.btnGray]}
                  onPress={() => handleUnblockOwn(String(bu.id))}
                  activeOpacity={0.7}
                >
                  <Text style={s.btnGrayText}>Bỏ chặn</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={s.emptyWrap}>
              <View style={s.emptyCircle}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={38}
                  color="#C7C7CC"
                />
              </View>
              <Text style={s.emptyTitle}>Chưa chặn ai</Text>
              <Text style={s.emptySub}>
                Những người bạn chặn sẽ hiển thị ở đây
              </Text>
            </View>
          )
        ) : tabLoading ? (
          <View style={{ paddingVertical: 32 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : displayPosts.length > 0 ? (
          <PostGrid
            posts={displayPosts}
            onPressPost={(post) =>
              router.push({
                pathname: "/(stack)/post/[postId]",
                params: { postId: post.id },
              })
            }
          />
        ) : (
          <View style={s.emptyWrap}>
            <View style={s.emptyCircle}>
              <Ionicons
                name={
                  selectedTab === "saved"
                    ? "bookmark-outline"
                    : selectedTab === "tagged"
                    ? "at"
                    : selectedTab === "shared"
                    ? "paper-plane-outline"
                    : "camera-outline"
                }
                size={38}
                color="#C7C7CC"
              />
            </View>
            <Text style={s.emptyTitle}>
              {selectedTab === "saved"
                ? "Chưa lưu bài viết"
                : selectedTab === "tagged"
                ? "Chưa có bài viết gắn thẻ"
                : selectedTab === "shared"
                ? "Chưa có bài viết chia sẻ"
                : "Chưa có bài viết"}
            </Text>
            <Text style={s.emptySub}>
              {selectedTab === "saved"
                ? "Bài viết bạn lưu sẽ hiển thị ở đây"
                : selectedTab === "tagged"
                ? "Bài viết bạn được gắn thẻ sẽ hiển thị ở đây"
                : selectedTab === "shared"
                ? "Bài viết bạn đã chia sẻ sẽ hiển thị ở đây"
                : "Bài viết bạn tạo sẽ hiển thị ở đây"}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Highlight creation and editing modal */}
      <HighlightModal
        visible={highlightModalVisible}
        onClose={() => setHighlightModalVisible(false)}
        onSaveSuccess={loadHighlights}
        currentUserId={String(currentUser.id)}
        highlight={selectedHighlight}
      />

      {/* Highlight Options Drawer */}
      <HighlightOptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        onEdit={() => {
          setSelectedHighlight(longPressedHighlight);
          setHighlightModalVisible(true);
        }}
        onDelete={() => {
          if (longPressedHighlight) {
            Alert.alert(
              "Xóa tin nổi bật",
              "Bạn có chắc chắn muốn xóa tin nổi bật này không?",
              [
                { text: "Hủy", style: "cancel" },
                {
                  text: "Xóa",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteHighlight(longPressedHighlight.id);
                      Alert.alert("Thành công", "Đã xóa tin nổi bật");
                      void loadHighlights();
                    } catch (err: any) {
                      Alert.alert("Lỗi", "Không thể xóa tin nổi bật");
                    }
                  },
                },
              ]
            );
          }
        }}
        highlightTitle={longPressedHighlight?.title || ""}
      />

      {/* StoryViewer for Highlights */}
      <StoryViewer
        visible={storyViewerVisible}
        groups={viewerGroups}
        initialGroupIdx={viewerGroupIdx}
        currentUser={currentUser}
        onClose={() => setStoryViewerVisible(false)}
        onStoryRemovedFromHighlight={loadHighlights}
        onEditHighlight={(hlId) => {
          const found = highlights.find((h) => String(h.id) === String(hlId));
          if (found) {
            setSelectedHighlight(found);
            setHighlightModalVisible(true);
          }
        }}
      />

      {/* Note Modal */}
      <NoteModal
        visible={showNoteModal}
        userId={noteUserId}
        isOwnProfile={true}
        onClose={closeNoteModal}
        onNoteChange={setNote}
      />
    </View>
  );
}

// ── Private account lock screen ──────────────────────────────────────────────
function PrivateAccountLock() {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 64,
        paddingHorizontal: 40,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          borderWidth: 2,
          borderColor: "#000",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="lock-closed" size={36} strokeWidth={1.5} color="#000" />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: "#000",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Tài khoản này ở chế độ riêng tư
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: "#8E8E93",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        Chỉ những người theo dõi mới xem được ảnh và video của họ.
      </Text>
    </View>
  );
}

// ── Info modal row ───────────────────────────────────────────────────────────
function InfoModalRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={s.infoModalRow}>
      <View style={s.infoModalIconWrap}>
        <Ionicons name={icon} size={18} color="#3C3C43" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoModalLabel}>{label}</Text>
        <Text style={s.infoModalValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Small stat cell ─────────────────────────────────────────────────────────
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  /* ── Own profile top row: avatar bên trái + cột phải (username+stats) ── */
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 16,
  },
  profileRightCol: {
    flex: 1,
    gap: 10,
  },
  profileUsernameRow: {
    flexDirection: "row",
    marginLeft: 18,
    alignItems: "center",
    gap: 8,
  },
  profileUsername: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.3,
  },
  topRowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Other-user profile row (avatar left + stats right) ── */
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 20,
  },
  avatarStoryRing: {},
  statsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },

  /* ── Shared avatar + stat styles ── */
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DBDBDB",
  },
  avatarPresenceWrap: {
    position: "relative",
    width: 86,
    height: 86,
  },
  avatarFallback: {
    backgroundColor: "#EFEFEF",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDotLarge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#22C55E",
  },
  statItem: {
    alignItems: "center",
    gap: 1,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  statLabel: {
    fontSize: 13,
    color: "#000",
  },

  /* ── Info block ── */
  infoBlock: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 2,
  },
  displayName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 1,
  },
  infoMeta: {
    fontSize: 13,
    color: "#3C3C43",
  },
  bio: {
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
  infoPhone: {
    fontSize: 14,
    color: "#0095F6",
  },

  /* ── Action buttons ── */
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 14,
  },
  btn: {
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnGray: {
    backgroundColor: "#EFEFEF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DBDBDB",
  },
  btnBlue: {
    backgroundColor: "#0095F6",
  },
  btnRed: {
    backgroundColor: "#FEE2E2",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FECACA",
  },
  btnIcon: {
    width: 34,
    paddingHorizontal: 0,
  },
  btnGrayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  btnBlueText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  btnRedText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },

  /* ── Tab bar ── */
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DBDBDB",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DBDBDB",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderTopWidth: 1.5,
    borderTopColor: "transparent",
  },
  tabItemActive: {
    borderTopColor: "#000",
  },

  /* ── Grid ── */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EFEFEF",
  },
  gridPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EFEFEF",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Blocked list ── */
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DBDBDB",
    backgroundColor: "#fff",
  },
  blockedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  blockedName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  blockedSub: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 1,
  },

  /* ── Empty state ── */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: "#C7C7CC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },

  /* ── Info modal ── */
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E5EA",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  modalBody: {
    paddingBottom: 40,
  },
  modalProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DBDBDB",
  },
  modalName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  modalSub: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  infoModalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F2F2F7",
  },
  infoModalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoModalLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 2,
  },
  infoModalValue: {
    fontSize: 15,
    color: "#000",
    lineHeight: 20,
  },

  /* ── Highlights Styles ── */
  highlightsSection: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
    backgroundColor: "#fff",
  },
  highlightsScroll: {
    paddingHorizontal: 16,
    gap: 18,
  },
  highlightItem: {
    alignItems: "center",
    width: 68,
  },
  highlightCircleWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#C7C7CC",
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  highlightCover: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  highlightCoverFallback: {
    backgroundColor: "#F2F2F7",
  },
  highlightCoverText: {
    color: "#fff",
    fontSize: 7,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  highlightTitle: {
    fontSize: 12,
    color: "#000",
    textAlign: "center",
    width: "100%",
  },
  addHighlightCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  highlightsLoader: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Note bubble ── */
  noteBubble: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    maxWidth: 120,
    alignSelf: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  noteBubbleText: {
    fontSize: 11,
    color: "#000",
    fontWeight: "600",
    lineHeight: 15,
  },
  noteBubblePlaceholder: {
    fontSize: 10,
    color: "#8E8E93",
    fontWeight: "500",
  },
  noteBubbleArrow: {
    position: "absolute",
    bottom: -5,
    left: 8,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#F2F2F7",
  },
});
