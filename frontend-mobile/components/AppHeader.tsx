import { colors, spacing, typography } from "@/constants";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Action = {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
};

type Props = {
    title: string;
    leftAction?: Action;
    rightActions?: Action[];
};

export default function AppHeader({
    title,
    leftAction,
    rightActions = [],
}: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.side}>
                {leftAction ? (
                    <Pressable
                        onPress={leftAction.onPress}
                        hitSlop={8}
                        style={styles.iconPressable}
                    >
                        <Ionicons
                            name={leftAction.icon}
                            size={22}
                            color={colors.text}
                        />
                    </Pressable>
                ) : null}
            </View>

            <Text numberOfLines={1} style={styles.title}>
                {title}
            </Text>

            <View style={[styles.side, styles.right]}>
                {rightActions.map((action) => (
                    <Pressable
                        key={action.icon}
                        onPress={action.onPress}
                        hitSlop={8}
                        style={styles.actionButton}
                    >
                        <Ionicons
                            name={action.icon}
                            size={22}
                            color={colors.text}
                        />
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.white,
    },
    side: {
        minWidth: 68,
    },
    title: {
        flex: 1,
        textAlign: "center",
        ...typography.headerTitle,
        color: colors.text,
    },
    right: {
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    iconPressable: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 17,
    },
    actionButton: {
        marginLeft: spacing.xs,
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 17,
    },
});
