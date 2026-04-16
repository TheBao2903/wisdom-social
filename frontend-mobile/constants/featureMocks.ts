import { PageData } from "@/services/pageService";

export type MockFriendUser = {
    id: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
    phone?: string;
};

export const mockFeaturePages: PageData[] = [
    {
        id: 1001,
        name: "Wisdom Community",
        username: "wisdom.community",
        category: "Education",
        description: "Noi chia se kien thuc va kinh nghiem hoc tap.",
        status: "PUBLIC",
        createdBy: { id: 1, name: "Admin" },
    },
    {
        id: 1002,
        name: "Travel With Friends",
        username: "travel.friends",
        category: "Travel",
        description: "Chia se lich trinh va anh dep moi hanh trinh.",
        status: "PUBLIC",
        createdBy: { id: 2, name: "Moderator" },
    },
    {
        id: 1003,
        name: "Hidden Book Club",
        username: "hidden.book.club",
        category: "Books",
        description: "Cong dong doc sach voi cac chu de hang tuan.",
        status: "PRIVATE",
        createdBy: { id: 3, name: "Owner" },
    },
];

export const mockPageInteractions: Record<
    number,
    {
        isLiked: boolean;
        isFollowing: boolean;
        likeCount: number;
        followCount: number;
    }
> = {
    1001: { isLiked: false, isFollowing: true, likeCount: 124, followCount: 88 },
    1002: { isLiked: true, isFollowing: true, likeCount: 267, followCount: 153 },
    1003: { isLiked: false, isFollowing: false, likeCount: 41, followCount: 30 },
};

export const mockFeatureFriends: MockFriendUser[] = [
    { id: 101, name: "Nguyen Minh", username: "nguyenminh", phone: "0911222333" },
    { id: 102, name: "Tran Linh", username: "tranlinh", phone: "0933444555" },
    { id: 103, name: "Le Khanh", username: "lekhanh", phone: "0977666111" },
];

export const mockFeatureRequests: MockFriendUser[] = [
    { id: 104, name: "Pham Quang", username: "phamquang", phone: "0988777666" },
    { id: 105, name: "Do Anh", username: "doanh", phone: "0909555444" },
];

export const mockFeatureBlocked: MockFriendUser[] = [
    { id: 106, name: "Blocked User", username: "blocked.user", phone: "0900000000" },
];
