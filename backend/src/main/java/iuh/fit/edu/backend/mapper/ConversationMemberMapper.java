/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.mapper;

import iuh.fit.edu.backend.domain.entity.mysql.ConversationMember;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Mapper(componentModel = "spring")
public interface ConversationMemberMapper {
    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "avatar", source = "user.avatarUrl")
    @Mapping(target = "lastReadMessageId", source = "lastReadMessageId")
    ConversationMemberResponse toConversationMemberResponse(ConversationMember conversationMember);

    List<ConversationMember> toListConversationMemberResponse(List<ConversationMember> conversationMembers);
}
