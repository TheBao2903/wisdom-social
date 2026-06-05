import { Ionicons } from "@expo/vector-icons";
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Constants from "expo-constants";
import { colors } from "@/constants";

const expoEnv = Constants as {
    executionEnvironment?: string;
    appOwnership?: string;
};

const isExpoGo =
    expoEnv.executionEnvironment === "storeClient" ||
    expoEnv.appOwnership === "expo";

function resolveRtcView(): any | null {
    if (isExpoGo) return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("react-native-webrtc") as { RTCView?: any };
        return mod.RTCView ?? null;
    } catch {
        return null;
    }
}

const RTCViewComponent = resolveRtcView();

type CallType = "audio" | "video";
type CallStatus = "calling" | "ringing" | "accepted" | "rejected" | "ended";

interface InCallOverlayProps {
    visible: boolean;
    callType: CallType;
    remoteName: string;
    remoteAvatar?: string;
    status: CallStatus;
    durationText: string;
    localStreamUrl: string | null;
    localUserId?: number;
    remoteStreamUrl: string | null;
    remoteStreamUrls?: { userId: number; url: string }[];
    participants?: { userId: number; name: string; avatar?: string }[];
    micEnabled: boolean;
    cameraEnabled: boolean;
    speakerEnabled: boolean;
    onToggleMic: () => void;
    onToggleCamera: () => void;
    onSwitchCamera: () => void;
    onToggleSpeaker: () => void;
    onInviteParticipants?: () => void;
    onEndCall: () => void;
}

function getStatusText(status: CallStatus): string {
    if (status === "calling") return "Dang goi...";
    if (status === "ringing") return "Dang do chuong...";
    if (status === "accepted") return "Dang trong cuoc goi";
    if (status === "rejected") return "Cuoc goi bi tu choi";
    return "Cuoc goi da ket thuc";
}

function ControlButton(props: {
    icon: keyof typeof Ionicons.glyphMap;
    active?: boolean;
    danger?: boolean;
    onPress: () => void;
}) {
    const { icon, active = true, danger = false, onPress } = props;

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.controlBtn,
                danger
                    ? styles.controlBtnDanger
                    : active
                      ? styles.controlBtnActive
                      : styles.controlBtnInactive,
            ]}
        >
            <Ionicons name={icon} size={21} color={colors.white} />
        </Pressable>
    );
}

export default function InCallOverlay({
    visible,
    callType,
    remoteName,
    remoteAvatar,
    status,
    durationText,
    localStreamUrl,
    localUserId,
    remoteStreamUrl,
    remoteStreamUrls = [],
    participants = [],
    micEnabled,
    cameraEnabled,
    speakerEnabled,
    onToggleMic,
    onToggleCamera,
    onSwitchCamera,
    onToggleSpeaker,
    onInviteParticipants,
    onEndCall,
}: InCallOverlayProps) {
    if (!visible) return null;

    const isVideo = callType === "video";
    const participantCount =
        participants.length ||
        (remoteStreamUrls.length ? remoteStreamUrls.length + 1 : 1);
    const showLocalPreview = isVideo && participantCount <= 2;
    const remoteStreamUrlByUserId = new Map(
        remoteStreamUrls.map((item) => [item.userId, item.url]),
    );
    const videoTiles =
        participants.length > 0
            ? participants.map((participant) => {
                  const isLocal =
                      localUserId != null && participant.userId === localUserId;
                  return {
                      ...participant,
                      isLocal,
                      streamUrl: isLocal
                          ? localStreamUrl
                          : remoteStreamUrlByUserId.get(participant.userId) ??
                            null,
                  };
              })
            : [
                  ...remoteStreamUrls.map((item) => ({
                      userId: item.userId,
                      name: `Nguoi dung ${item.userId}`,
                      avatar: undefined,
                      isLocal: false,
                      streamUrl: item.url,
                  })),
                  ...(localStreamUrl
                      ? [
                            {
                                userId: localUserId ?? -1,
                                name: "Ban",
                                avatar: undefined,
                                isLocal: true,
                                streamUrl: localStreamUrl,
                            },
                        ]
                      : []),
              ];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
        >
            <View style={styles.root}>
                {isVideo ? (
                    <View style={styles.videoLayer}>
                        {videoTiles.length > 2 ? (
                            <View style={styles.remoteGrid}>
                                {videoTiles.map((item) => (
                                    <View
                                        key={`${item.isLocal ? "local" : "remote"}-${item.userId}`}
                                        style={styles.videoTile}
                                    >
                                        {item.streamUrl && RTCViewComponent ? (
                                            <RTCViewComponent
                                                streamURL={item.streamUrl}
                                                style={styles.videoTileMedia}
                                                objectFit="cover"
                                                mirror={item.isLocal}
                                            />
                                        ) : (
                                            <View style={styles.videoTileFallback}>
                                                <Image
                                                    source={{
                                                        uri:
                                                            item.avatar ||
                                                            "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                                                    }}
                                                    style={styles.videoTileAvatar}
                                                />
                                                <Text style={styles.videoTileFallbackText}>
                                                    Dang ket noi camera...
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.videoTileNamePill}>
                                            <Text
                                                style={styles.videoTileName}
                                                numberOfLines={1}
                                            >
                                                {item.isLocal ? "Ban" : item.name}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : remoteStreamUrl && RTCViewComponent ? (
                            <RTCViewComponent
                                streamURL={remoteStreamUrl}
                                style={styles.remoteVideo}
                                objectFit="cover"
                                mirror={false}
                            />
                        ) : (
                            <View style={styles.remoteVideoFallback}>
                                <Text style={styles.remoteVideoFallbackText}>
                                    {RTCViewComponent
                                        ? "Dang ket noi video..."
                                        : "Video call can dev build co native module WebRTC"}
                                </Text>
                            </View>
                        )}

                        {showLocalPreview && localStreamUrl && RTCViewComponent ? (
                            <RTCViewComponent
                                streamURL={localStreamUrl}
                                style={styles.localVideo}
                                objectFit="cover"
                                mirror
                            />
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.audioLayer}>
                        <Image
                            source={{
                                uri:
                                    remoteAvatar ||
                                    "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                            }}
                            style={styles.avatar}
                        />
                    </View>
                )}

                <View style={styles.headerMeta}>
                    <Text style={styles.remoteName} numberOfLines={1}>
                        {remoteName}
                    </Text>
                    <Text style={styles.callStatus}>
                        {getStatusText(status)}
                        {status === "accepted" ? ` • ${durationText}` : ""}
                        {participantCount > 1 ? ` • ${participantCount} nguoi` : ""}
                    </Text>
                </View>

                {participants.length > 0 ? (
                    <View style={styles.participantsPanel}>
                        <Text style={styles.participantsTitle}>
                            Thanh vien cuoc goi ({participantCount})
                        </Text>
                        <ScrollView style={styles.participantsList}>
                            {participants.map((member) => (
                                <View key={member.userId} style={styles.participantRow}>
                                    <Image
                                        source={{
                                            uri:
                                                member.avatar ||
                                                "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                                        }}
                                        style={styles.participantAvatar}
                                    />
                                    <Text style={styles.participantName} numberOfLines={1}>
                                        {member.name}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}

                <View style={styles.controlsRow}>
                    <ControlButton
                        icon={micEnabled ? "mic" : "mic-off"}
                        active={micEnabled}
                        onPress={onToggleMic}
                    />

                    {isVideo ? (
                        <ControlButton
                            icon={cameraEnabled ? "videocam" : "videocam-off"}
                            active={cameraEnabled}
                            onPress={onToggleCamera}
                        />
                    ) : null}

                    {isVideo ? (
                        <ControlButton
                            icon="camera-reverse"
                            onPress={onSwitchCamera}
                        />
                    ) : null}

                    <ControlButton
                        icon={speakerEnabled ? "volume-high" : "volume-medium"}
                        active={speakerEnabled}
                        onPress={onToggleSpeaker}
                    />

                    {onInviteParticipants ? (
                        <ControlButton
                            icon="person-add"
                            onPress={onInviteParticipants}
                        />
                    ) : null}

                    <ControlButton icon="call" danger onPress={onEndCall} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#030712",
    },
    videoLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#000000",
    },
    remoteVideo: {
        width: "100%",
        height: "100%",
    },
    remoteGrid: {
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        padding: 4,
    },
    videoTile: {
        width: "49%",
        height: "49%",
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#111827",
    },
    videoTileMedia: {
        width: "100%",
        height: "100%",
    },
    videoTileFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#111827",
    },
    videoTileAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
    },
    videoTileFallbackText: {
        color: "#CBD5E1",
        fontSize: 12,
    },
    videoTileNamePill: {
        position: "absolute",
        left: 8,
        right: 8,
        bottom: 8,
        borderRadius: 6,
        backgroundColor: "rgba(0,0,0,0.55)",
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    videoTileName: {
        color: colors.white,
        fontSize: 12,
        fontWeight: "600",
    },
    remoteGridVideo: {
        width: "49%",
        height: "49%",
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#111827",
    },
    remoteVideoFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    remoteVideoFallbackText: {
        color: "#E5E7EB",
        fontSize: 14,
    },
    localVideo: {
        position: "absolute",
        right: 16,
        bottom: 128,
        width: 108,
        height: 160,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#111827",
    },
    audioLayer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#020617",
    },
    avatar: {
        width: 124,
        height: 124,
        borderRadius: 62,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.25)",
    },
    headerMeta: {
        position: "absolute",
        top: 56,
        left: 20,
        right: 20,
        alignItems: "center",
    },
    remoteName: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.white,
    },
    callStatus: {
        marginTop: 8,
        fontSize: 14,
        color: "#CBD5E1",
    },
    participantsPanel: {
        position: "absolute",
        top: 120,
        left: 16,
        right: 16,
        maxHeight: 170,
        borderRadius: 14,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        padding: 12,
    },
    participantsTitle: {
        color: "#CBD5E1",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 8,
    },
    participantsList: {
        maxHeight: 120,
    },
    participantRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 4,
    },
    participantAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    participantName: {
        flex: 1,
        color: colors.white,
        fontSize: 13,
    },
    controlsRow: {
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 34,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
    },
    controlBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    controlBtnActive: {
        backgroundColor: "rgba(30, 41, 59, 0.9)",
    },
    controlBtnInactive: {
        backgroundColor: "rgba(100, 116, 139, 0.85)",
    },
    controlBtnDanger: {
        backgroundColor: "#EF4444",
        transform: [{ rotate: "135deg" }],
    },
});
