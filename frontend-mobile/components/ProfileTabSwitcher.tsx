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
                icon="grid-outline"
                onPress={() => onChange("posts")}
            />
            <TabButton
                active={value === "saved"}
                icon="bookmark-outline"
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
                name={icon}
                size={22}
                color={active ? colors.text : colors.textMuted}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.white,
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: colors.text,
    },
});
