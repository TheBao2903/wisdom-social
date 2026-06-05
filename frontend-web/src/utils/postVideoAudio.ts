type MusicAudioConfig = {
  audioUrl?: string;
  muteOriginal?: boolean;
  originalVolume?: number;
} | null | undefined;

export interface VideoAudioState {
  shouldMuteOriginal: boolean;
  locked: boolean;
  volume: number;
  defaultMuted: boolean;
}

export const shouldMuteOriginalVideo = (music?: MusicAudioConfig): boolean => {
  if (!music) return false;

  const muteOriginalRaw = (music as { muteOriginal?: unknown }).muteOriginal;
  const muteOriginalFlag =
    muteOriginalRaw === true ||
    muteOriginalRaw === "true" ||
    muteOriginalRaw === 1 ||
    muteOriginalRaw === "1";

  const originalVolumeRaw = (music as { originalVolume?: unknown }).originalVolume;
  const originalVolumeNumber =
    typeof originalVolumeRaw === "number"
      ? originalVolumeRaw
      : typeof originalVolumeRaw === "string"
      ? Number(originalVolumeRaw)
      : NaN;
  const isOriginalVolumeZero = Number.isFinite(originalVolumeNumber) && originalVolumeNumber <= 0;

  return muteOriginalFlag || isOriginalVolumeZero || Boolean(music.audioUrl);
};

export const getVideoAudioState = (music?: MusicAudioConfig): VideoAudioState => {
  const shouldMuteOriginal = shouldMuteOriginalVideo(music);

  // Keep video controls enabled so users can still scrub/see duration.
  // Only mute original audio when music overlay is active.
  if (shouldMuteOriginal) {
    return {
      shouldMuteOriginal: true,
      locked: false,
      volume: 0,
      defaultMuted: true,
    };
  }

  const configuredVolume =
    typeof music?.originalVolume === "number"
      ? Math.min(1, Math.max(0, music.originalVolume / 100))
      : 1;

  return {
    shouldMuteOriginal: false,
    locked: false,
    volume: configuredVolume,
    defaultMuted: false,
  };
};

export const enforceVideoAudioState = (
  video: HTMLVideoElement | null,
  state: VideoAudioState
) => {
  if (!video) return;

  video.defaultMuted = state.defaultMuted;
  video.muted = state.shouldMuteOriginal;
  video.volume = state.shouldMuteOriginal ? 0 : state.volume;

  if (state.locked) {
    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;
  }
};
