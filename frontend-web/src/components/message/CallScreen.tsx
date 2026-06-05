import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Maximize2,
    Mic,
    MicOff,
    Minimize2,
    PhoneOff,
    UserPlus,
    Video,
    VideoOff,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { CallStatus } from "../../services/websocket";

interface CallScreenProps {
    open: boolean;
    callType: "audio" | "video";
    remoteName: string;
    remoteAvatar?: string;
    status: CallStatus;
    durationText: string;
    localStream: MediaStream | null;
    localUserId?: number;
    remoteStream: MediaStream | null;
    remoteStreams?: Array<{ userId: number; stream: MediaStream }>;
    participants?: Array<{
        userId: number;
        name: string;
        avatar?: string;
    }>;
    micEnabled: boolean;
    cameraEnabled: boolean;
    isScreenSharing: boolean;
    canToggleCamera: boolean;
    canShareScreen: boolean;
    onInviteParticipants?: () => void;
    onToggleMic: () => void;
    onToggleCamera: () => void;
    onToggleScreenShare: () => void;
    onEndCall: () => void;
}

function getStatusText(status: CallStatus) {
    if (status === "calling") return "Đang gọi...";
    if (status === "ringing") return "Đang đổ chuông...";
    if (status === "accepted") return "Đang trong cuộc gọi";
    if (status === "rejected") return "Cuộc gọi bị từ chối";
    return "Cuộc gọi đã kết thúc";
}

export default function CallScreen({
    open,
    callType,
    remoteName,
    remoteAvatar,
    status,
    durationText,
    localStream,
    localUserId,
    remoteStream,
    remoteStreams = [],
    participants = [],
    micEnabled,
    cameraEnabled,
    isScreenSharing,
    canToggleCamera,
    canShareScreen,
    onInviteParticipants,
    onToggleMic,
    onToggleCamera,
    onToggleScreenShare,
    onEndCall,
}: CallScreenProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [isMinimized, setIsMinimized] = useState(false);

    const showParticipants = participants.length > 0;
    const participantCount = participants.length || (remoteStreams.length ? remoteStreams.length + 1 : 1);
    const useVideoTiles = callType === "video" && participantCount > 1;
    const showLocalPreview = callType === "video" && !useVideoTiles;
    const remoteStreamByUserId = new Map(
        remoteStreams.map((item) => [item.userId, item.stream]),
    );
    const videoTiles =
        participants.length > 0
            ? participants.map((participant) => {
                  const isLocal =
                      localUserId != null && participant.userId === localUserId;
                  return {
                      ...participant,
                      isLocal,
                      stream: isLocal
                          ? localStream
                          : remoteStreamByUserId.get(participant.userId) ?? null,
                  };
              })
            : [
                  ...remoteStreams.map((remote) => ({
                      userId: remote.userId,
                      name: `Người dùng ${remote.userId}`,
                      avatar: undefined,
                      isLocal: false,
                      stream: remote.stream,
                  })),
                  ...(localStream
                      ? [
                            {
                                userId: localUserId ?? -1,
                                name: "Bạn",
                                avatar: undefined,
                                isLocal: true,
                                stream: localStream,
                            },
                        ]
                      : []),
              ];

    const localVideoTrackSignature = useMemo(
        () =>
            localStream
                ?.getVideoTracks()
                .map((track) => `${track.id}:${track.readyState}:${track.enabled}`)
                .join("|") ?? "no-local-video",
        [localStream],
    );

    const attachStreamToMediaElement = useCallback((
        element: HTMLMediaElement | null,
        stream: MediaStream | null,
    ) => {
        if (!element) return;

        if (element.srcObject !== stream) {
            element.srcObject = stream;
        }

        if (stream) {
            void element.play().catch(() => undefined);
        }
    }, []);

    const attachLocalVideoElement = useCallback(
        (node: HTMLVideoElement | null) => {
            localVideoRef.current = node;
            attachStreamToMediaElement(node, localStream);
        },
        [attachStreamToMediaElement, localStream],
    );

    useEffect(() => {
        if (!open) {
            setIsMinimized(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        attachStreamToMediaElement(localVideoRef.current, localStream);
    }, [
        attachStreamToMediaElement,
        open,
        isMinimized,
        localStream,
        localVideoTrackSignature,
        showLocalPreview,
    ]);

    useEffect(() => {
        if (!open) return;
        attachStreamToMediaElement(remoteVideoRef.current, remoteStream);
    }, [attachStreamToMediaElement, open, isMinimized, remoteStream]);

    useEffect(() => {
        if (!open) return;

        if (callType !== "audio") {
            attachStreamToMediaElement(remoteAudioRef.current, null);
            return;
        }

        attachStreamToMediaElement(remoteAudioRef.current, remoteStream);
    }, [attachStreamToMediaElement, open, isMinimized, callType, remoteStream]);

    if (!open) return null;

    const showTimer = status === "accepted";
    const callLabel =
        callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";

    const controlButtonBase =
        "h-12 w-12 rounded-full transition-colors flex items-center justify-center";

    const fullCallOverlay = (
        <div className="fixed inset-0 z-[2147483000] bg-gray-950 text-white">
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                className="absolute h-px w-px opacity-0 pointer-events-none"
            />

            {callType === "video" ? (
                <div className="relative h-full w-full overflow-hidden bg-black">
                    {useVideoTiles ? (
                        <div className="h-full w-full grid grid-cols-2 auto-rows-fr gap-2 p-2 bg-black">
                            {videoTiles.map((tile) => (
                                <div
                                    key={`${tile.isLocal ? "local" : "remote"}-${tile.userId}`}
                                    className="relative min-h-0 overflow-hidden rounded-lg bg-gray-900"
                                >
                                    {tile.stream ? (
                                        <video
                                            autoPlay
                                            muted={tile.isLocal}
                                            playsInline
                                            ref={(node) => {
                                                if (!node) return;
                                                if (node.srcObject !== tile.stream) {
                                                    node.srcObject = tile.stream;
                                                }
                                                void node
                                                    .play()
                                                    .catch(() => undefined);
                                            }}
                                            className={`h-full w-full object-cover ${
                                                tile.isLocal ? "scale-x-[-1]" : ""
                                            }`}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-900">
                                            <img
                                                src={
                                                    tile.avatar ||
                                                    "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                                }
                                                alt={tile.name}
                                                className="h-16 w-16 rounded-full object-cover border border-white/20"
                                            />
                                            <p className="text-sm text-gray-200">
                                                Đang kết nối camera...
                                            </p>
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded bg-black/55 px-2 py-1 text-xs text-white">
                                        <span className="block truncate">
                                            {tile.isLocal ? "Bạn" : tile.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="h-full w-full object-cover bg-black"
                        />
                    )}

                    {showLocalPreview && (
                        <video
                            key={`local-preview-${localStream?.id ?? "none"}-${localVideoTrackSignature}`}
                            ref={attachLocalVideoElement}
                            autoPlay
                            muted
                            playsInline
                            onLoadedMetadata={(event) => {
                                void event.currentTarget
                                    .play()
                                    .catch(() => undefined);
                            }}
                            className="absolute bottom-28 right-5 h-40 w-28 rounded-2xl object-cover border border-white/30 bg-gray-900 shadow-xl"
                        />
                    )}

                    <div className="pointer-events-none absolute inset-x-0 top-0 p-5 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                        <div className="flex items-start justify-between gap-4 pointer-events-auto">
                            <div>
                                <p className="text-base font-semibold">
                                    {remoteName}
                                </p>
                                <p className="text-xs text-gray-200">
                                    {callLabel}
                                </p>
                                <p className="text-xs text-gray-300 mt-1">
                                    {getStatusText(status)}
                                    {showTimer ? ` • ${durationText}` : ""}
                                    {participantCount > 1
                                        ? ` • ${participantCount} người`
                                        : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMinimized(true)}
                                className="h-10 w-10 rounded-full bg-black/45 hover:bg-black/65 border border-white/20 flex items-center justify-center"
                                title="Thu nhỏ"
                            >
                                <Minimize2 size={18} />
                            </button>
                        </div>
                    </div>

                    {showParticipants && (
                        <div className="absolute top-20 left-4 w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-black/45 backdrop-blur-sm p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">
                                Thành viên cuộc gọi ({participantCount})
                            </p>
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {participants.map((member) => (
                                    <div
                                        key={member.userId}
                                        className="flex items-center gap-2"
                                    >
                                        <img
                                            src={
                                                member.avatar ||
                                                "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                            }
                                            alt={member.name}
                                            className="h-7 w-7 rounded-full object-cover border border-white/20"
                                        />
                                        <span className="text-sm text-white truncate">
                                            {member.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center px-4 text-center bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.25),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(14,165,233,0.18),transparent_40%),#020617]">
                    <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="absolute top-5 right-5 h-10 w-10 rounded-full bg-black/45 hover:bg-black/65 border border-white/20 flex items-center justify-center"
                        title="Thu nhỏ"
                    >
                        <Minimize2 size={18} />
                    </button>

                    <img
                        src={
                            remoteAvatar ||
                            "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                        }
                        alt={remoteName}
                        className="h-28 w-28 rounded-full object-cover border border-white/30 shadow-lg"
                    />
                    <p className="mt-5 text-2xl font-semibold tracking-tight">
                        {remoteName}
                    </p>
                    <p className="mt-2 text-sm text-gray-300">{callLabel}</p>
                    <p className="mt-1 text-sm text-gray-300">
                        {getStatusText(status)}
                        {participantCount > 1 ? ` • ${participantCount} người` : ""}
                    </p>
                    {showTimer && (
                        <p className="mt-2 text-sm text-gray-200 font-medium">
                            {durationText}
                        </p>
                    )}

                    {showParticipants && (
                        <div className="mt-6 w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-3 text-left">
                            <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">
                                Thành viên cuộc gọi ({participantCount})
                            </p>
                            <div className="space-y-2 max-h-44 overflow-y-auto">
                                {participants.map((member) => (
                                    <div
                                        key={member.userId}
                                        className="flex items-center gap-2"
                                    >
                                        <img
                                            src={
                                                member.avatar ||
                                                "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                            }
                                            alt={member.name}
                                            className="h-7 w-7 rounded-full object-cover border border-white/20"
                                        />
                                        <span className="text-sm text-white truncate">
                                            {member.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <button
                    type="button"
                    onClick={onToggleMic}
                    className={`${controlButtonBase} bg-white/20 hover:bg-white/30`}
                    title={micEnabled ? "Tắt mic" : "Bật mic"}
                >
                    {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                {canToggleCamera && (
                    <button
                        type="button"
                        onClick={onToggleCamera}
                        className={`${controlButtonBase} bg-white/20 hover:bg-white/30`}
                        title={cameraEnabled ? "Tắt camera" : "Bật camera"}
                    >
                        {cameraEnabled ? (
                            <Video size={20} />
                        ) : (
                            <VideoOff size={20} />
                        )}
                    </button>
                )}

                {canShareScreen && (
                    <button
                        type="button"
                        onClick={onToggleScreenShare}
                        className="h-12 px-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm font-medium"
                        title={
                            isScreenSharing
                                ? "Dừng chia sẻ màn hình"
                                : "Chia sẻ màn hình"
                        }
                    >
                        {isScreenSharing ? "Dừng share" : "Share màn hình"}
                    </button>
                )}

                {onInviteParticipants && (
                    <button
                        type="button"
                        onClick={onInviteParticipants}
                        className={`${controlButtonBase} bg-white/20 hover:bg-white/30`}
                        title="Mời thêm người"
                    >
                        <UserPlus size={20} />
                    </button>
                )}

                <button
                    type="button"
                    onClick={onEndCall}
                    className={`${controlButtonBase} bg-red-500 hover:bg-red-600`}
                    title="Kết thúc cuộc gọi"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );

    const minimizedCallOverlay = (
        <div className="fixed right-4 bottom-4 z-[2147483000] w-[min(92vw,360px)] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl bg-white dark:bg-gray-900 overflow-hidden">
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                className="absolute h-px w-px opacity-0 pointer-events-none"
            />

            {callType === "video" ? (
                <div className="relative bg-black">
                    {useVideoTiles ? (
                        <div className="h-48 w-full grid grid-cols-2 gap-1 p-1">
                            {videoTiles.slice(0, 4).map((tile) => (
                                <div
                                    key={`${tile.isLocal ? "local" : "remote"}-${tile.userId}`}
                                    className="relative overflow-hidden rounded-md bg-gray-900"
                                >
                                    {tile.stream ? (
                                        <video
                                            autoPlay
                                            muted={tile.isLocal}
                                            playsInline
                                            ref={(node) => {
                                                if (!node) return;
                                                if (node.srcObject !== tile.stream) {
                                                    node.srcObject = tile.stream;
                                                }
                                                void node
                                                    .play()
                                                    .catch(() => undefined);
                                            }}
                                            className={`h-full w-full object-cover ${
                                                tile.isLocal ? "scale-x-[-1]" : ""
                                            }`}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <img
                                                src={
                                                    tile.avatar ||
                                                    "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                                }
                                                alt={tile.name}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="h-48 w-full object-cover"
                        />
                    )}

                    {showLocalPreview && (
                        <video
                            key={`local-min-preview-${localStream?.id ?? "none"}-${localVideoTrackSignature}`}
                            ref={attachLocalVideoElement}
                            autoPlay
                            muted
                            playsInline
                            onLoadedMetadata={(event) => {
                                void event.currentTarget
                                    .play()
                                    .catch(() => undefined);
                            }}
                            className="absolute bottom-3 right-3 h-20 w-14 rounded-xl object-cover border border-white/30 bg-gray-900"
                        />
                    )}
                </div>
            ) : (
                <div className="p-4 bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-white">
                    <div className="flex items-center gap-3">
                        <img
                            src={
                                remoteAvatar ||
                                "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                            }
                            alt={remoteName}
                            className="h-10 w-10 rounded-full border border-white/30 object-cover"
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                                {remoteName}
                            </p>
                            <p className="text-xs text-gray-200">
                                {showTimer
                                    ? durationText
                                    : getStatusText(status)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onToggleMic}
                        className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center"
                        title={micEnabled ? "Tắt mic" : "Bật mic"}
                    >
                        {micEnabled ? (
                            <Mic
                                size={16}
                                className="text-gray-800 dark:text-gray-100"
                            />
                        ) : (
                            <MicOff
                                size={16}
                                className="text-gray-800 dark:text-gray-100"
                            />
                        )}
                    </button>

                    {canToggleCamera && (
                        <button
                            type="button"
                            onClick={onToggleCamera}
                            className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center"
                            title={cameraEnabled ? "Tắt camera" : "Bật camera"}
                        >
                            {cameraEnabled ? (
                                <Video
                                    size={16}
                                    className="text-gray-800 dark:text-gray-100"
                                />
                            ) : (
                                <VideoOff
                                    size={16}
                                    className="text-gray-800 dark:text-gray-100"
                                />
                            )}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsMinimized(false)}
                        className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center"
                        title="Phóng to toàn màn hình"
                    >
                        <Maximize2
                            size={16}
                            className="text-gray-800 dark:text-gray-100"
                        />
                    </button>

                    <button
                        type="button"
                        onClick={onEndCall}
                        className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white"
                        title="Kết thúc cuộc gọi"
                    >
                        <PhoneOff size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(
        isMinimized ? minimizedCallOverlay : fullCallOverlay,
        document.body,
    );
}
