export function formatRelativeTime(value: string): string {
    const date = new Date(value).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - date);
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return new Date(value).toLocaleDateString();
}

export function compactNumber(value: number): string {
    if (value < 1000) return `${value}`;
    if (value < 1000000) return `${(value / 1000).toFixed(1)}k`;
    return `${(value / 1000000).toFixed(1)}m`;
}
