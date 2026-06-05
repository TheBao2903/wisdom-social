import { colors } from "@/constants";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type Props = {
    uri?: string;
    name: string;
    size?: number;
    online?: boolean;
    // Tài khoản bị khóa: hiển thị avatar trắng/mặc định (icon người xám),
    // không dùng avatar thật, không hiện chữ cái đầu.
    locked?: boolean;
};

export default function UserAvatar({ uri, name, size = 40, online = false, locked = false }: Props) {
    const [failed, setFailed] = useState(false);
    const normalizedUri = uri?.trim();

    useEffect(() => {
        setFailed(false);
    }, [normalizedUri]);

    const avatarContent = locked ? (
        <View
            style={[
                styles.lockedFallback,
                { width: size, height: size, borderRadius: size / 2 },
            ]}
        >
            <Ionicons name="person" size={size * 0.6} color="#9CA3AF" />
        </View>
    ) : !normalizedUri || failed ? (
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
        ) : (
            <Image
                source={{ uri: normalizedUri }}
                onError={() => setFailed(true)}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: colors.surface,
                }}
            />
        );

    return (
        <View style={{ width: size, height: size }}>
            {avatarContent}
            {online ? <View style={styles.onlineDot} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    fallback: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    lockedFallback: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    fallbackText: {
        color: colors.white,
        fontWeight: "700",
    },
    onlineDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: colors.white,
        backgroundColor: "#22C55E",
    },
});
