import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants";
import { contextActions, ContextMenuState, MENU_WIDTH } from "@/utils/messageUtils";

type Props = {
    contextMenu: ContextMenuState | null;
    closeContextMenu: () => void;
    handleContextAction: (actionKey: string) => void;
    selectedMessagePinned: boolean;
};

export function MessageContextMenu({
    contextMenu,
    closeContextMenu,
    handleContextAction,
    selectedMessagePinned,
}: Props) {
    return (
        <Modal
            visible={Boolean(contextMenu)}
            transparent
            animationType="fade"
            onRequestClose={closeContextMenu}
        >
            <Pressable style={styles.menuOverlay} onPress={closeContextMenu}>
                {contextMenu ? (
                    <View
                        style={[
                            styles.contextMenuCard,
                            {
                                top: contextMenu.top,
                                left: contextMenu.left,
                            },
                        ]}
                    >
                        {contextActions.map((action) => {
                            if ("divider" in action) {
                                return <View key={action.key} style={styles.contextDivider} />;
                            }

                            const isDestructive = "destructive" in action && Boolean(action.destructive);
                            const hasArrow = "hasArrow" in action && Boolean(action.hasArrow);
                            const iconName = action.key === "pin"
                                ? selectedMessagePinned
                                    ? "pin"
                                    : "pin-outline"
                                : action.icon;
                                
                            const labelText = action.key === "pin"
                                ? selectedMessagePinned
                                    ? "Bo ghim"
                                    : "Ghim tin nhan"
                                : action.label;

                            return (
                                <Pressable
                                    key={action.key}
                                    style={styles.contextItem}
                                    onPress={() => handleContextAction(action.key)}
                                >
                                    <Ionicons
                                        name={iconName}
                                        size={16}
                                        color={isDestructive ? "#EF4444" : "#1F2937"}
                                    />
                                    <Text
                                        style={[
                                            styles.contextLabel,
                                            isDestructive && styles.contextLabelDanger,
                                        ]}
                                    >
                                        {labelText}
                                    </Text>
                                    {hasArrow ? (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={15}
                                            color={colors.textMuted}
                                            style={styles.contextChevron}
                                        />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    menuOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.18)",
    },
    contextMenuCard: {
        position: "absolute",
        width: MENU_WIDTH,
        backgroundColor: colors.white,
        borderRadius: 13,
        paddingVertical: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
        elevation: 10,
    },
    contextItem: {
        minHeight: 36,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 11,
    },
    contextLabel: {
        marginLeft: 9,
        fontSize: 14,
        color: "#111827",
        flex: 1,
    },
    contextLabelDanger: {
        color: "#EF4444",
    },
    contextChevron: {
        marginLeft: 8,
    },
    contextDivider: {
        height: 7,
        backgroundColor: "#F3F4F6",
        marginVertical: 3,
    },
});
