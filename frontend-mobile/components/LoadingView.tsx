import { colors } from "@/constants";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = {
    text?: string;
};

export default function LoadingView({ text = "Loading..." }: Props) {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.text}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
    },
    text: {
        color: colors.textMuted,
    },
});
