import { colors } from "@/constants";
import { Image, StyleSheet, Text, View } from "react-native";

type Props = {
    uri?: string;
    name: string;
    size?: number;
};

export default function UserAvatar({ uri, name, size = 40 }: Props) {
    if (!uri) {
        return (
            <View
                style={[
                    styles.fallback,
                    { width: size, height: size, borderRadius: size / 2 },
                ]}
            >
                <Text style={styles.fallbackText}>
                    {name.charAt(0).toUpperCase()}
                </Text>
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.surface,
            }}
        />
    );
}

const styles = StyleSheet.create({
    fallback: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    fallbackText: {
        color: colors.white,
        fontWeight: "700",
    },
});
