import { mockPosts } from "../api/mockData";
import {
    Heart,
    MessageCircle,
    Send,
    Bookmark,
    MoreHorizontal,
    Volume2,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Reels() {
    // Use posts as reels for demo
    const reels = mockPosts.slice(0, 3);

    return (
        <div className="max-w-[500px] mx-auto bg-black min-h-screen">
            {/* Reels Container */}
            <div className="space-y-1">
                {reels.map((reel) => (
                    <div
                        key={reel.id}
                        className="relative h-[calc(100vh-100px)] bg-black"
                    >
                        {/* Video/Image */}
                        <img
                            src={reel.images[0]}
                            alt={reel.caption}
                            className="w-full h-full object-cover"
                        />

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

                        {/* Header */}
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white">
                            <h1 className="text-2xl font-semibold">Reels</h1>
                            <button className="p-2">
                                <MoreHorizontal size={24} />
                            </button>
                        </div>

                        {/* Bottom Info */}
                        <div className="absolute bottom-4 left-4 right-20 text-white">
                            {/* User Info */}
                            <Link
                                to={`/profile/${reel.user.username}`}
                                className="flex items-center gap-2 mb-3"
                            >
                                <img
                                    src={reel.user.avatarUrl}
                                    alt={reel.user.username}
                                    className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                />
                                <span className="font-semibold text-sm">
                                    {reel.user.username}
                                </span>
                                <button className="ml-2 px-4 py-1 border border-white rounded-lg text-sm font-semibold hover:bg-white/10">
                                    Follow
                                </button>
                            </Link>

                            {/* Caption */}
                            <p className="text-sm mb-2">{reel.caption}</p>

                            {/* Audio */}
                            <div className="flex items-center gap-2 text-xs">
                                <Volume2 size={14} />
                                <span>Original audio</span>
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="absolute bottom-4 right-4 flex flex-col gap-6 items-center text-white">
                            <button className="flex flex-col items-center gap-1">
                                <Heart
                                    size={28}
                                    fill={reel.isLiked ? "white" : "none"}
                                    className={
                                        reel.isLiked ? "text-red-500" : ""
                                    }
                                />
                                <span className="text-xs font-semibold">
                                    {reel.likes.toLocaleString()}
                                </span>
                            </button>

                            <button className="flex flex-col items-center gap-1">
                                <MessageCircle size={28} />
                                <span className="text-xs font-semibold">
                                    {reel.comments.length}
                                </span>
                            </button>

                            <button className="flex flex-col items-center gap-1">
                                <Send size={28} />
                            </button>

                            <button className="flex flex-col items-center gap-1">
                                <Bookmark
                                    size={28}
                                    fill={reel.isSaved ? "white" : "none"}
                                />
                            </button>

                            <button className="flex flex-col items-center gap-1">
                                <MoreHorizontal size={28} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
