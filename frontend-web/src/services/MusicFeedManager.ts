type MusicController = {
    play: () => void;
    pause: () => void;
};

class MusicFeedManager {
    private activeMusicId: string | null = null;
    private controllers = new Map<string, MusicController>();
    private isSuspended = false;

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

    setSuspended(suspended: boolean) {
        this.isSuspended = suspended;
        if (suspended) {
            if (this.activeMusicId) {
                this.controllers.get(this.activeMusicId)?.pause();
            }
        } else {
            if (this.activeMusicId) {
                this.controllers.get(this.activeMusicId)?.play();
            }
        }
    }

    setActiveMusic(musicId: string | null) {
        if (musicId === this.activeMusicId) {
            return;
        }

        const previousId = this.activeMusicId;
        this.activeMusicId = musicId;

        if (previousId) {
            this.controllers.get(previousId)?.pause();
        }

        if (musicId && !this.isSuspended) {
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
