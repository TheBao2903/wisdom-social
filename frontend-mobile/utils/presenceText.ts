export function formatLastActiveText(
    lastActiveAt?: string | null,
    now: number = Date.now(),
): string | null {
    if (!lastActiveAt) return null;

    const lastActiveTime = new Date(lastActiveAt).getTime();
    if (!Number.isFinite(lastActiveTime)) return null;

    const diffMs = Math.max(0, now - lastActiveTime);
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return "Vừa hoạt động";
    if (minutes < 60) return `Hoạt động ${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hoạt động ${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    return `Hoạt động ${days} ngày trước`;
}
