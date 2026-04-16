import { colors, spacing } from "@/constants";
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
} from "react-native";

type Props = TextInputProps & {
    label?: string;
    error?: string;
};

export default function CustomInput({ label, error, style, ...props }: Props) {
    return (
        <View style={styles.wrapper}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <TextInput
                {...props}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, style]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing.md,
    },
    label: {
        color: colors.text,
        marginBottom: spacing.xs,
        fontSize: 14,
        fontWeight: "500",
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        color: colors.text,
        fontSize: 15,
        backgroundColor: colors.white,
    },
    error: {
        marginTop: spacing.xs,
        color: colors.danger,
        fontSize: 12,
    },
});
