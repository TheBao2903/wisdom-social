/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.mapper;

import iuh.fit.edu.backend.modules.chat.entity.Message;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.common.util.MediaUrlBuilder;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Mapper(componentModel = "spring")
public abstract class MessageMapper {

    @Autowired
    protected MediaUrlBuilder mediaUrlBuilder;
    // 2. MapStruct vẫn tự động map tự động các trường như cũ
    @Mapping(source = "messageType", target = "type")
    public abstract MessageResponse toMessageResponse(Message message);

    protected MessageResponse.ReplyInfo mapReplyInfo(Message.ReplyInfo replyInfo) {
        if (replyInfo == null) return null;

        return MessageResponse.ReplyInfo.builder()
                .messageId(replyInfo.getMessageId())
                .senderId(replyInfo.getSenderId())
                .type(replyInfo.getType())
                .content(mediaUrlBuilder.build(replyInfo.getContent(), replyInfo.getType()))
                .build();
    }
    protected List<MessageResponse.MediaAttachmentResponse> mapAttachments(List<Message.MediaAttachment> attachments) {
        if (attachments == null) return null;
        return attachments.stream()
                .map(att -> MessageResponse.MediaAttachmentResponse.builder()
                        .url(mediaUrlBuilder.buildAttachment(att.getUrl()))
                        .fileName(att.getFileName())
                        .fileSize(att.getFileSize())
                        .build()
                )
                .toList();
    }

    protected List<MessageResponse.IconNameResponse> mapIconName(List<Message.IconName> iconName) {
        if (iconName == null) return null;
        return iconName.stream()
                .map(reaction -> MessageResponse.IconNameResponse.builder()
                        .name(reaction.getName())
                        .user(mapIconUsers(reaction.getUser()))
                        .build())
                .toList();
    }

    protected List<MessageResponse.IconUserResponse> mapIconUsers(List<Message.IconUser> users) {
        if (users == null) return null;
        return users.stream()
                .map(user -> MessageResponse.IconUserResponse.builder()
                        .userId(user.getUserId())
                        .quantity(user.getQuantity())
                        .build())
                .toList();
    }


    // 3. Logic tùy biến chạy NGAY SAU KHI MapStruct map xong
    @AfterMapping
    protected void customizeContent(Message message, @MappingTarget MessageResponse response) {
        response.setContent(
                mediaUrlBuilder.build(message.getContent(), message.getMessageType())
        );
    }
}
