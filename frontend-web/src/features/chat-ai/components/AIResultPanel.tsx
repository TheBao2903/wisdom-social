interface AIResultPanelProps {
    summary: string | null;
    suggestions: string[];
    error: string | null;
    isSummarizing: boolean;
    isSuggesting: boolean;
    onSuggestionClick: (suggestion: string) => void;
}

export default function AIResultPanel({
    summary,
    suggestions,
    error,
    isSummarizing,
    isSuggesting,
    onSuggestionClick,
}: AIResultPanelProps) {
    const isEmpty = !summary && suggestions.length === 0 && !error;

    return (
        <div className="mt-1.5 rounded-md bg-white px-2 py-1.5 dark:border-t dark:border-gray-700/70 dark:bg-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Kết quả AI
            </p>

            {error && (
                <p className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-600 dark:border-red-900/70 dark:bg-red-950 dark:text-red-400">
                    {error}
                </p>
            )}

            {isEmpty && (
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Dùng AI để tóm tắt cuộc trò chuyện hoặc nhận gợi ý phản hồi
                    nhanh.
                </p>
            )}

            {(isSummarizing || summary) && (
                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                        Tóm tắt cuộc trò chuyện
                    </p>
                    <div className="mt-0.5">
                        {isSummarizing ? (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Đang tạo tóm tắt...
                            </p>
                        ) : (
                            <p className="text-[11px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                {summary}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {(isSuggesting || suggestions.length > 0) && (
                <div className="mt-2">
                    <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                        Gợi ý trả lời
                    </p>
                    {isSuggesting ? (
                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            Đang tạo gợi ý...
                        </p>
                    ) : (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() =>
                                        onSuggestionClick(suggestion)
                                    }
                                    className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
