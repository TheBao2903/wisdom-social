import { colors, spacing, typography } from "@/constants";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

type Props = {
    name: string;
    avatar: string;
    viewed?: boolean;
    onPress: () => void;
};

export default function StoryBubble({ name, avatar, viewed, onPress }: Props) {
    return (
        <Pressable style={styles.container} onPress={onPress}>
            {viewed ? (
                <View style={[styles.ring, styles.viewedRing]}>
                    <View style={styles.ringInner}>
                        <UserAvatar uri={avatar} name={name} size={58} />
                    </View>
                </View>
            ) : (
                <LinearGradient
                    colors={[
                        colors.storyGradientStart,
                        colors.storyGradientMid,
                        colors.storyGradientEnd,
                    ]}
                    style={styles.ring}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.ringInner}>
                        <UserAvatar uri={avatar} name={name} size={58} />
                    </View>
                </LinearGradient>
            )}
            <Text numberOfLines={1} style={styles.name}>
                {name}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 82,
        alignItems: "center",
        marginRight: spacing.sm,
    },
    ring: {
        borderRadius: 999,
        padding: 2,
    },
    ringInner: {
        padding: 2,
        borderRadius: 999,
        backgroundColor: colors.white,
    },
    viewedRing: {
        borderWidth: 2,
        borderColor: "#D1D5DB",
    },
    name: {
        marginTop: spacing.xs,
        ...typography.caption,
        color: colors.text,
        maxWidth: 76,
        textAlign: "center",
    },
});
