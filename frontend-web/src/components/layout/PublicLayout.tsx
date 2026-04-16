import { Outlet } from "react-router-dom";

export default function PublicLayout() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 text-gray-900">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2 text-gray-800">Social</h1>
                    <p className="text-gray-500 text-sm">
                        Connect with friends and the world
                    </p>
                </div>

                <Outlet />

                <footer className="mt-8 text-center">
                    <div className="text-xs text-gray-400 space-x-2">
                        <a href="#" className="hover:underline">
                            About
                        </a>
                        <span>·</span>
                        <a href="#" className="hover:underline">
                            Help
                        </a>
                        <span>·</span>
                        <a href="#" className="hover:underline">
                            Privacy
                        </a>
                        <span>·</span>
                        <a href="#" className="hover:underline">
                            Terms
                        </a>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        © 2026 SOCIAL
                    </p>
                </footer>
            </div>
        </div>
    );
}
