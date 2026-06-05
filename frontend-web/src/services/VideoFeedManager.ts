type VideoController = {
    play: () => void;
    pause: () => void;
};

class VideoFeedManager {
    private activeVideoId: string | null = null;
    private controllers = new Map<string, VideoController>();

    register(videoId: string, controller: VideoController) {
        this.controllers.set(videoId, controller);
    }

    unregister(videoId: string) {
        this.controllers.delete(videoId);
        if (this.activeVideoId === videoId) {
            this.activeVideoId = null;
        }
    }

    getActiveVideoId() {
        return this.activeVideoId;
    }

    setActiveVideo(videoId: string | null) {
        if (videoId === this.activeVideoId) {
            return;
        }

        const previousId = this.activeVideoId;
        this.activeVideoId = videoId;

        if (previousId) {
            this.controllers.get(previousId)?.pause();
        }

        if (videoId) {
            this.controllers.get(videoId)?.play();
        }
    }

    pauseIfActive(videoId: string) {
        if (this.activeVideoId !== videoId) {
            return;
        }
        this.setActiveVideo(null);
    }
}

export const videoFeedManager = new VideoFeedManager();
