import { Audio } from "expo-av";
import { playAudioPreview, stopAudioPreview } from "@/services/musicService";

type MusicController = {
    play: () => void;
    pause: () => void;
};

class MusicFeedManager {
    private activeMusicId: string | null = null;
    private controllers = new Map<string, MusicController>();

    register(musicId: string, controller: MusicController) {
        this.controllers.set(musicId, controller);
    }

    unregister(musicId: string) {
        this.controllers.delete(musicId);
        if (this.activeMusicId === musicId) {
            this.activeMusicId = null;
        }
    }

    getActiveMusicId() {
        return this.activeMusicId;
    }

    setActiveMusic(musicId: string | null) {
        if (musicId === this.activeMusicId) {
            return;
        }

        const previousId = this.activeMusicId;
        this.activeMusicId = musicId;

        // Pause previous
        if (previousId) {
            this.controllers.get(previousId)?.pause();
        }

        // Play new
        if (musicId) {
            this.controllers.get(musicId)?.play();
        }
    }

    pauseIfActive(musicId: string) {
        if (this.activeMusicId !== musicId) {
            return;
        }
        this.setActiveMusic(null);
    }
}

export const musicFeedManager = new MusicFeedManager();