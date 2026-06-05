import { colors, spacing, typography } from "@/constants";
import { Post, User } from "@/types";
import { compactNumber, formatRelativeTime } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import UserAvatar from "./UserAvatar";
import * as postApi from "@/services/postService";
import { emitReactionEvent, subscribeReactionEvents, GlobalReactionEvent } from "@/services/reactionEventService";
import EditPostModal from "@/components/post/EditPostModal";
import { useRouter } from "expo-router";
import useRealtimePostStats from "@/hooks/useRealtimePostStats";
import useRealtimeReactions, { ReactionRealtimeEvent } from "@/hooks/useRealtimeReactions";
import useMusicAutoplay from "@/hooks/useMusicAutoplay";

const REACTIONS = [
  { type: "LIKE", emoji: "👍" },
  { type: "LOVE", emoji: "❤️" },
  { type: "HAHA", emoji: "😆" },
  { type: "WOW", emoji: "😮" },
  { type: "SAD", emoji: "😢" },
  { type: "ANGRY", emoji: "😡" },
];

const getReactionEmoji = (type: string | null): string | null => {
  if (!type) return null;
  return REACTIONS.find((r) => r.type === type)?.emoji || null;
};

const privacyLabels: Record<string, string> = {
  PUBLIC: "Công khai",
  FRIENDS: "Bạn bè",
  ONLY_ME: "Chỉ mình tôi",
  SPECIFIC: "Tùy chỉnh",
  EXCEPT: "Ngoại trừ",
};

type Props = {
  post: Post;
  author?: User;
  liked?: boolean;
  saved?: boolean;
  currentUserId?: string;
  onLike?: (reactionType: string, isToggleOff: boolean) => void;
  onSave?: () => void;
  onAddComment?: (content: string, skipApiCall?: boolean) => void;
  onDeleted?: (postId: string) => void;
  onPrivacyChanged?: (postId: string, privacy: string) => void;
  onOpenPost?: (postId: string) => void;
  onPostUpdated?: (post: Post) => void;
  hideCommentInput?: boolean;
};

export default function PostCard({
  post,
  author,
  liked = false,
  saved = false,
  currentUserId,
  onLike,
  onSave,
  onAddComment,
  onDeleted,
  onPrivacyChanged,
  onOpenPost,
  onPostUpdated,
  hideCommentInput,
}: Props) {
  const router = useRouter();
  const resolvedAuthor = author || post.user;
  const isOwnPost = Boolean(
    currentUserId && currentUserId === (resolvedAuthor?.id || post.userId)
  );
  const [comment, setComment] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // currentReaction: local state to track user's specific reaction type
  // This is fetched from API and updated on user actions
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  // Track if reaction type was fetched from API (to avoid overriding with default "LIKE")
  const [reactionFetchedFromApi, setReactionFetchedFromApi] = useState(false);

  const { commentsCount, setCommentsCount } =
    useRealtimePostStats({
      postId: post.id,
      initialLikes: post.likes || 0,
      initialComments: post.commentsCount ?? post.comments?.length ?? 0,
    });

  // Fetch user's current reaction type from API when component mounts or post changes
  useEffect(() => {
    let cancelled = false;
    const fetchReactionType = async () => {
      if (!currentUserId) return;
      console.log(`[PostCard] Fetching reaction for post ${post.id}`);
      try {
        const reaction = await postApi.fetchUserReaction(currentUserId, post.id);
        console.log(`[PostCard] Reaction fetched:`, reaction);
        if (!cancelled) {
          if (reaction?.type) {
            setCurrentReaction(reaction.type);
            setReactionFetchedFromApi(true);
          } else {
            // No reaction found, ensure state is cleared
            setCurrentReaction(null);
            setReactionFetchedFromApi(true);
          }
        }
      } catch (err) {
        console.error(`[PostCard] Error fetching reaction:`, err);
        if (!cancelled) {
          setReactionFetchedFromApi(true);
        }
      }
    };
    void fetchReactionType();
    return () => { cancelled = true; };
  }, [currentUserId, post.id]);

  // Sync currentReaction when liked prop changes from global state OR when API returns reaction type
  useEffect(() => {
    // If API returned a reaction type (reactionFetchedFromApi=true), keep it
    // regardless of liked prop (API is source of truth)
    if (reactionFetchedFromApi && currentReaction) {
      // API returned a specific reaction - this is correct, don't touch it
      return;
    }
    // Only set default "LIKE" if liked=true AND API hasn't fetched yet AND no currentReaction
    if (liked && !currentReaction && !reactionFetchedFromApi) {
      setCurrentReaction("LIKE");
    }
    // If API confirmed no reaction (fetched but null), clear currentReaction
    if (reactionFetchedFromApi && !currentReaction && !liked) {
      // API confirmed no reaction exists
    }
  }, [liked, currentReaction, reactionFetchedFromApi]);

  // Likes count: starts with post.likes, updated by realtime events
  const [realtimeLikesCount, setRealtimeLikesCount] = useState<number | null>(null);

  // Subscribe to realtime reaction updates
  const handleReactionUpdate = useCallback((event: ReactionRealtimeEvent) => {
    if (event.userId === currentUserId) return;
    if (event.targetType !== "POST" || event.targetId !== post.id) return;
    setRealtimeLikesCount(prev =>
      event.action === "REACT" ? (prev ?? post.likes ?? 0) + 1 : Math.max(0, (prev ?? post.likes ?? 0) - 1)
    );
  }, [currentUserId, post.id, post.likes]);

  useRealtimeReactions({
    postId: post.id,
    enabled: Boolean(currentUserId),
    onReactionUpdate: handleReactionUpdate,
  });

  // Subscribe to global reaction events for cross-component sync
  useEffect(() => {
    console.log(`[PostCard] Subscribing to reaction events for post ${post.id}, user ${currentUserId}`);
    const unsubscribe = subscribeReactionEvents((event: GlobalReactionEvent) => {
      console.log(`[PostCard] Received global reaction event:`, event);
      if (event.postId !== post.id) return;
      if (event.userId !== currentUserId) return;

      console.log(`[PostCard] Updating currentReaction for post ${post.id}: ${event.isToggleOff ? 'null' : event.reactionType}`);
      if (event.isToggleOff) {
        setCurrentReaction(null);
      } else {
        setCurrentReaction(event.reactionType);
      }
    });
    return unsubscribe;
  }, [post.id, currentUserId]);

  // Display count: use realtime count if available, otherwise use post.likes
  const likesCount = realtimeLikesCount ?? post.likes ?? 0;

  // Music autoplay
  const {
    isPlaying: isMusicPlaying,
    togglePlay: handleToggleMusic,
  } = useMusicAutoplay({
    musicId: `post-card-music-${post.id}`,
    audioPath: post.music?.audioUrl,
    enabled: Boolean(post.music?.audioUrl),
    autoPlay: false,
  });

  const locationText =
    typeof post.location === "string"
      ? post.location
      : (post.location as any)?.name ||
        (post.location as any)?.display_name ||
        "";
  const taggedCount = post.taggedUserIds?.length || 0;

  const mediaItems = useMemo((): Array<{
    url: string;
    type: string;
    duration?: number;
    width?: number;
    height?: number;
  }> => {
    if (post.media?.length) return post.media;
    if (post.images?.length)
      return post.images.map((url) => ({
        url,
        type: postApi.detectMediaKind(url),
      }));
    if (post.image)
      return [{ url: post.image, type: postApi.detectMediaKind(post.image) }];
    return [];
  }, [post.image, post.images, post.media]);

  const currentMedia = mediaItems[currentIndex];
  const avatarUri = resolvedAuthor?.avatarUrl || resolvedAuthor?.avatar;
  const displayName =
    resolvedAuthor?.fullName ||
    resolvedAuthor?.name ||
    resolvedAuthor?.username ||
    "Unknown";
  const username = resolvedAuthor?.username || "unknown";

  const handleReaction = useCallback(async (reactionType: string) => {
    if (!currentUserId) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để bày tỏ cảm xúc");
      return;
    }

    // Toggle off if same reaction type
    const isToggleOff = currentReaction === reactionType;

    if (onLike) {
      console.log(`[PostCard] Emitting reaction event for post ${post.id}`);
      onLike(reactionType, isToggleOff);
      // Emit global event so all PostCard instances sync
      emitReactionEvent({
        action: isToggleOff ? "UNREACT" : "REACT",
        postId: post.id,
        reactionType,
        userId: currentUserId,
        isToggleOff,
        likesCount: isToggleOff ? Math.max(0, (realtimeLikesCount ?? post.likes ?? 0) - 1) : ((realtimeLikesCount ?? post.likes ?? 0) + 1),
      });
    } else {
      // Fallback: direct API call
      try {
        await postApi.togglePostReaction(currentUserId, post.id, reactionType);
      } catch {
        Alert.alert("Lỗi", "Không thể cập nhật cảm xúc");
      }
    }

    // Optimistically update local state
    if (isToggleOff) {
      setCurrentReaction(null);
      setRealtimeLikesCount(prev => prev !== null ? Math.max(0, prev - 1) : null);
    } else {
      setCurrentReaction(reactionType);
      setRealtimeLikesCount(prev => prev !== null ? prev + 1 : null);
    }
    setShowReactions(false);
  }, [currentUserId, post.id, currentReaction, onLike]);

  const submitComment = async () => {
    const content = comment.trim();
    if (!content || post.allowComments === false) return;
    if (!currentUserId) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để bình luận");
      return;
    }

    if (onAddComment) {
      onAddComment(content);
      setComment("");
    } else {
      setSubmittingComment(true);
      try {
        await postApi.submitComment(currentUserId, post.id, content);
        setCommentsCount(prev => prev + 1);
        setComment("");
      } catch (error: any) {
        Alert.alert(
          "Lỗi",
          error?.response?.data?.message || "Không thể gửi bình luận"
        );
      } finally {
        setSubmittingComment(false);
      }
    }
  };

  const handleSave = async () => {
    if (!currentUserId) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để lưu bài viết");
      return;
    }
    if (onSave) onSave();
    else {
      try {
        await postApi.togglePostSaved(currentUserId, post.id);
      } catch {
        Alert.alert("Lỗi", "Không thể lưu bài viết");
      }
    }
  };

  const handleShare = async () => {
    if (post.allowShares === false) return;
    if (!currentUserId) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để chia sẻ bài viết");
      return;
    }
    try {
      await postApi.sharePost(post.id);
      await Share.share({ message: post.caption || `Post ${post.id}` });
    } catch {
      Alert.alert("Lỗi", "Không thể chia sẻ bài viết");
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(`/post/${post.id}`);
    setShowMenu(false);
    Alert.alert("Thông báo", "Đã sao chép liên kết bài viết");
  };

  const changePrivacy = async (privacy: postApi.PrivacyType) => {
    if (!currentUserId) return;
    setMenuBusy(true);
    try {
      await postApi.updatePostPrivacy(currentUserId, post.id, privacy);
      onPrivacyChanged?.(post.id, privacy);
      setShowMenu(false);
      Alert.alert("Thông báo", "Đã cập nhật quyền riêng tư");
    } catch {
      Alert.alert("Lỗi", "Không thể cập nhật quyền riêng tư");
    } finally {
      setMenuBusy(false);
    }
  };

  const deletePost = async () => {
    if (!currentUserId) return;
    Alert.alert("Xóa bài viết", "Bạn có chắc muốn xóa bài viết này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          setMenuBusy(true);
          try {
            await postApi.deletePost(post.id, currentUserId);
            onDeleted?.(post.id);
            setShowMenu(false);
          } catch {
            Alert.alert(
              "Lỗi",
              "Không thể xóa bài viết. Bạn chỉ có thể xóa bài viết của mình."
            );
          } finally {
            setMenuBusy(false);
          }
        },
      },
    ]);
  };

  const goPrev = () =>
    setCurrentIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
  const goNext = () =>
    setCurrentIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));

  const navigateToProfile = (userId?: string) => {
    if (!userId) return;
    router.push({
      pathname: "/(tabs)/user-profile" as any,
      params: { userId: String(userId) },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.userRow}>
          <Pressable onPress={() => navigateToProfile(resolvedAuthor?.id)}>
            <UserAvatar uri={avatarUri} name={displayName} size={38} />
          </Pressable>
          <View style={styles.userMeta}>
            <View style={styles.nameRow}>
              <Pressable onPress={() => navigateToProfile(resolvedAuthor?.id)}>
                <Text style={styles.username}>{username}</Text>
              </Pressable>
              {post.privacy ? <Text style={styles.dot}>•</Text> : null}
              {post.privacy ? (
                <Text style={styles.privacy}>
                  {privacyLabels[post.privacy] || post.privacy}
                </Text>
              ) : null}
            </View>
            <View style={styles.subRow}>
              <Text style={styles.time}>
                {formatRelativeTime(post.createdAt)}
              </Text>
              {locationText ? (
                <>
                  <Text style={styles.dot}>•</Text>
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color={colors.textMuted}
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {locationText}
                  </Text>
                </>
              ) : null}
              {post.music?.audioUrl && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <Pressable onPress={handleToggleMusic} hitSlop={4}>
                    <View style={styles.musicIndicator}>
                      <Ionicons
                        name={isMusicPlaying ? "pause-circle" : "musical-note"}
                        size={12}
                        color={isMusicPlaying ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.musicText, isMusicPlaying && styles.musicTextPlaying]} numberOfLines={1}>
                        {post.music.title || "Music"}
                      </Text>
                      {isMusicPlaying && <View style={styles.playingDot} />}
                    </View>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
        <Pressable onPress={() => setShowMenu(true)} hitSlop={10}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {taggedCount > 0 ? (
        <Text style={styles.taggedText}>với {taggedCount} người khác</Text>
      ) : null}

      {post.caption ? (
        <Text style={styles.captionTop}>
          {post.caption.split(/(\s+)/).map((part, index) => {
            if (part.startsWith("#") && part.length > 1) {
              const clean = part.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
              return (
                <Text
                  key={index}
                  style={styles.hashtagText}
                  onPress={() => {
                    router.push({
                      pathname: "/(stack)/hashtag/[hashtag]" as any,
                      params: { hashtag: clean },
                    });
                  }}
                >
                  {part}
                </Text>
              );
            }
            return part;
          })}
        </Text>
      ) : null}

      {mediaItems.length > 0 && currentMedia ? (
        <View style={styles.mediaWrap}>
          <Pressable onPress={() => onOpenPost?.(post.id)}>
            {postApi.isVideoMedia(currentMedia.url, currentMedia.type) ? (
              <Video
                source={{ uri: currentMedia.url }}
                style={styles.image}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                useNativeControls
                isMuted={
                  post.music?.muteOriginal === true ||
                  Boolean(post.music?.audioUrl)
                }
              />
            ) : (
              <Image
                source={{ uri: currentMedia.url }}
                style={styles.image}
                resizeMode="cover"
              />
            )}
          </Pressable>

          {mediaItems.length > 1 ? (
            <>
              <TouchableOpacity
                style={[styles.navBtn, styles.navLeft]}
                onPress={goPrev}
              >
                <Ionicons name="chevron-back" size={22} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navBtn, styles.navRight]}
                onPress={goNext}
              >
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={colors.white}
                />
              </TouchableOpacity>
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                  {currentIndex + 1}/{mediaItems.length}
                </Text>
              </View>
            </>
          ) : null}

          {post.music?.audioUrl ? (
            <Pressable
              onPress={handleToggleMusic}
              hitSlop={8}
              style={styles.musicOverlayButton}
              accessibilityRole="button"
              accessibilityLabel={isMusicPlaying ? "Tắt nhạc" : "Phát nhạc"}
            >
              <Ionicons
                name={isMusicPlaying ? "volume-high" : "volume-mute"}
                size={19}
                color={colors.white}
              />
            </Pressable>
          ) : null}

          {typeof currentMedia.duration === "number" &&
          postApi.isVideoMedia(currentMedia.url, currentMedia.type) ? (
            <View
              style={[
                styles.durationBadge,
                post.music?.audioUrl ? styles.durationBadgeWithMusic : null,
              ]}
            >
              <Text style={styles.durationText}>
                {postApi.formatMediaDuration(currentMedia.duration)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionLeft}>
          {/* Reaction Button - shows emoji if reacted, heart if not */}
          <Pressable
            onPress={() => {
              if (currentReaction) {
                handleReaction(currentReaction);
              } else {
                setShowReactions(true);
              }
            }}
            onLongPress={() => setShowReactions(true)}
            hitSlop={8}
          >
            {currentReaction ? (
              <Text style={styles.reactionDisplayEmoji}>
                {getReactionEmoji(currentReaction)}
              </Text>
            ) : (
              <Ionicons name="heart-outline" size={25} color={colors.text} />
            )}
          </Pressable>
          {post.allowComments !== false ? (
            <Pressable
              onPress={() => onOpenPost?.(post.id)}
              hitSlop={8}
              style={styles.iconGap}
            >
              <Ionicons
                name="chatbubble-outline"
                size={24}
                color={colors.text}
              />
            </Pressable>
          ) : null}
          {post.allowShares !== false ? (
            <Pressable onPress={handleShare} hitSlop={8} style={styles.iconGap}>
              <Ionicons
                name="paper-plane-outline"
                size={24}
                color={colors.text}
              />
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={handleSave} hitSlop={8}>
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={24}
            color={colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.likes}>{compactNumber(likesCount)} lượt thích</Text>
        {commentsCount > 0 ? (
          <Pressable onPress={() => onOpenPost?.(post.id)}>
            <Text style={styles.commentPreview}>
              Xem tất cả {commentsCount} bình luận
            </Text>
          </Pressable>
        ) : null}
        {post.shares ? (
          <Text style={styles.commentPreview}>
            {compactNumber(post.shares)} lượt chia sẻ
          </Text>
        ) : null}
        <Text style={styles.dateText}>
          {new Date(post.createdAt).toLocaleString("vi-VN")}
        </Text>
      </View>

      {post.allowComments !== false && !hideCommentInput ? (
        <View style={styles.commentRow}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Thêm bình luận..."
            placeholderTextColor={colors.textMuted}
            style={styles.commentInput}
          />
          <Pressable
            onPress={submitComment}
            disabled={submittingComment || !comment.trim()}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={comment.trim() ? colors.primary : colors.textMuted}
              />
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal
        transparent
        visible={showReactions}
        animationType="fade"
        onRequestClose={() => setShowReactions(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowReactions(false)}
        >
          <View style={styles.reactionSheet}>
            {REACTIONS.map((reaction) => (
              <Pressable
                key={reaction.type}
                onPress={() => handleReaction(reaction.type)}
                style={styles.reactionBtn}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={showMenu}
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setShowMenu(false)}
        >
          <Pressable style={styles.menuSheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.menuItem} onPress={copyLink}>
              <Ionicons name="link-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Sao chép liên kết</Text>
            </TouchableOpacity>
            {isOwnPost ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    setShowEditModal(true);
                  }}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.menuText}>Chỉnh sửa bài viết</Text>
                </TouchableOpacity>
                <Text style={styles.menuSectionTitle}>Quyền riêng tư</Text>
                {(
                  ["PUBLIC", "FRIENDS", "ONLY_ME"] as postApi.PrivacyType[]
                ).map((privacy) => (
                  <TouchableOpacity
                    key={privacy}
                    style={styles.menuItem}
                    onPress={() => changePrivacy(privacy)}
                    disabled={menuBusy}
                  >
                    <Ionicons
                      name={
                        post.privacy === privacy
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.menuText}>
                      {privacyLabels[privacy]}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={deletePost}
                  disabled={menuBusy}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.danger}
                  />
                  <Text style={[styles.menuText, styles.dangerText]}>
                    Xóa bài viết
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Post Modal */}
      {isOwnPost && currentUserId ? (
        <EditPostModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          post={post}
          currentUserId={currentUserId}
          onUpdated={onPostUpdated}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  userMeta: { marginLeft: spacing.sm, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 1,
  },
  username: { ...typography.title, color: colors.text },
  dot: { color: colors.textMuted, marginHorizontal: 5 },
  privacy: { color: colors.textMuted, ...typography.caption },
  time: { color: colors.textMuted, ...typography.caption },
  locationText: {
    color: colors.textMuted,
    ...typography.caption,
    maxWidth: 140,
  },
  taggedText: {
    color: colors.textMuted,
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  captionTop: {
    ...typography.body,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    lineHeight: 20,
  },
  hashtagText: { color: colors.primary, fontWeight: "600" },
  mediaWrap: {
    width: "100%",
    backgroundColor: colors.black,
    position: "relative",
  },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface },
  navBtn: {
    position: "absolute",
    top: "45%",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  navLeft: { left: spacing.sm },
  navRight: { right: spacing.sm },
  counterBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  durationBadge: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  durationBadgeWithMusic: {
    right: undefined,
    left: spacing.sm,
  },
  durationText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  musicOverlayButton: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
  },
  musicIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  musicText: {
    color: colors.textMuted,
    fontSize: 11,
    maxWidth: 120,
  },
  musicTextPlaying: {
    color: colors.primary,
    fontWeight: "600",
  },
  playingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  actionLeft: { flexDirection: "row", alignItems: "center" },
  iconGap: { marginLeft: spacing.md },
  reactionDisplayEmoji: { fontSize: 24 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  likes: { color: colors.text, ...typography.title, marginBottom: spacing.xs },
  commentPreview: {
    color: colors.textMuted,
    ...typography.body,
    marginBottom: spacing.xs,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  commentInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  postCommentText: { color: colors.primary, ...typography.title },
  disabledText: { color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionSheet: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  reactionBtn: { paddingHorizontal: 6 },
  reactionEmoji: { fontSize: 28 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md,
  },
  menuText: { ...typography.body, color: colors.text, fontWeight: "600" },
  menuSectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  dangerText: { color: colors.danger },
});