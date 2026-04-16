import { colors, spacing, typography } from "@/constants";
import { Post, User } from "@/types";
import { compactNumber, formatRelativeTime } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
    post: Post;
    author?: User;
    liked: boolean;
    saved: boolean;
    onLike: () => void;
    onSave: () => void;
    onAddComment: (content: string) => void;
};

export default function PostCard({
    post,
    author,
    liked,
    saved,
    onLike,
    onSave,
    onAddComment,
}: Props) {
    const [comment, setComment] = useState("");

    const submitComment = () => {
        if (!comment.trim()) return;
        onAddComment(comment);
        setComment("");
    };

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.userRow}>
                    <UserAvatar
                        uri={author?.avatar}
                        name={author?.username ?? "user"}
                        size={34}
                    />
                    <View style={styles.userMeta}>
                        <Text style={styles.username}>
                            {author?.username ?? "Unknown"}
                        </Text>
                        <Text style={styles.time}>
                            {formatRelativeTime(post.createdAt)}
                        </Text>
                    </View>
                </View>
                <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={colors.textMuted}
                />
            </View>

            <Image
                source={{ uri: post.image }}
                style={styles.image}
                resizeMode="cover"
            />

            <View style={styles.actions}>
                <View style={styles.actionLeft}>
                    <Pressable onPress={onLike} hitSlop={8}>
                        <Ionicons
                            name={liked ? "heart" : "heart-outline"}
                            size={24}
                            color={liked ? colors.danger : colors.text}
                        />
                    </Pressable>
                    <Ionicons
                        name="chatbubble-outline"
                        size={23}
                        color={colors.text}
                        style={styles.iconGap}
                    />
                    <Ionicons
                        name="paper-plane-outline"
                        size={23}
                        color={colors.text}
                        style={styles.iconGap}
                    />
                </View>

                <Pressable onPress={onSave} hitSlop={8}>
                    <Ionicons
                        name={saved ? "bookmark" : "bookmark-outline"}
                        size={23}
                        color={colors.text}
                    />
                </Pressable>
            </View>

            <View style={styles.body}>
                <Text style={styles.likes}>
                    {compactNumber(post.likes)} likes
                </Text>
                <Text style={styles.caption}>
                    <Text style={styles.username}>
                        {author?.username ?? "unknown"}
                    </Text>{" "}
                    {post.caption}
                </Text>
                {post.comments.length > 0 ? (
                    <Text style={styles.commentPreview}>
                        View all {post.comments.length} comments
                    </Text>
                ) : null}
            </View>

            <View style={styles.commentRow}>
                <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.commentInput}
                />
                <Pressable onPress={submitComment}>
                    <Text style={styles.postCommentText}>Post</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        marginBottom: spacing.lg,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    userRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    userMeta: {
        marginLeft: spacing.sm,
    },
    username: {
        ...typography.title,
        color: colors.text,
    },
    time: {
        color: colors.textMuted,
        ...typography.caption,
    },
    image: {
        width: "100%",
        aspectRatio: 1,
        backgroundColor: colors.surface,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    actionLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconGap: {
        marginLeft: spacing.md,
    },
    body: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
    },
    likes: {
        color: colors.text,
        ...typography.title,
        marginBottom: spacing.xs,
    },
    caption: {
        ...typography.body,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    commentPreview: {
        color: colors.textMuted,
        ...typography.body,
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
    postCommentText: {
        color: colors.primary,
        ...typography.title,
    },
});
