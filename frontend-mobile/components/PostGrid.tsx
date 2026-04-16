import { colors } from "@/constants";
import { Post } from "@/types";
import { FlatList, Image, Pressable, StyleSheet } from "react-native";

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
            renderItem={({ item }) => (
                <Pressable
                    style={styles.item}
                    onPress={() => onPressPost?.(item)}
                >
                    <Image source={{ uri: item.image }} style={styles.image} />
                </Pressable>
            )}
            scrollEnabled={false}
        />
    );
}

const styles = StyleSheet.create({
    item: {
        flex: 1 / 3,
        aspectRatio: 1,
        padding: 1,
    },
    image: {
        flex: 1,
        backgroundColor: colors.surface,
    },
});
