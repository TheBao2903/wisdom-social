import { MessageCircle } from "lucide-react";

export default function MessagesEmptyState() {
    return (
        <div className="py-6">
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#262626] rounded-lg h-[calc(100vh-120px)] flex items-center justify-center text-gray-900 dark:text-gray-100">
                <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-black dark:border-gray-200 flex items-center justify-center">
                        <MessageCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-light mb-2">Your Messages</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Send private photos and messages to a friend or group
                    </p>
                    <button className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">
                        Send Message
                    </button>
                </div>
            </div>
        </div>
    );
}
