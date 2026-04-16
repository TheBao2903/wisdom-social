import { colors, spacing } from "@/constants";
import { StyleSheet, Text, View } from "react-native";

type Props = {
    title: string;
    description?: string;
};

export default function EmptyState({ title, description }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            {description ? (
                <Text style={styles.description}>{description}</Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: spacing.xl,
        alignItems: "center",
        paddingHorizontal: spacing.xxl,
    },
    title: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
    },
    description: {
        marginTop: spacing.sm,
        textAlign: "center",
        color: colors.textMuted,
    },
});
