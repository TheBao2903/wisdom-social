import { colors, spacing } from "@/constants";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

type TabKey = "posts" | "saved";

type Props = {
    value: TabKey;
    onChange: (value: TabKey) => void;
};

export default function ProfileTabSwitcher({ value, onChange }: Props) {
    return (
        <View style={styles.container}>
            <TabButton
                active={value === "posts"}
                icon="grid"
                onPress={() => onChange("posts")}
            />
            <TabButton
                active={value === "saved"}
                icon="bookmark"
                onPress={() => onChange("saved")}
            />
        </View>
    );
}

function TabButton({
    active,
    icon,
    onPress,
}: {
    active: boolean;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[styles.tab, active && styles.tabActive]}
        >
            <Ionicons
                name={icon as any}
                size={24}
                color={active ? colors.text : colors.textMuted}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.white,
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: "transparent",
    },
    tabActive: {
        borderBottomColor: colors.text,
    },
});
