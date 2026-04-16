interface AIConsentModalProps {
    open: boolean;
    loading?: boolean;
    error?: string | null;
    onAccept: () => void;
    onDecline: () => void;
}

export default function AIConsentModal({
    open,
    loading = false,
    error,
    onAccept,
    onDecline,
}: AIConsentModalProps) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Xác nhận sử dụng AI
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-6">
                    Để tạo tóm tắt và gợi ý trả lời, một phần nội dung cuộc trò
                    chuyện sẽ được gửi tới AI provider theo chính sách hệ thống.
                </p>

                {error && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onDecline}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                    >
                        Từ chối
                    </button>
                    <button
                        type="button"
                        onClick={onAccept}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {loading ? "Đang xử lý..." : "Đồng ý"}
                    </button>
                </div>
            </div>
        </div>
    );
}
