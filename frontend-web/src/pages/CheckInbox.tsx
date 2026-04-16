import { Link } from "react-router-dom";

export default function CheckInbox() {
    return (
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#2a2a2a] rounded-lg p-10 text-center text-gray-900 dark:text-gray-100">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                    className="w-8 h-8 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                </svg>
            </div>

            <h2 className="text-xl font-semibold mb-4">Check your inbox!</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                We've sent a link to your email. Click it to continue.
            </p>

            <Link
                to="/login"
                className="text-sm text-blue-500 hover:text-blue-700 font-semibold"
            >
                Back to Login
            </Link>
        </div>
    );
}
