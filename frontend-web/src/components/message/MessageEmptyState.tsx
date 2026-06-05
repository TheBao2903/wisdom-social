export default function MessageEmptyState() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-black">
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="dark:stroke-white"
                    >
                        <path
                            d="M12 21L3 13V3h18v10l-9 8z"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                    </svg>
                </div>
                <h3 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    Tin nhắn của bạn
                </h3>
                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                    Gửi ảnh và tin nhắn riêng tư cho bạn bè hoặc nhóm.
                </p>
                <button className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                    Gửi tin nhắn
                </button>
            </div>
        </div>
    );
}
