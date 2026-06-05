// Mock Users
export const mockUsers = [
    {
        id: 1,
        username: 'john_doe',
        fullName: 'John Doe',
        avatarUrl: 'https://i.pravatar.cc/150?img=1',
        bio: 'Photography enthusiast 📷 | Travel lover ✈️',
        isVerified: true,
        followersCount: 1234,
        followingCount: 567,
        postsCount: 89,
    },
    {
        id: 2,
        username: 'jane_smith',
        fullName: 'Jane Smith',
        avatarUrl: 'https://i.pravatar.cc/150?img=2',
        bio: 'Digital artist 🎨 | Coffee addict ☕',
        followersCount: 2345,
        followingCount: 123,
        postsCount: 145,
    },
    {
        id: 3,
        username: 'mike_wilson',
        fullName: 'Mike Wilson',
        avatarUrl: 'https://i.pravatar.cc/150?img=3',
        bio: 'Fitness coach 💪 | Healthy lifestyle',
        followersCount: 5678,
        followingCount: 234,
        postsCount: 234,
    },
    {
        id: 4,
        username: 'sarah_jones',
        fullName: 'Sarah Jones',
        avatarUrl: 'https://i.pravatar.cc/150?img=4',
        bio: 'Fashion designer 👗 | Style blogger',
        isVerified: true,
        followersCount: 8901,
        followingCount: 345,
        postsCount: 567,
    },
    {
        id: 5,
        username: 'robert_fox',
        fullName: 'Robert Fox',
        avatarUrl: 'https://i.pravatar.cc/150?img=5',
        bio: 'Software Engineer 💻 | Tech enthusiast',
        followersCount: 456,
        followingCount: 789,
        postsCount: 45,
    },
];

// Current User (logged in user)
export const currentUser = mockUsers[4]; // Robert Fox

// Mock Posts
export const mockPosts = [
    {
        id: '1',
        user: mockUsers[0],
        images: [
            'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
        ],
        caption: 'Beautiful sunset at the mountains 🏔️ #nature #photography',
        likes: 1234,
        comments: [
            {
                id: 'c1',
                user: mockUsers[1],
                text: 'Amazing shot!',
                createdAt: '2h ago',
                likes: 12,
            },
            {
                id: 'c2',
                user: mockUsers[2],
                text: 'Love this! 😍',
                createdAt: '1h ago',
                likes: 5,
            },
        ],
        createdAt: '3h ago',
        isLiked: false,
        isSaved: false,
        privacy: 'PUBLIC' as const,
    },
    {
        id: '2',
        user: mockUsers[1],
        images: [
            'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800',
        ],
        caption: 'Coffee and art, perfect combination ☕🎨',
        likes: 567,
        comments: [],
        createdAt: '5h ago',
        isLiked: true,
        isSaved: false,
        privacy: 'FRIENDS' as const,
    },
    {
        id: '3',
        user: mockUsers[2],
        images: [
            'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
        ],
        caption: 'Morning workout done! 💪 #fitness #motivation',
        likes: 2341,
        comments: [
            {
                id: 'c3',
                user: mockUsers[3],
                text: 'Keep it up! 🔥',
                createdAt: '30m ago',
                likes: 8,
            },
        ],
        createdAt: '6h ago',
        isLiked: true,
        isSaved: true,
        privacy: 'PUBLIC' as const,
    },
    {
        id: '4',
        user: mockUsers[3],
        images: [
            'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
        ],
        caption: 'New collection coming soon! 👗✨ #fashion #style',
        likes: 4567,
        comments: [],
        createdAt: '8h ago',
        isLiked: false,
        isSaved: false,
        privacy: 'ONLY_ME' as const,
    },
    {
        id: '5',
        user: mockUsers[0],
        images: [
            'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
        ],
        caption: 'Exploring new places 🌍 #travel #adventure',
        likes: 890,
        comments: [
            {
                id: 'c4',
                user: mockUsers[4],
                text: 'Where is this?',
                createdAt: '2h ago',
                likes: 3,
            },
            {
                id: 'c5',
                user: mockUsers[0],
                text: '@robert_fox Norway!',
                createdAt: '1h ago',
                likes: 2,
            },
        ],
        createdAt: '12h ago',
        isLiked: false,
        isSaved: true,
        privacy: 'SPECIFIC' as const,
    },
];

// Mock Stories
export const mockStories = [
    {
        id: 's1',
        user: mockUsers[0],
        image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300',
        createdAt: '2h ago',
        isViewed: false,
    },
    {
        id: 's2',
        user: mockUsers[1],
        image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300',
        createdAt: '4h ago',
        isViewed: true,
    },
    {
        id: 's3',
        user: mockUsers[2],
        image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=300',
        createdAt: '6h ago',
        isViewed: false,
    },
    {
        id: 's4',
        user: mockUsers[3],
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300',
        createdAt: '8h ago',
        isViewed: false,
    },
];

// Mock Chats
const mockMessages = [
    {
        id: 'm1',
        senderId: '1',
        text: 'Hey! How are you?',
        createdAt: '10:30 AM',
        isRead: true,
    },
    {
        id: 'm2',
        senderId: '5',
        text: "I'm good, thanks! How about you?",
        createdAt: '10:32 AM',
        isRead: true,
    },
    {
        id: 'm3',
        senderId: '1',
        text: 'Doing great! Want to grab coffee later?',
        createdAt: '10:35 AM',
        isRead: true,
    },
];

export const mockChats = [
    {
        id: '1',
        user: mockUsers[0],
        lastMessage: mockMessages[2],
        unreadCount: 2,
    },
    {
        id: '2',
        user: mockUsers[1],
        lastMessage: {
            id: 'm4',
            senderId: '2',
            text: 'Thanks for the advice!',
            createdAt: '9:15 AM',
            isRead: true,
        },
        unreadCount: 0,
    },
    {
        id: '3',
        user: mockUsers[2],
        lastMessage: {
            id: 'm5',
            senderId: '3',
            text: 'See you at the gym! 💪',
            createdAt: 'Yesterday',
            isRead: true,
        },
        unreadCount: 0,
    },
    {
        id: '4',
        user: mockUsers[3],
        lastMessage: {
            id: 'm6',
            senderId: '5',
            text: 'Love your new design!',
            createdAt: '2d ago',
            isRead: true,
        },
        unreadCount: 0,
    },
];

// Get messages for a specific chat
export const getMessagesForChat = (chatId: string) => {
    if (chatId === '1') {
        return mockMessages;
    }
    return [
        {
            id: 'm_' + chatId,
            senderId: chatId,
            text: 'Hey there!',
            createdAt: '10:00 AM',
            isRead: true,
        },
    ];
};

// Mock Notifications
export const mockNotifications = [
    {
        id: 'n1',
        type: 'REACTION_POST' as const,
        actorIds: ['1'],
        recipientId: '5',
        content: 'liked your photo.',
        createdAt: '5m ago',
        isRead: false,
    },
    {
        id: 'n2',
        type: 'COMMENT_POST' as const,
        actorIds: ['2'],
        recipientId: '5',
        content: 'commented: "Amazing work!"',
        createdAt: '15m ago',
        isRead: false,
    },
    {
        id: 'n3',
        type: 'FRIEND_REQUEST' as const,
        actorIds: ['3'],
        recipientId: '5',
        content: 'started following you.',
        createdAt: '1h ago',
        isRead: true,
    },
    {
        id: 'n4',
        type: 'REACTION_POST' as const,
        actorIds: ['4'],
        recipientId: '5',
        content: 'liked your photo.',
        createdAt: '2h ago',
        isRead: true,
    },
    {
        id: 'n5',
        type: 'COMMENT_MENTION' as const,
        actorIds: ['1'],
        recipientId: '5',
        content: 'mentioned you in a comment.',
        createdAt: '5h ago',
        isRead: true,
    },
];

// Suggestions (users to follow)
export const suggestedUsers = [
    {
        id: 6,
        username: 'emma_watson',
        fullName: 'Emma Watson',
        avatarUrl: 'https://i.pravatar.cc/150?img=6',
        bio: 'Actress & Activist',
        isVerified: true,
        followersCount: 50000,
        followingCount: 200,
        postsCount: 320,
    },
    {
        id: 7,
        username: 'david_miller',
        fullName: 'David Miller',
        avatarUrl: 'https://i.pravatar.cc/150?img=7',
        bio: 'Food blogger 🍕',
        followersCount: 3456,
        followingCount: 567,
        postsCount: 234,
    },
    {
        id: 8,
        username: 'lisa_brown',
        fullName: 'Lisa Brown',
        avatarUrl: 'https://i.pravatar.cc/150?img=8',
        bio: 'Yoga instructor 🧘‍♀️',
        followersCount: 2345,
        followingCount: 345,
        postsCount: 156,
    },
];
