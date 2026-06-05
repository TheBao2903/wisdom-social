import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Animated, Easing, Alert, Linking, Platform } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import { AudioProgress, buildAudioWaveBars } from "@/utils/messageUtils";

export function useMessageAudioPlayback() {
    const audioPlayPulse = useRef(new Animated.Value(1)).current;
    const audioIconFade = useRef(new Animated.Value(1)).current;
    const audioPressScale = useRef(new Animated.Value(1)).current;
    const audioSeekScale = useRef(new Animated.Value(1)).current;
    const [activeSeekAudioKey, setActiveSeekAudioKey] = useState<string | null>(
        null,
    );
    const [activePressAudioKey, setActivePressAudioKey] = useState<
        string | null
    >(null);
    const audioWaveBarsCacheRef = useRef<Record<string, number[]>>({});

    const [audioLoadingKey, setAudioLoadingKey] = useState<string | null>(null);
    const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
    const [audioProgressMap, setAudioProgressMap] = useState<
        Record<string, AudioProgress>
    >({});
    const [audioTrackWidthMap, setAudioTrackWidthMap] = useState<
        Record<string, number>
    >({});

    const activeAudioRef = useRef<Audio.Sound | null>(null);
    const activeAudioKeyRef = useRef<string | null>(null);
    const audioSeekThrottleRef = useRef<Record<string, number>>({});
    const audioBoundaryStateRef = useRef<
        Record<string, "start" | "end" | null>
    >({});

    const isLikelyUnsupportedAudioFormat = useCallback(
        (audioUrl: string, mimeType?: string) => {
            const normalizedMime = mimeType?.toLowerCase() ?? "";
            const normalizedUrl = audioUrl.toLowerCase();

            const isWebmFamily =
                normalizedMime.includes("webm") ||
                normalizedMime.includes("opus") ||
                normalizedUrl.includes(".webm") ||
                normalizedUrl.includes(".opus") ||
                normalizedUrl.includes(".weba");
            const isOggFamily =
                normalizedMime.includes("ogg") ||
                normalizedUrl.includes(".ogg");

            if (Platform.OS === "ios") {
                return isWebmFamily || isOggFamily;
            }

            return false;
        },
        [],
    );

    const promptExternalAudioPlayback = useCallback((audioUrl: string) => {
        Alert.alert(
            "Thong bao",
            "Khong the phat am thanh trong app luc nay. Ban co muon mo trinh duyet de nghe khong?",
            [
                { text: "Huy", style: "cancel" },
                {
                    text: "Mo",
                    onPress: () => {
                        void Linking.openURL(audioUrl);
                    },
                },
            ],
        );
    }, []);

    const ensurePlaybackAudioMode = useCallback(async () => {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
        });
    }, []);

    const handleAudioStatusUpdate = useCallback(
        (audioKey: string, status: AVPlaybackStatus) => {
            if (!status.isLoaded) {
                if (activeAudioKeyRef.current === audioKey) {
                    setPlayingAudioKey(null);
                }
                return;
            }

            if (status.didJustFinish) {
                const durationMillis = status.durationMillis ?? 0;

                setAudioProgressMap((prev) => ({
                    ...prev,
                    [audioKey]: {
                        positionMillis: 0,
                        durationMillis,
                    },
                }));
                setPlayingAudioKey(null);

                if (
                    activeAudioKeyRef.current === audioKey &&
                    activeAudioRef.current
                ) {
                    void activeAudioRef.current
                        .setPositionAsync(0)
                        .catch(() => undefined);
                }
                return;
            }

            setAudioProgressMap((prev) => ({
                ...prev,
                [audioKey]: {
                    positionMillis: status.positionMillis ?? 0,
                    durationMillis: status.durationMillis ?? 0,
                },
            }));

            if (status.isPlaying) {
                setPlayingAudioKey(audioKey);
            } else if (activeAudioKeyRef.current === audioKey) {
                setPlayingAudioKey(null);
            }
        },
        [],
    );

    const stopAndUnloadAudio = useCallback(async () => {
        const active = activeAudioRef.current;
        if (!active) return;

        try {
            await active.stopAsync();
        } catch {
            // ignore
        }

        try {
            await active.unloadAsync();
        } catch {
            // ignore
        }

        activeAudioRef.current = null;
        activeAudioKeyRef.current = null;
        setPlayingAudioKey(null);
        setAudioLoadingKey(null);
    }, []);

    const seekAudioToRatio = useCallback(
        async (audioKey: string, audioUrl: string, ratio: number) => {
            let sound = activeAudioRef.current;

            if (!sound || activeAudioKeyRef.current !== audioKey) {
                await stopAndUnloadAudio();
                const created = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: false },
                    (status) => handleAudioStatusUpdate(audioKey, status),
                );
                sound = created.sound;
                activeAudioRef.current = sound;
                activeAudioKeyRef.current = audioKey;
            }

            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;

            const durationMillis =
                status.durationMillis ??
                audioProgressMap[audioKey]?.durationMillis ??
                0;
            const nextPosition = Math.round(
                Math.max(0, Math.min(1, ratio)) * durationMillis,
            );

            await sound.setPositionAsync(nextPosition);
            setAudioProgressMap((prev) => ({
                ...prev,
                [audioKey]: {
                    positionMillis: nextPosition,
                    durationMillis,
                },
            }));
        },
        [audioProgressMap, handleAudioStatusUpdate, stopAndUnloadAudio],
    );

    const seekAudioByLocation = useCallback(
        (
            audioKey: string,
            audioUrl: string,
            locationX: number,
            shouldThrottle: boolean,
        ) => {
            const trackWidth = Math.max(audioTrackWidthMap[audioKey] ?? 0, 1);
            const ratio = locationX / trackWidth;
            const clampedRatio = Math.min(1, Math.max(0, ratio));

            const nextBoundary =
                clampedRatio <= 0.02
                    ? "start"
                    : clampedRatio >= 0.98
                      ? "end"
                      : null;
            const previousBoundary =
                audioBoundaryStateRef.current[audioKey] ?? null;

            if (nextBoundary !== previousBoundary) {
                audioBoundaryStateRef.current[audioKey] = nextBoundary;
                if (nextBoundary) {
                    void Haptics.selectionAsync();
                }
            }

            if (shouldThrottle) {
                const now = Date.now();
                const last = audioSeekThrottleRef.current[audioKey] ?? 0;
                if (now - last < 120) return;
                audioSeekThrottleRef.current[audioKey] = now;
            }

            void seekAudioToRatio(audioKey, audioUrl, clampedRatio);
        },
        [audioTrackWidthMap, seekAudioToRatio],
    );

    const handleSeekInteractionStart = useCallback(
        (audioKey: string) => {
            setActiveSeekAudioKey(audioKey);
            audioSeekScale.stopAnimation();
            Animated.spring(audioSeekScale, {
                toValue: 1.07,
                speed: 28,
                bounciness: 5,
                useNativeDriver: true,
            }).start();
        },
        [audioSeekScale],
    );

    const handleSeekInteractionEnd = useCallback(() => {
        audioSeekScale.stopAnimation();
        Animated.timing(audioSeekScale, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start(() => {
            setActiveSeekAudioKey(null);
        });
    }, [audioSeekScale]);

    const handleAudioPressIn = useCallback(
        (audioKey: string) => {
            setActivePressAudioKey(audioKey);
            audioPressScale.stopAnimation();
            Animated.timing(audioPressScale, {
                toValue: 0.92,
                duration: 90,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start();
        },
        [audioPressScale],
    );

    const handleAudioPressOut = useCallback(() => {
        audioPressScale.stopAnimation();
        Animated.timing(audioPressScale, {
            toValue: 1,
            duration: 130,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start(() => {
            setActivePressAudioKey(null);
        });
    }, [audioPressScale]);

    const seekAudioByDelta = useCallback(
        async (audioKey: string, audioUrl: string, deltaMillis: number) => {
            let shouldClearLoading = false;

            try {
                let sound = activeAudioRef.current;

                if (!sound || activeAudioKeyRef.current !== audioKey) {
                    shouldClearLoading = true;
                    setAudioLoadingKey(audioKey);
                    await stopAndUnloadAudio();

                    const { sound: createdSound } =
                        await Audio.Sound.createAsync(
                            { uri: audioUrl },
                            { shouldPlay: false },
                            (status) =>
                                handleAudioStatusUpdate(audioKey, status),
                        );

                    sound = createdSound;
                    activeAudioRef.current = createdSound;
                    activeAudioKeyRef.current = audioKey;
                }

                const status = await sound.getStatusAsync();
                if (!status.isLoaded) return;

                const durationMillis =
                    status.durationMillis ??
                    audioProgressMap[audioKey]?.durationMillis ??
                    0;
                const currentPosition =
                    status.positionMillis ??
                    audioProgressMap[audioKey]?.positionMillis ??
                    0;
                const maxPosition = Math.max(durationMillis, 0);
                const unclampedNext = currentPosition + deltaMillis;
                const nextPosition =
                    maxPosition > 0
                        ? Math.min(maxPosition, Math.max(0, unclampedNext))
                        : Math.max(0, unclampedNext);

                await sound.setPositionAsync(nextPosition);

                setAudioProgressMap((prev) => ({
                    ...prev,
                    [audioKey]: {
                        positionMillis: nextPosition,
                        durationMillis,
                    },
                }));
            } catch {
                Alert.alert("Thong bao", "Khong the tua nhanh tin nhan");
            } finally {
                if (shouldClearLoading) {
                    setAudioLoadingKey(null);
                }
            }
        },
        [audioProgressMap, handleAudioStatusUpdate, stopAndUnloadAudio],
    );

    const toggleAudioPlayback = useCallback(
        async (audioKey: string, audioUrl: string, mimeType?: string) => {
            try {
                setAudioLoadingKey(audioKey);

                const shouldUseExternalPlayback =
                    isLikelyUnsupportedAudioFormat(audioUrl, mimeType);
                if (shouldUseExternalPlayback) {
                    promptExternalAudioPlayback(audioUrl);
                    return;
                }

                await ensurePlaybackAudioMode();

                if (
                    activeAudioRef.current &&
                    activeAudioKeyRef.current === audioKey
                ) {
                    const status =
                        await activeAudioRef.current.getStatusAsync();

                    handleAudioStatusUpdate(audioKey, status);

                    if (status.isLoaded && status.isPlaying) {
                        await activeAudioRef.current.pauseAsync();
                        setPlayingAudioKey(null);
                        return;
                    }

                    if (status.isLoaded) {
                        const durationMillis = status.durationMillis ?? 0;
                        const positionMillis = status.positionMillis ?? 0;
                        const isAtTrackEnd =
                            durationMillis > 0 &&
                            positionMillis >= durationMillis - 250;

                        if (isAtTrackEnd) {
                            await activeAudioRef.current.setPositionAsync(0);
                            setAudioProgressMap((prev) => ({
                                ...prev,
                                [audioKey]: {
                                    positionMillis: 0,
                                    durationMillis,
                                },
                            }));
                        }

                        await activeAudioRef.current.playAsync();
                        setPlayingAudioKey(audioKey);
                    }

                    return;
                }

                await stopAndUnloadAudio();

                const { sound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: true },
                    (status) => handleAudioStatusUpdate(audioKey, status),
                );

                activeAudioRef.current = sound;
                activeAudioKeyRef.current = audioKey;
                setPlayingAudioKey(audioKey);
            } catch {
                if (/^https?:\/\//i.test(audioUrl)) {
                    promptExternalAudioPlayback(audioUrl);
                } else {
                    Alert.alert("Thong bao", "Khong the phat tep am thanh");
                }
            } finally {
                setAudioLoadingKey(null);
            }
        },
        [
            ensurePlaybackAudioMode,
            handleAudioStatusUpdate,
            isLikelyUnsupportedAudioFormat,
            promptExternalAudioPlayback,
            stopAndUnloadAudio,
        ],
    );

    useEffect(() => {
        if (!playingAudioKey) {
            audioPlayPulse.setValue(1);
            return;
        }

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(audioPlayPulse, {
                    toValue: 1.09,
                    duration: 340,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(audioPlayPulse, {
                    toValue: 1,
                    duration: 360,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        );

        loop.start();

        return () => {
            loop.stop();
            audioPlayPulse.setValue(1);
        };
    }, [audioPlayPulse, playingAudioKey]);

    useEffect(() => {
        if (!audioLoadingKey && !playingAudioKey) {
            audioIconFade.setValue(1);
            return;
        }

        audioIconFade.setValue(0.45);
        Animated.timing(audioIconFade, {
            toValue: 1,
            duration: 170,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [audioIconFade, audioLoadingKey, playingAudioKey]);

    const getAudioWaveBars = useCallback((seedSource: string): number[] => {
        const cache = audioWaveBarsCacheRef.current;
        const cached = cache[seedSource];
        if (cached) return cached;

        const next = buildAudioWaveBars(seedSource);
        cache[seedSource] = next;

        const keys = Object.keys(cache);
        if (keys.length > 400) {
            delete cache[keys[0]];
        }

        return next;
    }, []);

    const combinedAudioIconScale = useMemo(
        () => Animated.multiply(audioPlayPulse, audioPressScale),
        [audioPlayPulse, audioPressScale],
    );

    useEffect(() => {
        return () => {
            void stopAndUnloadAudio();
        };
    }, [stopAndUnloadAudio]);

    return {
        audioPlayPulse,
        audioIconFade,
        audioPressScale,
        audioSeekScale,
        activeSeekAudioKey,
        activePressAudioKey,
        audioLoadingKey,
        playingAudioKey,
        audioProgressMap,
        audioTrackWidthMap,
        setAudioTrackWidthMap,
        stopAndUnloadAudio,
        seekAudioByLocation,
        handleSeekInteractionStart,
        handleSeekInteractionEnd,
        handleAudioPressIn,
        handleAudioPressOut,
        seekAudioByDelta,
        toggleAudioPlayback,
        getAudioWaveBars,
        combinedAudioIconScale,
    };
}
