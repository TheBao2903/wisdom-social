/**
 * Trình phát nhạc singleton (ngoài React) để trạng thái phát được giữ nguyên
 * khi điều hướng giữa các trang.
 *
 * Dùng DUY NHẤT một thẻ <audio> và lưu trên globalThis nên:
 *  - Không bao giờ có nhiều audio "mồ côi" chạy song song -> pause luôn dừng được.
 *  - Sống sót qua hot-reload (HMR) lúc phát triển.
 *
 * Component đăng ký qua subscribe() và đọc bài đang phát bằng getPlayingId().
 */

interface PlayerState {
  el: HTMLAudioElement | null;
  id: string | null;
}

const G = globalThis as unknown as { __wisdomAudioState__?: PlayerState };
const state: PlayerState = (G.__wisdomAudioState__ ??= { el: null, id: null });

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Lấy (tạo nếu chưa có) thẻ audio duy nhất. */
function getEl(): HTMLAudioElement {
  if (!state.el) {
    const el = new Audio();
    el.addEventListener('ended', () => {
      state.id = null;
      emit();
    });
    state.el = el;
  }
  return state.el;
}

export const audioPlayer = {
  getPlayingId(): string | null {
    return state.id;
  },

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },

  /**
   * Phát / tạm dừng một bài. Nếu bài đang phát chính là `id` thì dừng lại.
   * @param onError gọi khi không thể phát (URL lỗi / autoplay bị chặn)
   */
  toggle(id: string, src: string, onError?: () => void): void {
    const el = getEl();

    // Đang phát chính bài này -> dừng
    if (state.id === id) {
      el.pause();
      state.id = null;
      emit();
      return;
    }

    // Phát bài mới trên cùng một thẻ audio
    el.pause();
    if (src) {
      el.src = src;
      el.currentTime = 0;
      el.play().catch(() => {
        if (state.id === id) {
          state.id = null;
          emit();
        }
        onError?.();
      });
    }
    state.id = id;
    emit();
  },

  stop(): void {
    state.el?.pause();
    state.id = null;
    emit();
  },
};
