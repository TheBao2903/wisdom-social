/*
 * @ (#) Group.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.constant.StatusType;
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
 * @description: Group entity - Nhóm mạng xã hội
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Document(collection = "groups")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Group {

    @org.springframework.data.annotation.Id
    private String id;

    @Indexed
    private String name; // Tên nhóm

    @Indexed
    private String slug; // URL-friendly name (vd: "java-developers-vietnam")

    private String description; // Mô tả nhóm

    private String avatarUrl; // Ảnh đại diện nhóm

    private CoverImage coverImage; // Ảnh bìa nhóm

    // Quyền riêng tư
    private PrivacyType privacy; // PUBLIC | PRIVATE | SECRET

    // Thành viên
    private List<GroupMember> members; // Danh sách thành viên

    private List<String> adminIds; // Danh sách admin

    private List<String> moderatorIds; // Danh sách moderator

    // Quy tắc và cài đặt nhóm
    private List<GroupRule> rules; // Quy tắc nhóm

    private GroupSettings settings; // Cài đặt nhóm

    // Tags và category
    private String category; // Category của nhóm (Technology, Sports, etc.)

    private List<String> tags; // Tags liên quan

    // Thống kê
    private SocialStats stats; // Thống kê nhóm

    // Trạng thái
    private StatusType status; // ACTIVE | ARCHIVED | DELETED

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;

    // Người tạo
    @Indexed
    private String createdBy;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class GroupMember {
    private String userId;
    private String role; // ADMIN | MODERATOR | MEMBER
    private Instant joinedAt;
    private boolean isApproved; // Đã được duyệt (với nhóm private/secret)
    private boolean isBanned; // Bị ban khỏi nhóm
    private Instant bannedAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class GroupRule {
    private String title;
    private String description;
    private Integer order; // Thứ tự hiển thị
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class GroupSettings {
    private boolean allowMemberPosts; // Cho phép thành viên đăng bài
    private boolean requireApprovalForPosts; // Yêu cầu duyệt bài viết
    private boolean allowMemberInvites; // Cho phép thành viên mời người khác
    private boolean showMemberList; // Hiển thị danh sách thành viên
    private boolean allowComments; // Cho phép bình luận
    private boolean allowReactions; // Cho phép reaction
}
