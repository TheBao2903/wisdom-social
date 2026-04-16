import { Phone, PhoneOff, Video } from "lucide-react";

interface IncomingCallModalProps {
    open: boolean;
    callerName: string;
    callType: "audio" | "video";
    onAccept: () => void;
    onReject: () => void;
    acceptLabel?: string;
}

export default function IncomingCallModal({
    open,
    callerName,
    callType,
    onAccept,
    onReject,
    acceptLabel = "Chấp nhận",
}: IncomingCallModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300">
                    {callType === "video" ? (
                        <Video size={24} />
                    ) : (
                        <Phone size={24} />
                    )}
                </div>

                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    Cuộc gọi đến
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {callerName} đang gọi{" "}
                    {callType === "video" ? "video" : "thoại"}
                </p>

                <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                        type="button"
                        onClick={onReject}
                        className="h-11 w-11 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                        title="Từ chối"
                    >
                        <PhoneOff size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onAccept}
                        className="h-11 min-w-11 px-4 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                        title={acceptLabel}
                    >
                        {callType === "video" ? (
                            <Video size={18} />
                        ) : (
                            <Phone size={18} />
                        )}
                        <span className="text-sm font-medium">
                            {acceptLabel}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
