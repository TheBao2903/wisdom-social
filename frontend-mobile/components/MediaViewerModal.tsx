import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { colors, spacing } from "@/constants";
import { MediaViewerState } from "@/utils/messageUtils";

type Props = {
    mediaViewer: MediaViewerState | null;
    closeMediaViewer: () => void;
};

export function MediaViewerModal({ mediaViewer, closeMediaViewer }: Props) {
    return (
        <Modal
            visible={Boolean(mediaViewer)}
            transparent
            animationType="fade"
            onRequestClose={closeMediaViewer}
        >
            <SafeAreaView style={styles.mediaViewerOverlay}>
                <Pressable
                    style={styles.mediaViewerCloseBtn}
                    onPress={closeMediaViewer}
                    hitSlop={10}
                >
                    <Ionicons name="close" size={24} color={colors.white} />
                </Pressable>

                <View style={styles.mediaViewerContent}>
                    {mediaViewer?.type === "IMAGE" ? (
                        <Image
                            source={{ uri: mediaViewer.url }}
                            style={styles.mediaViewerImage}
                            resizeMode="contain"
                        />
                    ) : mediaViewer?.type === "VIDEO" ? (
                        <Video
                            source={{ uri: mediaViewer.url }}
                            style={styles.mediaViewerVideo}
                            useNativeControls
                            shouldPlay
                            resizeMode={ResizeMode.CONTAIN}
                        />
                    ) : null}
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    mediaViewerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
    },
    mediaViewerCloseBtn: {
        alignSelf: "flex-end",
        marginTop: spacing.md,
        marginRight: spacing.md,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.16)",
    },
    mediaViewerContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.lg,
    },
    mediaViewerImage: {
        width: "100%",
        height: "100%",
    },
    mediaViewerVideo: {
        width: "100%",
        height: "78%",
        backgroundColor: "#000",
    },
});
