import {
    AppNotification,
    Conversation,
    IgtvVideo,
    Message,
    Post,
    Story,
    User,
} from "@/types";

export const mockUsers: User[] = [
    {
        id: "u1",
        username: "jessie.dev",
        fullName: "Jessie Nguyen",
        bio: "Building mobile apps with React Native.",
        avatar:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
        followers: 15420,
        following: 381,
        website: "https://example.dev/jessie",
    },
    {
        id: "u2",
        username: "mike.design",
        fullName: "Mike Tran",
        bio: "UI designer. Coffee lover.",
        avatar:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
        followers: 8421,
        following: 240,
    },
    {
        id: "u3",
        username: "lina.travel",
        fullName: "Lina Hoang",
        bio: "Travel and life moments.",
        avatar:
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
        followers: 23901,
        following: 810,
    },
    {
        id: "u4",
        username: "dev.an",
        fullName: "An Pham",
        bio: "Full-stack engineer.",
        avatar:
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
        followers: 3920,
        following: 610,
    },
    {
        id: "u5",
        username: "hana.foodie",
        fullName: "Ha Na",
        bio: "Food photography in Saigon.",
        avatar:
            "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=300&q=80",
        followers: 11200,
        following: 456,
    },
    {
        id: "u6",
        username: "minh.video",
        fullName: "Minh Le",
        bio: "Vertical videos and stories.",
        avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
        followers: 9812,
        following: 302,
    },
];

export const mockStories: Story[] = [
    {
        id: "s1",
        userId: "u1",
        image:
            "https://images.unsplash.com/photo-1529429617124-aee711eb31c3?auto=format&fit=crop&w=900&q=80",
        viewed: false,
        createdAt: "2026-04-08T09:00:00.000Z",
    },
    {
        id: "s2",
        userId: "u2",
        image:
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
        viewed: false,
        createdAt: "2026-04-08T10:20:00.000Z",
    },
    {
        id: "s3",
        userId: "u3",
        image:
            "https://images.unsplash.com/photo-1511732351661-53a63a3152d1?auto=format&fit=crop&w=900&q=80",
        viewed: true,
        createdAt: "2026-04-08T12:00:00.000Z",
    },
    {
        id: "s4",
        userId: "u4",
        image:
            "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
        viewed: false,
        createdAt: "2026-04-08T14:15:00.000Z",
    },
    {
        id: "s5",
        userId: "u5",
        image:
            "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=900&q=80",
        viewed: false,
        createdAt: "2026-04-08T15:00:00.000Z",
    },
];

export const mockPosts: Post[] = [
    {
        id: "p1",
        userId: "u2",
        image:
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
        caption: "Design system update for the next release.",
        likes: 321,
        comments: [
            {
                id: "c1",
                userId: "u1",
                content: "Clean and sharp!",
                createdAt: "2026-04-08T08:30:00.000Z",
            },
        ],
        createdAt: "2026-04-08T07:30:00.000Z",
    },
    {
        id: "p2",
        userId: "u3",
        image:
            "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
        caption: "Sunrise from Da Lat this morning.",
        likes: 1291,
        comments: [
            {
                id: "c2",
                userId: "u4",
                content: "Need this trip soon.",
                createdAt: "2026-04-08T09:40:00.000Z",
            },
            {
                id: "c3",
                userId: "u5",
                content: "The colors are unreal.",
                createdAt: "2026-04-08T09:48:00.000Z",
            },
        ],
        createdAt: "2026-04-08T09:10:00.000Z",
    },
    {
        id: "p3",
        userId: "u5",
        image:
            "https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=1200&q=80",
        caption: "Weekend brunch special with friends.",
        likes: 672,
        comments: [],
        createdAt: "2026-04-08T11:00:00.000Z",
    },
    {
        id: "p4",
        userId: "u6",
        image:
            "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80",
        caption: "Short reel setup for tonight's live stream.",
        likes: 508,
        comments: [
            {
                id: "c4",
                userId: "u1",
                content: "Drop the tutorial please.",
                createdAt: "2026-04-08T13:12:00.000Z",
            },
        ],
        createdAt: "2026-04-08T13:00:00.000Z",
    },
    {
        id: "p5",
        userId: "u1",
        image:
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
        caption: "Expo Router setup done. Shipping soon.",
        likes: 845,
        comments: [
            {
                id: "c5",
                userId: "u2",
                content: "Great progress!",
                createdAt: "2026-04-08T16:18:00.000Z",
            },
        ],
        createdAt: "2026-04-08T16:00:00.000Z",
    },
];

// export const mockNotifications: AppNotification[] = [
//     {
//         id: "n1",
//         type: "like",
//         userId: "u2",
//         postId: "p5",
//         message: "liked your photo.",
//         createdAt: "2026-04-08T16:30:00.000Z",
//         read: false,
//     },
//     {
//         id: "n2",
//         type: "follow",
//         userId: "u4",
//         message: "started following you.",
//         createdAt: "2026-04-08T14:10:00.000Z",
//         read: false,
//     },
//     {
//         id: "n3",
//         type: "comment",
//         userId: "u3",
//         postId: "p5",
//         message: "commented: Nice setup!",
//         createdAt: "2026-04-08T11:40:00.000Z",
//         read: true,
//     },
// ];

export const mockConversations: Conversation[] = [
    {
        id: "cv1",
        participantIds: ["u1", "u2"],
        lastMessage: "See you in the meeting later.",
        updatedAt: "2026-04-08T17:00:00.000Z",
    },
    {
        id: "cv2",
        participantIds: ["u1", "u3"],
        lastMessage: "That place looks amazing!",
        updatedAt: "2026-04-08T15:20:00.000Z",
    },
    {
        id: "cv3",
        participantIds: ["u1", "u5"],
        lastMessage: "New cafe recommendation incoming.",
        updatedAt: "2026-04-08T13:15:00.000Z",
    },
];

export const mockMessages: Message[] = [
    {
        id: "m1",
        conversationId: "cv1",
        senderId: "u2",
        content: "Can you review the design handoff?",
        createdAt: "2026-04-08T16:40:00.000Z",
    },
    {
        id: "m2",
        conversationId: "cv1",
        senderId: "u1",
        content: "Sure, I will do it in 10 mins.",
        createdAt: "2026-04-08T16:45:00.000Z",
    },
    {
        id: "m3",
        conversationId: "cv1",
        senderId: "u2",
        content: "See you in the meeting later.",
        createdAt: "2026-04-08T17:00:00.000Z",
    },
    {
        id: "m4",
        conversationId: "cv2",
        senderId: "u3",
        content: "Just landed in Da Lat.",
        createdAt: "2026-04-08T15:05:00.000Z",
    },
    {
        id: "m5",
        conversationId: "cv2",
        senderId: "u1",
        content: "That place looks amazing!",
        createdAt: "2026-04-08T15:20:00.000Z",
    },
    {
        id: "m6",
        conversationId: "cv3",
        senderId: "u5",
        content: "New cafe recommendation incoming.",
        createdAt: "2026-04-08T13:15:00.000Z",
    },
];

export const mockIgtvVideos: IgtvVideo[] = [
    {
        id: "v1",
        title: "How I edit short videos on mobile",
        thumbnail:
            "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80",
        duration: "08:42",
        views: 14500,
        userId: "u6",
        description: "A quick breakdown of my editing workflow.",
    },
    {
        id: "v2",
        title: "Morning routine for creators",
        thumbnail:
            "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
        duration: "06:11",
        views: 9800,
        userId: "u3",
        description: "Simple habits for consistent posting.",
    },
    {
        id: "v3",
        title: "Instagram growth Q&A",
        thumbnail:
            "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
        duration: "12:30",
        views: 24100,
        userId: "u1",
        description: "Answering your top growth questions.",
    },
];

export const mockSavedPostIds = ["p2", "p3"];
export const mockLikedPostIds = ["p1", "p5"];

export const defaultCurrentUserId = "u1";
