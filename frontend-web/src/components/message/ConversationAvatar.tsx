import { useMemo, useState } from "react";
import { buildS3Url } from "../../utils/s3";

interface ConversationAvatarProps {
    name: string;
    avatarUrl?: string | null;
    compositeAvatarUrls?: string[];
    fallbackAvatarUrl: string;
    sizeClassName?: string;
    className?: string;
    ringClassName?: string;
}

function normalizeCompositeAvatarUrls(urls: string[] | undefined): string[] {
    if (!Array.isArray(urls)) return [];

    const uniqueUrls: string[] = [];
    const seen = new Set<string>();

    for (const rawUrl of urls) {
        const url = rawUrl?.trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        uniqueUrls.push(url);
        if (uniqueUrls.length >= 4) break;
    }

    return uniqueUrls;
}

function normalizeImageUrl(url: string | null | undefined): string | null {
    const trimmed = url?.trim();
    if (!trimmed) return null;

    if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("/")
    ) {
        return trimmed;
    }

    return buildS3Url(trimmed) || trimmed;
}

function getInitials(name: string): string {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export default function ConversationAvatar({
    name,
    avatarUrl,
    compositeAvatarUrls,
    fallbackAvatarUrl,
    sizeClassName = "h-10 w-10",
    className = "",
    ringClassName = "",
}: ConversationAvatarProps) {
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
    const normalizedAvatarUrl = normalizeImageUrl(avatarUrl);
    const normalizedFallbackAvatarUrl = normalizeImageUrl(fallbackAvatarUrl);
    const normalizedComposite = useMemo(
        () =>
            normalizeCompositeAvatarUrls(compositeAvatarUrls)
                .map(normalizeImageUrl)
                .filter((url): url is string => Boolean(url)),
        [compositeAvatarUrls],
    );

    const hasCompositeAvatar =
        !normalizedAvatarUrl && normalizedComposite.length > 0;

    const containerClass = [
        "relative overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800",
        sizeClassName,
        ringClassName,
        className,
    ]
        .filter(Boolean)
        .join(" ");

    if (hasCompositeAvatar) {
        const cells = [...normalizedComposite];
        if (cells.length === 3) {
            cells.push("");
        }

        return (
            <div className={containerClass} aria-label={name}>
                <div className="grid h-full w-full grid-cols-2 grid-rows-2">
                    {cells.map((url, index) =>
                        url && !failedUrls.has(url) ? (
                            <img
                                key={`${url}-${index}`}
                                src={url}
                                alt={name}
                                className="h-full w-full object-cover"
                                onError={() =>
                                    setFailedUrls((prev) => {
                                        const next = new Set(prev);
                                        next.add(url);
                                        return next;
                                    })
                                }
                            />
                        ) : (
                            <div
                                key={`empty-${index}`}
                                className="h-full w-full bg-gray-200 dark:bg-gray-700"
                            />
                        ),
                    )}
                </div>
            </div>
        );
    }

    const primarySrc =
        normalizedAvatarUrl && !failedUrls.has(normalizedAvatarUrl)
            ? normalizedAvatarUrl
            : null;
    const fallbackSrc =
        normalizedFallbackAvatarUrl &&
        !failedUrls.has(normalizedFallbackAvatarUrl)
            ? normalizedFallbackAvatarUrl
            : null;
    const imageSrc = primarySrc || fallbackSrc;

    if (!imageSrc) {
        return (
            <div
                className={`${containerClass} flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-200`}
                aria-label={name}
            >
                {getInitials(name)}
            </div>
        );
    }

    return (
        <img
            src={imageSrc}
            alt={name}
            className={`${containerClass} object-cover`}
            onError={() =>
                setFailedUrls((prev) => {
                    const next = new Set(prev);
                    next.add(imageSrc);
                    return next;
                })
            }
        />
    );
}
