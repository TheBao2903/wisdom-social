/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.mapper;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.common.util.MediaUrlBuilder;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Mapper(componentModel = "spring")
public abstract class ConversationMemberMapper {

    // 1. Inject Bean để build URL
    @Autowired
    protected MediaUrlBuilder mediaUrlBuilder;

    // 2. Map dữ liệu
    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "blockedById", source = "blockedBy.id")
    // Trạng thái khóa tài khoản (User.locked) - phục vụ FE mask tên/avatar.
    // KHÔNG ghi đè nickname/avatar thật trong DB, chỉ truyền cờ để FE tự che.
    @Mapping(target = "accountLocked", source = "user.locked")
    // Gắn qualifiedByName để MapStruct gọi đúng hàm build URL cho Avatar
    @Mapping(target = "avatar", source = "user.avatarUrl", qualifiedByName = "buildAvatarUrl")
    @Mapping(target = "lastReadMessageId", source = "lastReadMessageId")
    @Mapping(
            target = "nickname",
            expression = "java(conversationMember.getNickname() != null ? conversationMember.getNickname() : conversationMember.getUser().getName())"
    )
    public abstract ConversationMemberResponse toConversationMemberResponse(ConversationMember conversationMember);

    // ĐÃ SỬA LỖI TYPO: Kiểu trả về phải là List<ConversationMemberResponse>
    public abstract List<ConversationMemberResponse> toListConversationMemberResponse(List<ConversationMember> conversationMembers);

    // 3. Hàm Helper đi kèm annotation @Named để tránh lỗi "Cạm bẫy" áp dụng nhầm cho chuỗi khác
    @Named("buildAvatarUrl")
    protected String buildAvatarUrl(String path) {
        if (path == null || path.trim().isEmpty()) return path;
        // Gọi hàm build của MediaUrlBuilder (truyền MessageType.IMAGE để nó tự ghép cdnDomain)
        return mediaUrlBuilder.build(path, MessageType.IMAGE);
    }
}
