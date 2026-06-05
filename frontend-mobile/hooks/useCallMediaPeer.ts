import { useCallback, useRef, useState } from "react";
import Constants from "expo-constants";

type InCallManagerShape = {
    start: (options: { media: "audio" | "video" }) => void;
    stop: () => void;
    setForceSpeakerphoneOn: (enabled: boolean) => void;
    setSpeakerphoneOn: (enabled: boolean) => void;
};

type WebRtcShape = {
    MediaStream?: new () => {
        addTrack: (track: unknown) => void;
        getTracks: () => Array<{ stop: () => void }>;
        getAudioTracks: () => Array<{ enabled: boolean }>;
        getVideoTracks: () => Array<{ enabled: boolean; _switchCamera?: () => void }>;
        toURL: () => string;
    };
    mediaDevices?: {
        getUserMedia: (constraints: {
            audio: boolean;
            video:
            | false
            | {
                facingMode: "user" | "environment";
            };
        }) => Promise<{
            getTracks: () => Array<{ stop: () => void }>;
            getAudioTracks: () => Array<{ enabled: boolean }>;
            getVideoTracks: () => Array<{ enabled: boolean; _switchCamera?: () => void }>;
            toURL: () => string;
        }>;
    };
    RTCPeerConnection?: new (config: RTCConfiguration) => {
        close: () => void;
        addTrack: (track: unknown, stream: unknown) => void;
        addIceCandidate: (candidate: unknown) => Promise<void>;
        createOffer: () => Promise<RTCSessionDescriptionInit>;
        createAnswer: () => Promise<RTCSessionDescriptionInit>;
        setLocalDescription: (description: unknown) => Promise<void>;
        setRemoteDescription: (description: unknown) => Promise<void>;
        onicecandidate?: (event: { candidate?: { toJSON: () => RTCIceCandidateInit } | null }) => void;
        ontrack?: (event: {
            streams: Array<{
                toURL: () => string;
                addTrack?: (track: unknown) => void;
                getTracks?: () => Array<{ stop: () => void }>;
            }>;
            track: unknown;
        }) => void;
    };
    RTCIceCandidate?: new (candidate: RTCIceCandidateInit) => unknown;
};

const expoEnv = Constants as {
    executionEnvironment?: string;
    appOwnership?: string;
};

const isExpoGo =
    expoEnv.executionEnvironment === "storeClient" ||
    expoEnv.appOwnership === "expo";

function loadInCallManager(): InCallManagerShape | null {
    if (isExpoGo) return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("react-native-incall-manager");
        return (mod?.default ?? mod) as InCallManagerShape;
    } catch {
        return null;
    }
}

function loadWebRtc(): WebRtcShape {
    if (isExpoGo) return {};
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("react-native-webrtc") as WebRtcShape;
    } catch {
        return {};
    }
}

const inCallManager = loadInCallManager();
const webRtc = loadWebRtc();
const MediaStreamClass = webRtc.MediaStream;
const mediaDevices = webRtc.mediaDevices;
const RTCPeerConnectionClass = webRtc.RTCPeerConnection;
const RTCIceCandidateClass = webRtc.RTCIceCandidate;
const WEBRTC_SUPPORTED = Boolean(
    mediaDevices?.getUserMedia &&
    RTCPeerConnectionClass &&
    RTCIceCandidateClass &&
    MediaStreamClass,
);

export type MobileCallType = "audio" | "video";

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface CreatePeerParams {
    remoteUserId?: number;
    onIceCandidate: (candidate: RTCIceCandidateInit) => void;
}

export function useCallMediaPeer() {
    const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
    const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
    const [remoteStreamUrls, setRemoteStreamUrls] = useState<
        Array<{ userId: number; url: string }>
    >([]);
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [speakerEnabled, setSpeakerEnabled] = useState(false);

    const peerConnectionRef = useRef<{
        close: () => void;
        addTrack: (track: unknown, stream: unknown) => void;
        addIceCandidate: (candidate: unknown) => Promise<void>;
        createOffer: () => Promise<RTCSessionDescriptionInit>;
        createAnswer: () => Promise<RTCSessionDescriptionInit>;
        setLocalDescription: (description: unknown) => Promise<void>;
        setRemoteDescription: (description: unknown) => Promise<void>;
        onicecandidate?: (event: { candidate?: { toJSON: () => RTCIceCandidateInit } | null }) => void;
        ontrack?: (event: { streams: Array<{ toURL: () => string }>; track: unknown }) => void;
    } | null>(null);
    const peerConnectionsRef = useRef<
        Map<
            number,
            {
                close: () => void;
                addTrack: (track: unknown, stream: unknown) => void;
                addIceCandidate: (candidate: unknown) => Promise<void>;
                createOffer: () => Promise<RTCSessionDescriptionInit>;
                createAnswer: () => Promise<RTCSessionDescriptionInit>;
                setLocalDescription: (description: unknown) => Promise<void>;
                setRemoteDescription: (description: unknown) => Promise<void>;
                onicecandidate?: (event: { candidate?: { toJSON: () => RTCIceCandidateInit } | null }) => void;
                ontrack?: (event: {
                    streams: Array<{
                        toURL: () => string;
                        addTrack?: (track: unknown) => void;
                        getTracks?: () => Array<{ id?: string; stop: () => void }>;
                    }>;
                    track: { id?: string };
                }) => void;
            }
        >
    >(new Map());
    const localStreamRef = useRef<{
        getTracks: () => Array<{ stop: () => void }>;
        getAudioTracks: () => Array<{ enabled: boolean }>;
        getVideoTracks: () => Array<{ enabled: boolean; _switchCamera?: () => void }>;
        toURL: () => string;
    } | null>(null);
    const remoteStreamRef = useRef<{
        addTrack?: (track: unknown) => void;
        getTracks?: () => Array<{ stop: () => void }>;
        toURL: () => string;
    } | null>(null);
    const remoteStreamsByUserRef = useRef<
        Map<
            number,
            {
                addTrack?: (track: unknown) => void;
                getTracks?: () => Array<{ id?: string; stop: () => void }>;
                toURL: () => string;
            }
        >
    >(new Map());
    const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const pendingIceCandidatesByUserRef = useRef<Map<number, RTCIceCandidateInit[]>>(
        new Map(),
    );

    const stopAudioSession = useCallback(() => {
        if (!inCallManager) return;
        try {
            inCallManager.stop();
        } catch {
            // no-op
        }
    }, []);

    const startAudioSession = useCallback((callType: MobileCallType) => {
        const shouldUseSpeaker = callType === "video";
        setSpeakerEnabled(shouldUseSpeaker);

        if (!inCallManager) return;

        try {
            inCallManager.start({
                media: callType === "video" ? "video" : "audio",
            });
            inCallManager.setForceSpeakerphoneOn(shouldUseSpeaker);
            inCallManager.setSpeakerphoneOn(shouldUseSpeaker);
        } catch {
            // no-op
        }
    }, []);

    const cleanupPeer = useCallback(() => {
        peerConnectionsRef.current.forEach((peer) => {
            peer.onicecandidate = undefined;
            peer.ontrack = undefined;
            peer.close();
        });
        peerConnectionsRef.current.clear();
        peerConnectionRef.current = null;
    }, []);

    const closePeerConnectionForUser = useCallback((remoteUserId: number) => {
        const peer = peerConnectionsRef.current.get(remoteUserId);
        if (!peer) return;

        peer.onicecandidate = undefined;
        peer.ontrack = undefined;
        peer.close();
        peerConnectionsRef.current.delete(remoteUserId);

        if (peerConnectionRef.current === peer) {
            peerConnectionRef.current = null;
        }

        setRemoteStreamUrls((prev) =>
            prev.filter((item) => item.userId !== remoteUserId),
        );
        remoteStreamsByUserRef.current.delete(remoteUserId);
    }, []);

    const cleanupMedia = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        remoteStreamsByUserRef.current.forEach((stream) => {
            stream.getTracks?.().forEach((track) => track.stop());
        });

        localStreamRef.current = null;
        remoteStreamRef.current = null;
        remoteStreamsByUserRef.current.clear();

        setLocalStreamUrl(null);
        setRemoteStreamUrl(null);
        setRemoteStreamUrls([]);
        setMicEnabled(true);
        setCameraEnabled(true);
        setSpeakerEnabled(false);
    }, []);

    const resetPeerAndMedia = useCallback(() => {
        stopAudioSession();
        cleanupPeer();
        cleanupMedia();
        pendingIceCandidatesRef.current = [];
        pendingIceCandidatesByUserRef.current.clear();
    }, [cleanupMedia, cleanupPeer, stopAudioSession]);

    const createLocalStream = useCallback(async (callType: MobileCallType) => {
        if (!WEBRTC_SUPPORTED || !mediaDevices?.getUserMedia) {
            throw new Error("WEBRTC_NOT_SUPPORTED");
        }

        const stream = await mediaDevices.getUserMedia({
            audio: true,
            video:
                callType === "video"
                    ? {
                        facingMode: "user",
                    }
                    : false,
        });

        localStreamRef.current = stream;
        setLocalStreamUrl(stream.toURL());

        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        setMicEnabled(audioTracks.every((track) => track.enabled));
        setCameraEnabled(videoTracks.every((track) => track.enabled));

        return stream;
    }, []);

    const createPeerConnection = useCallback(
        (params: CreatePeerParams) => {
            const remoteUserId = params.remoteUserId ?? 0;
            const existingPeer = peerConnectionsRef.current.get(remoteUserId);
            if (existingPeer) {
                existingPeer.onicecandidate = undefined;
                existingPeer.ontrack = undefined;
                existingPeer.close();
                peerConnectionsRef.current.delete(remoteUserId);
                setRemoteStreamUrls((prev) =>
                    prev.filter((item) => item.userId !== remoteUserId),
                );
                remoteStreamsByUserRef.current.delete(remoteUserId);
            }

            if (!WEBRTC_SUPPORTED || !RTCPeerConnectionClass) {
                throw new Error("WEBRTC_NOT_SUPPORTED");
            }

            const peer = new RTCPeerConnectionClass(RTC_CONFIG);
            peerConnectionsRef.current.set(remoteUserId, peer);
            peerConnectionRef.current = peer;

            const mutablePeer = peer;

            mutablePeer.onicecandidate = (event) => {
                if (!event.candidate) return;
                params.onIceCandidate(event.candidate.toJSON());
            };

            mutablePeer.ontrack = (event) => {
                const inboundStream = event.streams[0];
                if (inboundStream) {
                    remoteStreamRef.current = inboundStream;
                    const url = inboundStream.toURL();
                    setRemoteStreamUrl((prev) => prev ?? url);
                    setRemoteStreamUrls((prev) => {
                        const existing = prev.find((item) => item.userId === remoteUserId);
                        if (existing) {
                            return prev.map((item) =>
                                item.userId === remoteUserId ? { userId: remoteUserId, url } : item,
                            );
                        }
                        return [...prev, { userId: remoteUserId, url }];
                    });
                    return;
                }

                let fallbackStream = remoteStreamsByUserRef.current.get(remoteUserId);
                if (!fallbackStream) {
                    if (!MediaStreamClass) return;
                    fallbackStream = new MediaStreamClass();
                    remoteStreamsByUserRef.current.set(remoteUserId, fallbackStream);
                }

                const inboundTrack = event.track as { id?: string };
                const hasTrack = fallbackStream
                    .getTracks?.()
                    .some((track) => track.id && track.id === inboundTrack.id);
                if (!hasTrack) {
                    fallbackStream.addTrack?.(inboundTrack);
                }
                remoteStreamRef.current = fallbackStream;
                const url = fallbackStream.toURL();
                setRemoteStreamUrl((prev) => prev ?? url);
                setRemoteStreamUrls((prev) => {
                    const existing = prev.find((item) => item.userId === remoteUserId);
                    if (existing) {
                        return prev.map((item) =>
                            item.userId === remoteUserId ? { userId: remoteUserId, url } : item,
                        );
                    }
                    return [...prev, { userId: remoteUserId, url }];
                });
            };

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    peer.addTrack(track, localStreamRef.current);
                });
            }

            return peer;
        },
        [],
    );

    const queueIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
        pendingIceCandidatesRef.current.push(candidate);
    }, []);

    const flushQueuedIceCandidates = useCallback(async (remoteUserId?: number) => {
        const peer =
            remoteUserId == null
                ? peerConnectionRef.current
                : peerConnectionsRef.current.get(remoteUserId);
        if (!peer) return;

        const queued =
            remoteUserId == null
                ? [...pendingIceCandidatesRef.current]
                : [...(pendingIceCandidatesByUserRef.current.get(remoteUserId) ?? [])];
        if (!queued.length) return;

        for (const candidate of queued) {
            try {
                if (!RTCIceCandidateClass) break;
                await peer.addIceCandidate(new RTCIceCandidateClass(candidate));
            } catch {
                // no-op
            }
        }

        if (remoteUserId == null) {
            pendingIceCandidatesRef.current = [];
        } else {
            pendingIceCandidatesByUserRef.current.delete(remoteUserId);
        }
    }, []);

    const addIceCandidateOrQueue = useCallback(
        async (candidate: RTCIceCandidateInit, remoteUserId?: number) => {
            const peer =
                remoteUserId == null
                    ? peerConnectionRef.current
                    : peerConnectionsRef.current.get(remoteUserId);
            if (!peer) {
                if (remoteUserId == null) {
                    queueIceCandidate(candidate);
                } else {
                    const existing =
                        pendingIceCandidatesByUserRef.current.get(remoteUserId) ?? [];
                    pendingIceCandidatesByUserRef.current.set(remoteUserId, [
                        ...existing,
                        candidate,
                    ]);
                }
                return;
            }

            try {
                if (!RTCIceCandidateClass) {
                    if (remoteUserId == null) queueIceCandidate(candidate);
                    return;
                }
                await peer.addIceCandidate(new RTCIceCandidateClass(candidate));
            } catch {
                if (remoteUserId == null) {
                    queueIceCandidate(candidate);
                } else {
                    const existing =
                        pendingIceCandidatesByUserRef.current.get(remoteUserId) ?? [];
                    pendingIceCandidatesByUserRef.current.set(remoteUserId, [
                        ...existing,
                        candidate,
                    ]);
                }
            }
        },
        [queueIceCandidate],
    );

    const getPeerConnection = useCallback(
        (remoteUserId?: number) =>
            remoteUserId == null
                ? peerConnectionRef.current
                : peerConnectionsRef.current.get(remoteUserId) ?? null,
        [],
    );

    const toggleMic = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;

        stream.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });

        setMicEnabled(stream.getAudioTracks().every((track) => track.enabled));
    }, []);

    const toggleCamera = useCallback((callType: MobileCallType | null) => {
        const stream = localStreamRef.current;
        if (!stream || callType !== "video") return;

        const videoTracks = stream.getVideoTracks();
        if (!videoTracks.length) return;

        videoTracks.forEach((track) => {
            track.enabled = !track.enabled;
        });

        setCameraEnabled(videoTracks.every((track) => track.enabled));
    }, []);

    const switchCamera = useCallback((callType: MobileCallType | null) => {
        const stream = localStreamRef.current;
        if (!stream || callType !== "video") return;

        const videoTrack = stream.getVideoTracks()[0] as
            | {
                _switchCamera?: () => void;
            }
            | undefined;

        if (videoTrack && typeof videoTrack._switchCamera === "function") {
            videoTrack._switchCamera();
        }
    }, []);

    const toggleSpeaker = useCallback(() => {
        setSpeakerEnabled((prev) => {
            const next = !prev;
            try {
                inCallManager?.setForceSpeakerphoneOn(next);
                inCallManager?.setSpeakerphoneOn(next);
            } catch {
                // no-op
            }
            return next;
        });
    }, []);

    return {
        peerConnectionRef,
        localStreamRef,
        localStreamUrl,
        remoteStreamUrl,
        remoteStreamUrls,
        micEnabled,
        cameraEnabled,
        speakerEnabled,
        isWebRTCSupported: WEBRTC_SUPPORTED,
        startAudioSession,
        stopAudioSession,
        createLocalStream,
        createPeerConnection,
        queueIceCandidate,
        flushQueuedIceCandidates,
        addIceCandidateOrQueue,
        getPeerConnection,
        closePeerConnectionForUser,
        resetPeerAndMedia,
        toggleMic,
        toggleCamera,
        switchCamera,
        toggleSpeaker,
    };
}
