import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { commentService, Comment } from "@/services/commentService";
import { fetchUserById } from "@/services/postService";
import UserAvatar from "../UserAvatar";
import { User } from "@/types";
import useRealtimeComments from "@/hooks/useRealtimeComments";
import useRealtimeReactions from "@/hooks/useRealtimeReactions";
import useCommentsNormalized from "@/hooks/useCommentsNormalized";
import { useRouter } from "expo-router";

// Extended Comment type
interface LocalComment extends Comment {}

// Reaction types matching web
const REACTION_TYPES = [
  { type: "LIKE", emoji: "👍", label: "Thích" },
  { type: "LOVE", emoji: "❤️", label: "Yêu thích" },
  { type: "HAHA", emoji: "😆", label: "Haha" },
  { type: "WOW", emoji: "😮", label: "Wow" },
  { type: "SAD", emoji: "😢", label: "Buồn" },
  { type: "ANGRY", emoji: "😡", label: "Giận" },
];

interface CommentsSectionProps {
  postId: string;
  postAuthorId: string;
  onCommentCountChange?: (count: number) => void;
  HeaderComponent?: React.ReactElement;
}

export default function CommentsSection({
  postId,
  postAuthorId,
  onCommentCountChange,
  HeaderComponent,
}: CommentsSectionProps) {
  const { currentUser, getUserById, upsertUsers } = useAppContext();
  const inputRef = useRef<TextInput>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  // Track user reactions for all comments - initialized EMPTY
  const [userReactionsMap, setUserReactionsMap] = useState<
    Record<string, string>
  >({});

  // ============ NORMALIZED COMMENT STATE ============
  const {
    commentsById,
    rootIds,
    expandedMap,
    loadingMap,
    hasMoreReplies,
    currentPage,
    rootHasMore,
    totalCount,
    loading,
    loadRootComments,
    loadMoreReplies,
    toggleExpanded,
    createReply,
    deleteComment,
    getDirectChildren,
    resetComments,
    handleCommentReactionUpdate,
  } = useCommentsNormalized({
    targetType: "POST",
    targetId: postId,
  });

  // Load initial comments
  const onCommentCountChangeRef = useRef(onCommentCountChange);
  useEffect(() => {
    onCommentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  useEffect(() => {
    const loadInitialComments = async () => {
      try {
        await loadRootComments(0);
        setCommentsLoaded(true);
      } catch (error) {
        console.error("❌ Error loading initial comments:", error);
      }
    };
    void loadInitialComments();
  }, [postId, loadRootComments]);

  // Notify parent of comment count changes
  useEffect(() => {
    if (totalCount >= 0) {
      onCommentCountChangeRef.current?.(totalCount);
    }
  }, [totalCount]);

  // ============ REALTIME COMMENTS ============
  useRealtimeComments({
    postId,
    commentsById,
    createReply,
    deleteComment,
    viewerId: currentUser?.id?.toString() || "",
    onCommentReceived: (newComment) => {
      if (!newComment.parentId) {
        onCommentCountChangeRef.current?.(totalCount + 1);
      }
    },
  });

  // ============ REALTIME REACTIONS ============
  useRealtimeReactions({
    postId,
    onReactionUpdate: (event) => {
      if (event.userId === currentUser?.id?.toString()) return;
      if (event.targetType !== "COMMENT") return;
      handleCommentReactionUpdate(event.targetId, event.action);
    },
  });

  // ============ REACTION HANDLING ============
  const handleToggleReaction = useCallback(
    async (comment: LocalComment, reactionType: string) => {
      if (!currentUser) return;
      const commentId = comment.id;
      const currentReaction = userReactionsMap[commentId];

      // If already has THIS reaction type, UN-react (toggle OFF)
      if (currentReaction === reactionType) {
        console.log(
          `🗑️ Removing reaction ${reactionType} from comment ${commentId}`
        );
        // Optimistic update - remove from map
        setUserReactionsMap((prev) => {
          const next = { ...prev };
          delete next[commentId];
          return next;
        });

        try {
          const result = await commentService.toggleCommentReaction(
            currentUser.id,
            commentId,
            reactionType
          );
          console.log(`✅ API returned:`, result);
          // If result is null or empty, reaction was removed - map already updated
        } catch (error: any) {
          console.error(`❌ Failed to remove reaction:`, error);
          // Revert on error
          setUserReactionsMap((prev) => ({
            ...prev,
            [commentId]: reactionType,
          }));
          Alert.alert("Lỗi", "Không thể xóa reaction");
        }
      } else {
        // Either no reaction or different type - SET new reaction
        console.log(
          `❤️ Setting reaction ${reactionType} on comment ${commentId} (was: ${
            currentReaction || "none"
          })`
        );
        const previousReaction = currentReaction;

        // Optimistic update
        setUserReactionsMap((prev) => ({
          ...prev,
          [commentId]: reactionType,
        }));

        try {
          const result = await commentService.toggleCommentReaction(
            currentUser.id,
            commentId,
            reactionType
          );
          console.log(`✅ API returned:`, result);
        } catch (error: any) {
          console.error(`❌ Failed to add reaction:`, error);
          // Revert on error
          if (previousReaction) {
            setUserReactionsMap((prev) => ({
              ...prev,
              [commentId]: previousReaction,
            }));
          } else {
            setUserReactionsMap((prev) => {
              const next = { ...prev };
              delete next[commentId];
              return next;
            });
          }
          Alert.alert("Lỗi", "Không thể thêm reaction");
        }
      }
    },
    [currentUser, userReactionsMap]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetComments();
    };
  }, [postId, resetComments]);

  // ============ COMMENT SUBMISSION ============
  const handleSubmit = async () => {
    const text = inputText.trim();
    if (!text || submitting || !currentUser) return;

    setSubmitting(true);
    try {
      const parentId = replyingTo?.id || null;
      const newComment = await commentService.createComment(
        "POST",
        postId,
        text,
        currentUser.id,
        parentId
      );

      createReply(parentId, newComment);
      setInputText("");
      setReplyingTo(null);
      onCommentCountChangeRef.current?.(totalCount + 1);
    } catch (error) {
      console.error("Failed to submit comment:", error);
      Alert.alert("Lỗi", "Không thể gửi bình luận.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyPress = (comment: Comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  const handleDelete = async (commentId: string, parentId?: string | null) => {
    Alert.alert("Xóa bình luận", "Bạn có chắc muốn xóa bình luận này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          if (!currentUser) return;
          try {
            await commentService.deleteComment(commentId, currentUser.id);
            deleteComment(commentId, parentId as string | undefined);
          } catch (error) {
            console.error("Failed to delete comment:", error);
            Alert.alert("Lỗi", "Không thể xóa bình luận.");
          }
        },
      },
    ]);
  };

  // For root comment submission
  const handleSubmitRootComment = async () => {
    const text = inputText.trim();
    if (!text || submitting || !currentUser) return;

    setSubmitting(true);
    try {
      const newComment = await commentService.createComment(
        "POST",
        postId,
        text,
        currentUser.id,
        null // root comment
      );

      createReply(null, newComment);
      setInputText("");
      onCommentCountChangeRef.current?.(totalCount + 1);
    } catch (error) {
      console.error("Failed to submit comment:", error);
      Alert.alert("Lỗi", "Không thể gửi bình luận.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !commentsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const renderCommentItem = ({ item: commentId }: { item: string }) => {
    const comment = commentsById[commentId] as LocalComment | undefined;
    if (!comment) return null;

    return (
      <NormalizedCommentItem
        comment={comment}
        commentId={commentId}
        commentsById={commentsById}
        rootIds={rootIds}
        expandedMap={expandedMap}
        loadingMap={loadingMap}
        hasMoreReplies={hasMoreReplies}
        currentUserId={currentUser?.id?.toString()}
        postAuthorId={postAuthorId}
        onReply={handleReplyPress}
        onDelete={handleDelete}
        onToggleExpanded={toggleExpanded}
        onLoadMoreReplies={loadMoreReplies}
        onToggleReaction={handleToggleReaction}
        getDirectChildren={getDirectChildren}
        userReactionsMap={userReactionsMap}
        setUserReactionsMap={setUserReactionsMap}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <FlatList
        data={rootIds}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={HeaderComponent}
        renderItem={renderCommentItem}
        onEndReached={() => {
          if (rootHasMore && !loading) {
            void loadRootComments(currentPage + 1);
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator
              style={styles.footerLoader}
              color={colors.primary}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>
              Chưa có bình luận nào. Hãy là người đầu tiên!
            </Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        {replyingTo && (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText}>
              Đang trả lời{" "}
              <Text style={{ fontWeight: "700" }}>@{replyingTo.userId}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <UserAvatar
            size={36}
            uri={currentUser?.avatarUrl}
            name={currentUser?.username || "Me"}
          />
          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              replyingTo ? "Phản hồi bình luận..." : "Thêm bình luận..."
            }
            placeholderTextColor={colors.textMuted}
            style={styles.textInput}
            multiline
          />
          <TouchableOpacity
            onPress={replyingTo ? handleSubmit : handleSubmitRootComment}
            disabled={submitting || !inputText.trim()}
            style={styles.postBtn}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? colors.primary : colors.textMuted}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============ NORMALIZED COMMENT ITEM ============
interface NormalizedCommentItemProps {
  comment: LocalComment;
  commentId: string;
  commentsById: Record<string, Comment>;
  rootIds: string[];
  expandedMap: Record<string, boolean>;
  loadingMap: Record<string, boolean>;
  hasMoreReplies: Record<string, boolean>;
  currentUserId?: string;
  postAuthorId: string;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: string, parentId?: string | null) => void;
  onToggleExpanded: (commentId: string) => void;
  onLoadMoreReplies: (commentId: string) => void;
  onToggleReaction: (comment: LocalComment, reactionType: string) => void;
  getDirectChildren: (commentId: string | null) => Comment[];
  userReactionsMap: Record<string, string>;
  setUserReactionsMap: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  level?: number;
}

function NormalizedCommentItem({
  comment,
  commentId,
  commentsById,
  rootIds,
  expandedMap,
  loadingMap,
  hasMoreReplies,
  currentUserId,
  postAuthorId,
  onReply,
  onDelete,
  onToggleExpanded,
  onLoadMoreReplies,
  onToggleReaction,
  getDirectChildren,
  userReactionsMap,
  setUserReactionsMap,
  level = 0,
}: NormalizedCommentItemProps) {
  const router = useRouter();
  const { getUserById, upsertUsers } = useAppContext();
  const cachedUser = getUserById(comment.userId);
  const [author, setAuthor] = useState<User | null>(cachedUser || null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Navigate to user profile
  const navigateToProfile = (userId?: string) => {
    if (!userId) return;
    router.push({
      pathname: "/(tabs)/user-profile" as any,
      params: { userId: String(userId) },
    });
  };

  // Track if we've fetched user reaction for THIS comment
  const [hasFetchedReaction, setHasFetchedReaction] = useState(false);

  // Load user details if not cached
  useEffect(() => {
    if (cachedUser) {
      setAuthor(cachedUser);
      return;
    }
    let active = true;
    const loadUser = async () => {
      try {
        const u = await fetchUserById(comment.userId);
        if (u && active) {
          upsertUsers([u]);
          setAuthor(u);
        }
      } catch (err) {
        // Ignore missing users
      }
    };
    void loadUser();
    return () => {
      active = false;
    };
  }, [comment.userId, cachedUser, upsertUsers]);

  // Fetch user's reaction ONCE when comment mounts
  useEffect(() => {
    if (!currentUserId || hasFetchedReaction) return;

    let active = true;
    const fetchUserReaction = async () => {
      try {
        const reaction = await commentService.fetchUserCommentReaction(
          currentUserId,
          comment.id
        );
        if (active) {
          if (reaction?.type) {
            setUserReactionsMap((prev) => ({
              ...prev,
              [comment.id]: reaction.type,
            }));
          }
          setHasFetchedReaction(true);
        }
      } catch {
        if (active) {
          setHasFetchedReaction(true);
        }
      }
    };
    void fetchUserReaction();
    return () => {
      active = false;
    };
  }, [currentUserId, comment.id, hasFetchedReaction, setUserReactionsMap]);

  const isOwnComment = currentUserId === comment.userId;
  const isPostOwner = currentUserId === postAuthorId;
  const canDelete = isOwnComment || isPostOwner;
  const isExpanded = expandedMap[commentId] || false;
  const isLoadingReplies = loadingMap[commentId] || false;
  const showMoreReplies = hasMoreReplies[commentId] || false;
  const directChildren = getDirectChildren(commentId);

  // Get reply count info
  const replyCount = comment.replyCount || 0;
  const hasReplies = directChildren.length > 0 || replyCount > 0;

  // Get display reaction from parent map only (NOT local state)
  const displayReaction = userReactionsMap[commentId];

  const getReactionEmoji = (type?: string) => {
    if (!type) return null;
    const reaction = REACTION_TYPES.find((r) => r.type === type);
    return reaction?.emoji || null;
  };

  return (
    <View style={styles.itemContainer}>
      <View style={styles.commentRow}>
        <Pressable onPress={() => navigateToProfile(comment.userId)}>
          <UserAvatar
            size={level > 0 ? 28 : 36}
            uri={author?.avatarUrl}
            name={author?.username || "User"}
          />
        </Pressable>
        <View style={styles.commentContentWrap}>
          <Pressable onPress={() => navigateToProfile(comment.userId)}>
            <Text
              style={[styles.usernameText, level > 0 && styles.nestedUsername]}
            >
              {author?.username || `user_${comment.userId}`}
            </Text>
          </Pressable>
          <Text
            style={[styles.commentContent, level > 0 && styles.nestedContent]}
          >
            {comment.content}
          </Text>

          <View style={styles.actionsRow}>
            <Text style={styles.timeText}>
              {new Date(comment.createdAt).toLocaleDateString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            {comment.reactCount > 0 && (
              <View style={styles.reactionCount}>
                {displayReaction && (
                  <Text style={styles.reactionEmoji}>
                    {getReactionEmoji(displayReaction)}
                  </Text>
                )}
                <Text style={styles.likesCountText}>{comment.reactCount}</Text>
              </View>
            )}

            {/* Reply button - ALL comments */}
            <TouchableOpacity
              onPress={() => onReply(comment)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Trả lời</Text>
            </TouchableOpacity>

            {canDelete && (
              <TouchableOpacity
                onPress={() => onDelete(comment.id, comment.parentId)}
              >
                <Text style={[styles.actionBtnText, { color: colors.danger }]}>
                  Xóa
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Replies Section - Only show when expanded */}
          {isExpanded && directChildren.length > 0 && (
            <View style={styles.repliesList}>
              {directChildren.map((reply) => (
                <View key={reply.id} style={styles.nestedReplyContainer}>
                  <NormalizedCommentItem
                    comment={reply as LocalComment}
                    commentId={reply.id}
                    commentsById={commentsById}
                    rootIds={rootIds}
                    expandedMap={expandedMap}
                    loadingMap={loadingMap}
                    hasMoreReplies={hasMoreReplies}
                    currentUserId={currentUserId}
                    postAuthorId={postAuthorId}
                    onReply={onReply}
                    onDelete={onDelete}
                    onToggleExpanded={onToggleExpanded}
                    onLoadMoreReplies={onLoadMoreReplies}
                    onToggleReaction={onToggleReaction}
                    getDirectChildren={getDirectChildren}
                    userReactionsMap={userReactionsMap}
                    setUserReactionsMap={setUserReactionsMap}
                    level={level + 1}
                  />
                </View>
              ))}

              {/* Load more replies button */}
              {showMoreReplies && (
                <TouchableOpacity
                  onPress={() => onLoadMoreReplies(commentId)}
                  style={styles.moreRepliesBtn}
                  disabled={isLoadingReplies}
                >
                  {isLoadingReplies ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.moreRepliesText}>
                      Xem thêm phản hồi...
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Toggle Button - Always show when has replies */}
          {hasReplies && (
            <TouchableOpacity
              onPress={() => {
                if (
                  !isExpanded &&
                  directChildren.length === 0 &&
                  replyCount > 0
                ) {
                  onLoadMoreReplies(commentId);
                }
                onToggleExpanded(commentId);
              }}
              style={styles.toggleRepliesBtn}
            >
              <Text style={styles.toggleRepliesText}>
                {isExpanded ? "Ẩn phản hồi" : `Xem ${replyCount} phản hồi`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reaction Button */}
        <TouchableOpacity
          onPress={() => {
            // If already has reaction, tap to REMOVE (toggle OFF)
            if (displayReaction) {
              onToggleReaction(comment, displayReaction);
            } else {
              // No reaction yet, show picker
              setShowReactionPicker(true);
            }
          }}
          onLongPress={() => setShowReactionPicker(true)}
          style={styles.reactionBtn}
        >
          {displayReaction ? (
            <Text style={styles.reactionDisplayEmoji}>
              {getReactionEmoji(displayReaction)}
            </Text>
          ) : (
            <Ionicons name="heart-outline" size={18} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Reaction Picker Modal */}
      <Modal
        transparent
        visible={showReactionPicker}
        animationType="fade"
        onRequestClose={() => setShowReactionPicker(false)}
      >
        <Pressable
          style={styles.reactionModalBackdrop}
          onPress={() => setShowReactionPicker(false)}
        >
          <View style={styles.reactionPickerSheet}>
            {REACTION_TYPES.map((reaction) => (
              <TouchableOpacity
                key={reaction.type}
                onPress={() => {
                  onToggleReaction(comment, reaction.type);
                  setShowReactionPicker(false);
                }}
                style={[
                  styles.reactionOption,
                  displayReaction === reaction.type &&
                    styles.reactionOptionActive,
                ]}
              >
                <Text style={styles.reactionOptionEmoji}>{reaction.emoji}</Text>
                <Text style={styles.reactionOptionLabel}>{reaction.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.title,
    fontWeight: "700",
    color: colors.text,
  },
  headerCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  center: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  commentContentWrap: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  usernameText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  nestedUsername: {
    fontSize: 13,
  },
  commentContent: {
    ...typography.body,
    color: colors.text,
    lineHeight: 18,
  },
  nestedContent: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  reactionCount: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  reactionEmoji: {
    fontSize: 12,
    marginRight: 2,
  },
  likesCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.md,
    paddingVertical: 2,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginLeft: 4,
  },
  reactionBtn: {
    padding: spacing.xs,
  },
  reactionDisplayEmoji: {
    fontSize: 16,
  },
  repliesList: {
    marginTop: spacing.xs,
  },
  nestedReplyContainer: {
    marginLeft: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    marginTop: spacing.xs,
  },
  toggleRepliesBtn: {
    paddingVertical: spacing.xs,
  },
  toggleRepliesText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  moreRepliesBtn: {
    paddingVertical: spacing.xs,
    marginLeft: spacing.lg,
  },
  moreRepliesText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: spacing.md,
  },
  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  replyingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  postBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  // Reaction Picker Styles
  reactionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionPickerSheet: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  reactionOption: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  reactionOptionActive: {
    backgroundColor: colors.surface,
  },
  reactionOptionEmoji: {
    fontSize: 28,
  },
  reactionOptionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
});
