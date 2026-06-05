import { colors } from "@/constants";
import { Post } from "@/types";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isVideoMedia } from "@/services/postService";
import { compactNumber } from "@/utils/format";
import { useState } from "react";

type Props = {
    posts: Post[];
    onPressPost?: (post: Post) => void;
};

export default function PostGrid({ posts, onPressPost }: Props) {
    return (
        <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            numColumns={3}
            renderItem={({ item }) => <GridItem post={item} onPress={() => onPressPost?.(item)} />}
            scrollEnabled={false}
        />
    );
}

function GridItem({ post, onPress }: { post: Post; onPress: () => void }) {
    const [showOverlay, setShowOverlay] = useState(false);
    const firstMedia = post.media?.[0];
    const thumbnail = firstMedia?.url || post.images?.[0] || post.image;
    const video = isVideoMedia(thumbnail, firstMedia?.type);

    return (
        <Pressable
            style={styles.item}
            onPress={onPress}
            onLongPress={() => setShowOverlay(true)}
            onPressOut={() => setShowOverlay(false)}
        >
            {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.image} /> : (
                <View style={[styles.image, styles.textFallback]}>
                    <Text style={styles.textFallbackContent} numberOfLines={3}>{post.caption || ""}</Text>
                </View>
            )}
            {video ? (
                <View style={styles.badge}>
                    <Ionicons name="play" size={14} color={colors.white} />
                </View>
            ) : null}
            {(post.media?.length || post.images?.length || 0) > 1 ? (
                <View style={styles.stackBadge}>
                    <Ionicons name="albums-outline" size={15} color={colors.white} />
                </View>
            ) : null}
            {showOverlay ? (
                <View style={styles.overlay}>
                    <View style={styles.overlayStat}>
                        <Ionicons name="heart" size={16} color={colors.white} />
                        <Text style={styles.overlayText}>{compactNumber(post.likes || 0)}</Text>
                    </View>
                    <View style={styles.overlayStat}>
                        <Ionicons name="chatbubble" size={14} color={colors.white} />
                        <Text style={styles.overlayText}>{compactNumber(post.commentsCount || post.comments?.length || 0)}</Text>
                    </View>
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    item: { flex: 1 / 3, aspectRatio: 1, padding: 1, position: "relative" },
    image: { flex: 1, backgroundColor: colors.surface },
    textFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E5E5EA", padding: 6 },
    textFallbackContent: { fontSize: 10, color: "#666", textAlign: "center" },
    badge: { position: "absolute", left: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
    stackBadge: { position: "absolute", right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
    overlayStat: { flexDirection: "row", alignItems: "center", gap: 4 },
    overlayText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});
