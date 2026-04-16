/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.mapper;

import iuh.fit.edu.backend.domain.entity.mysql.Conversation;

import iuh.fit.edu.backend.dto.response.conversation.ConversationResponse;

import iuh.fit.edu.backend.dto.response.message.LastMessageResponse;
import org.mapstruct.*;


import java.util.List;


/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Mapper(componentModel = "spring", uses = { ConversationMemberMapper.class })
public interface ConversationMapper {

    @Mapping(target = "members", source = "members")
    @Mapping(target = "pinnedMessages", source = "pinnedMessages")
    @Mapping(target = "lastMessage", ignore = true)
    ConversationResponse toConversationResponse(Conversation conversation, @Context Long userId);

    List<ConversationResponse> toListConversationResponse(List<Conversation> conversations, @Context Long userId);


    @Mapping(target = "lastMessageContent", source = "lastMessageContent") // Nội dung tin nhắn cuối
    @Mapping(target = "lastMessageType", source = "lastMessageType") // Loại tin nhắn
    @Mapping(target = "lastMessageAt", source = "lastMessageAt") // Thời điểm gửi
    @Mapping(target = "lastSenderId", source = "lastSenderId") // ID người gửi
    @Mapping(target = "lastSenderName", ignore = true) // Tên người gửi - set manually trong service
    LastMessageResponse toLastMessageResponse(Conversation conversation);

    @AfterMapping
    default void mapLastMessage(
            Conversation conversation,
            @MappingTarget ConversationResponse response
    ) {
        response.setLastMessage(toLastMessageResponse(conversation));
    }
    @AfterMapping
    default void mapUnreadCount(
            Conversation conversation,
            @MappingTarget ConversationResponse response,
            @Context Long userId
    ) {
        conversation.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(userId))
                .findFirst()
                .ifPresent(m -> response.setUnreadCount(m.getUnreadCount()));
    }
}
