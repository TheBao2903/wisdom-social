/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.mapper;

import iuh.fit.edu.backend.constant.MessageType;
import iuh.fit.edu.backend.domain.entity.nosql.Message;
import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Mapper(componentModel = "spring")
public abstract class MessageMapper {

    // 1. Tiêm biến đường link S3 hoặc CDN từ application.yml vào đây
    // Dấu ':' cung cấp giá trị mặc định nếu trong file yml bạn quên cấu hình
    @Value("${app.cdn-domain}")
    protected String cdnDomain;

    // 2. MapStruct vẫn tự động map tự động các trường như cũ
    @Mapping(source = "messageType", target = "type")
    public abstract MessageResponse toMessageResponse(Message message);

    private String buildContentWithCdn(String content, MessageType type) {
        boolean shouldPrefixCdn = type == MessageType.IMAGE
                || type == MessageType.VIDEO
                || type == MessageType.FILE
                || type == MessageType.AUDIO;

        if (shouldPrefixCdn &&
                content != null &&
                !content.isEmpty()) {
            return cdnDomain + content;
        }

        return content;
    }
    private String buildAttachmentUrl(String url) {
        if (url != null && !url.isEmpty()) {
            return cdnDomain + url;
        }
        return url;
    }

    protected MessageResponse.ReplyInfo mapReplyInfo(Message.ReplyInfo replyInfo) {
        if (replyInfo == null) return null;

        return MessageResponse.ReplyInfo.builder()
                .messageId(replyInfo.getMessageId())
                .senderId(replyInfo.getSenderId())
                .type(replyInfo.getType())
                .content(buildContentWithCdn(replyInfo.getContent(), replyInfo.getType()))
                .build();
    }
    protected List<MessageResponse.MediaAttachmentResponse> mapAttachments(List<Message.MediaAttachment> attachments) {
        if (attachments == null) return null;
        return attachments.stream()
                .map(att -> MessageResponse.MediaAttachmentResponse.builder()
                        .url(buildAttachmentUrl(att.getUrl()))
                        .fileName(att.getFileName())
                        .fileSize(att.getFileSize())
                        .build()
                )
                .toList();
    }


    // 3. Logic tùy biến chạy NGAY SAU KHI MapStruct map xong
    @AfterMapping
    protected void customizeContent(Message message, @MappingTarget MessageResponse response) {
        response.setContent(
                buildContentWithCdn(message.getContent(), message.getMessageType())
        );
    }
}
