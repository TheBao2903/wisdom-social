/*
 * @ (#) Page.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.nosql.embeddable.ContactInfo;
import iuh.fit.edu.backend.domain.entity.nosql.embeddable.CoverImage;
import iuh.fit.edu.backend.domain.entity.nosql.embeddable.SocialStats;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/*
 * @description: Page entity - Trang mạng xã hội (Fanpage, Business Page)
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Document(collection = "pages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Page {

    @org.springframework.data.annotation.Id
    private String id;

    @Indexed
    private String name; // Tên trang

    @Indexed
    private String username; // Username duy nhất (vd: @coca-cola)

    @Indexed
    private String slug; // URL-friendly name

    private String bio; // Mô tả ngắn

    private String about; // Mô tả chi tiết về trang

    private String avatarUrl; // Ảnh đại diện trang

    private CoverImage coverImage; // Ảnh bìa trang

    // Category và loại trang
    @Indexed
    private String category; // Business, Brand, Community, Entertainment, etc.

    private String subCategory; // Phân loại chi tiết hơn

    // Verification
    private boolean isVerified; // Trang đã xác minh (dấu tick xanh)
    private boolean isOfficial; // Trang chính thức

    // Người quản lý trang
    private List<PageAdmin> admins; // Danh sách admin/editor

    @Indexed
    private String ownerId; // Chủ sở hữu chính

    // Followers
    private List<String> followerIds; // Danh sách người theo dõi (có thể lưu trong collection riêng nếu lớn)

    // Thông tin liên hệ
    private ContactInfo contactInfo;

    // Social links
    private List<SocialLink> socialLinks; // Facebook, Instagram, Twitter, etc.

    // Giờ mở cửa (cho business page)
    private BusinessHours businessHours;

    // Thống kê
    private SocialStats stats; // Thống kê trang

    // Page settings
    private PageSettings settings;

    // Tags
    private List<String> tags; // Tags liên quan

    // Trạng thái
    private StatusType status; // ACTIVE | SUSPENDED | DELETED

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;

    // Call to action
    private CallToAction callToAction; // Button CTA (Shop Now, Learn More, etc.)
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class PageAdmin {
    private String userId;
    private String role; // OWNER | ADMIN | EDITOR | MODERATOR | ANALYST
    private List<String> permissions; // Quyền cụ thể (POST, REPLY, INSIGHTS, etc.)
    private Instant addedAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class SocialLink {
    private String platform; // facebook, instagram, twitter, youtube, etc.
    private String url;
    private String username;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class BusinessHours {
    private boolean isAlwaysOpen; // Mở cửa 24/7
    private List<DayHours> schedule; // Lịch mở cửa theo ngày
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class DayHours {
    private String day; // MONDAY, TUESDAY, etc.
    private boolean isClosed; // Đóng cửa trong ngày này
    private String openTime; // "09:00"
    private String closeTime; // "18:00"
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class PageSettings {
    private boolean allowComments; // Cho phép bình luận
    private boolean allowReactions; // Cho phép reaction
    private boolean allowMessages; // Cho phép nhắn tin
    private boolean autoReply; // Tự động trả lời tin nhắn
    private String autoReplyMessage; // Nội dung tin nhắn tự động
    private boolean requireReview; // Yêu cầu duyệt bài viết
    private boolean showFollowerCount; // Hiển thị số lượng người theo dõi
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class CallToAction {
    private String type; // SHOP_NOW, LEARN_MORE, SIGN_UP, BOOK_NOW, CONTACT_US, etc.
    private String label; // Text hiển thị trên button
    private String url; // Link đến
    private boolean isActive; // Đang kích hoạt
}
