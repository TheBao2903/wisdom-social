import { colors, spacing } from "@/constants";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View } from "react-native";

type Props = {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
};

export default function SearchBar({
    value,
    onChangeText,
    placeholder = "Search",
}: Props) {
    return (
        <View style={styles.container}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 38,
        borderRadius: 10,
        backgroundColor: "#EFEFEF",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
    },
    input: {
        marginLeft: spacing.sm,
        flex: 1,
        color: colors.text,
        fontSize: 15,
    },
});
