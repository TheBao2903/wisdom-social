import { colors, spacing } from "@/constants";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    ViewStyle,
} from "react-native";

type Props = {
    title: string;
    onPress: () => void;
    variant?: "primary" | "outline" | "ghost";
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
};

export default function CustomButton({
    title,
    onPress,
    variant = "primary",
    disabled,
    loading,
    style,
}: Props) {
    const variantStyle =
        variant === "primary"
            ? styles.primary
            : variant === "outline"
              ? styles.outline
              : styles.ghost;

    const textStyle =
        variant === "primary" ? styles.primaryText : styles.secondaryText;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                variantStyle,
                style,
                (disabled || loading) && styles.disabled,
                pressed && !(disabled || loading) && styles.pressed,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={
                        variant === "primary" ? colors.white : colors.primary
                    }
                />
            ) : (
                <Text style={[styles.textBase, textStyle]}>{title}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    primary: {
        backgroundColor: colors.primary,
    },
    outline: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
    },
    ghost: {
        backgroundColor: "transparent",
    },
    textBase: {
        fontSize: 15,
        fontWeight: "600",
    },
    primaryText: {
        color: colors.white,
    },
    secondaryText: {
        color: colors.text,
    },
    pressed: {
        opacity: 0.82,
    },
    disabled: {
        opacity: 0.6,
    },
});
