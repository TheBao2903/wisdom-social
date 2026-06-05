/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.mapper;

import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;

import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.entity.FrozenLastMessage;
import iuh.fit.edu.backend.modules.conversation.entity.PinnedMessageDetail;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;

import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationSidebarResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.LastMessageResponse;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.common.util.MediaUrlBuilder;
import org.mapstruct.*;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.function.Consumer;
import java.util.List;


/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */



@Mapper(componentModel = "spring", uses = { ConversationMemberMapper.class })
public abstract class ConversationMapper {

    @Autowired
    protected MediaUrlBuilder mediaUrlBuilder;

    // =======================================================
    // 1. MAPPING CHO CONVERSATION RESPONSE (DETAIL)
    // =======================================================
    @Mapping(target = "members", source = "members")
    @Mapping(target = "pinnedMessages", source = "pinnedMessages")
        @Mapping(target = "lastMessage", source = "conversation")
    @Mapping(target = "imageUrl", source = "imageUrl", qualifiedByName = "buildImageUrl")
    public abstract ConversationResponse toConversationResponse(
            Conversation conversation,
            @Context Long userId
    );

    public abstract List<ConversationResponse> toListConversationResponse(
            List<Conversation> conversations,
            @Context Long userId
    );

    // =======================================================
    // 2. MAPPING CHO CONVERSATION SIDEBAR RESPONSE
    // =======================================================
    @Mapping(target = "id", source = "conversation.id")
    @Mapping(target = "name", source = "conversation.name")
    @Mapping(target = "type", source = "conversation.type")
    @Mapping(target = "imageUrl", source = "conversation.imageUrl", qualifiedByName = "buildImageUrl")
    @Mapping(target = "updatedAt", source = "conversation.updatedAt")
    @Mapping(target = "unreadCount", source = "unreadCount")
    @Mapping(target = "lastMessage", ignore = true)
    public abstract ConversationSidebarResponse toSidebarFromMember(ConversationMember member);

    public abstract List<ConversationSidebarResponse> toListSidebarFromMembers(List<ConversationMember> members);

    // =======================================================
    // 3. AFTER MAPPING (ĐÃ GOM LOGIC)
    // =======================================================

    @AfterMapping
    protected void applyCorrectLastMessageToSidebar(ConversationMember member, @MappingTarget ConversationSidebarResponse response) {
        LastMessageResponse lastMsg = new LastMessageResponse();
        resolveMaskedLastMessage(member.getConversation(), member, lastMsg);
        response.setLastMessage(lastMsg);
    }
    @AfterMapping
    protected void applyCorrectLastMessageToDetail(Conversation conversation, @MappingTarget ConversationResponse response, @Context Long userId) {
        if (conversation.getMembers() == null) return;

        // Tìm Member của user đang request
        conversation.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(userId))
                .findFirst()
                .ifPresent(member -> {
                    LastMessageResponse lastMsg = response.getLastMessage();
                    if (lastMsg == null) {
                        lastMsg = new LastMessageResponse();
                        response.setLastMessage(lastMsg);
                    }
                    // Áp dụng bùa che tin nhắn (Mask)
                    resolveMaskedLastMessage(conversation, member, lastMsg);
                });
    }

    @AfterMapping
    protected void customizeDirectChatInfo(ConversationMember currentMember, @MappingTarget ConversationSidebarResponse response) {
        if (response.getType() == ConversationType.DIRECT) {
            // Tái sử dụng hàm helper
            applyDirectChatPartnerInfo(currentMember.getConversation(), currentMember.getUser().getId(), response::setName, response::setImageUrl);
            response.setDirectPartnerId(findDirectPartnerId(currentMember.getConversation(), currentMember.getUser().getId()));
            // Cờ khóa tài khoản của đối phương để FE mask. KHÔNG đụng tới name/imageUrl thật.
            response.setDirectPartnerLocked(isDirectPartnerLocked(currentMember.getConversation(), currentMember.getUser().getId()));
        }
    }

    @AfterMapping
    protected void customizeDirectChatDetailInfo(Conversation conversation, @MappingTarget ConversationResponse response, @Context Long userId) {
        if (response.getType() == ConversationType.DIRECT) {
            // Tái sử dụng hàm helper
            applyDirectChatPartnerInfo(conversation, userId, response::setName, response::setImageUrl);
            response.setDirectPartnerLocked(isDirectPartnerLocked(conversation, userId));
        }
    }

    @AfterMapping
    protected void mapUnreadCount(Conversation conversation, @MappingTarget ConversationResponse response, @Context Long userId) {
        if (conversation.getMembers() == null) return;
        conversation.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(userId))
                .findFirst()
                .ifPresent(m -> response.setUnreadCount(m.getUnreadCount()));
    }

    @AfterMapping
    protected void mapPinnedMessages(Conversation conversation, @MappingTarget ConversationResponse response) {
        if (conversation.getPinnedMessages() == null) return;
        List<PinnedMessageDetail> mapped = conversation.getPinnedMessages()
                .stream().map(this::mapPinnedMessageDetail).toList();
        response.setPinnedMessages(mapped);
    }

    // =======================================================
    // 4. HELPER MAPPING & SNAPSHOT
    // =======================================================

    /**
     * HÀM HELPER MỚI: Dùng chung để che tin nhắn (Mặt nạ) cho cả Sidebar và Detail
     */
    protected void resolveMaskedLastMessage(Conversation conv, ConversationMember member, LastMessageResponse lastMsg) {
        // Nếu đang hoạt động -> kiểm tra xem có bị che Global không
        if (member.getStatus() == ConversationMemberStatus.ACTIVE) {
            if (conv.getLastMessageId() != null && conv.getLastMessageId().equals(member.getHiddenGlobalMessageId())) {
                // Trúng mặt nạ (Tin nhắn vừa bị Xóa 1 phía) -> Dùng dữ liệu của Mặt nạ
                FrozenLastMessage personal = member.getPersonalLastMessage();
                if (personal != null) {
                    lastMsg.setLastMessageContent(personal.getContent());
                    lastMsg.setLastMessageType(personal.getType());
                    lastMsg.setLastMessageAt(personal.getTime());
                    lastMsg.setLastSenderId(personal.getSenderId());
                    lastMsg.setLastSenderName(personal.getSenderName());
                }
            } else {
                // == BÌNH THƯỜNG: DÙNG GLOBAL STATE ==
                lastMsg.setLastMessageContent(conv.getLastMessageContent());
                lastMsg.setLastMessageType(conv.getLastMessageType());
                lastMsg.setLastMessageAt(conv.getLastMessageAt());
                lastMsg.setLastSenderId(conv.getLastSenderId());
                lastMsg.setLastSenderName(conv.getLastSenderName());
            }
        } else {
            // Đã rời/bị kick/giải tán -> Lấy từ Frozen State
            FrozenLastMessage frozen = member.getFrozenLastMessage();
            if (frozen != null) {
                lastMsg.setLastMessageContent(frozen.getContent());
                lastMsg.setLastMessageType(frozen.getType());
                lastMsg.setLastMessageAt(frozen.getTime());
                lastMsg.setLastSenderId(frozen.getSenderId());
                lastMsg.setLastSenderName(frozen.getSenderName());
            }
        }
    }
    /**
     * HÀM HELPER MỚI: Dùng Consumer để gán dữ liệu vào bất kỳ DTO nào
     */
    protected void applyDirectChatPartnerInfo(Conversation conversation, Long currentUserId, Consumer<String> setName, Consumer<String> setImageUrl) {
        if (conversation.getMembers() == null) return;

        conversation.getMembers().stream()
                .filter(m -> !m.getUser().getId().equals(currentUserId))
                .findFirst()
                .ifPresent(partner -> {
                    String displayName = (partner.getNickname() != null && !partner.getNickname().trim().isEmpty())
                            ? partner.getNickname()
                            : partner.getUser().getName();

                    // Gọi Consumer để set dữ liệu vào DTO đang được map
                    setName.accept(displayName);
                    setImageUrl.accept(buildImageUrl(partner.getUser().getAvatarUrl()));
                });
    }

    protected Long findDirectPartnerId(Conversation conversation, Long currentUserId) {
        if (conversation.getMembers() == null) return null;
        return conversation.getMembers().stream()
                .map(ConversationMember::getUser)
                .filter(user -> user != null && !user.getId().equals(currentUserId))
                .map(User::getId)
                .findFirst()
                .orElse(null);
    }

    /**
     * Kiểm tra đối phương trong hội thoại DIRECT có đang bị khóa tài khoản hay không.
     * Chỉ trả về cờ boolean (User.locked) để FE tự che tên/avatar, không đổi dữ liệu thật.
     */
    protected boolean isDirectPartnerLocked(Conversation conversation, Long currentUserId) {
        if (conversation.getMembers() == null) return false;
        return conversation.getMembers().stream()
                .map(ConversationMember::getUser)
                .filter(user -> user != null && !user.getId().equals(currentUserId))
                .findFirst()
                .map(User::isLocked)
                .orElse(false);
    }

    @Mapping(target = "lastMessageContent", source = "lastMessageContent")
    @Mapping(target = "lastMessageType", source = "lastMessageType")
    @Mapping(target = "lastMessageAt", source = "lastMessageAt")
    @Mapping(target = "lastSenderId", source = "lastSenderId")
    @Mapping(target = "lastSenderName", source = "lastSenderName")
    public abstract LastMessageResponse toLastMessageResponse(Conversation conversation);

    @Named("buildImageUrl")
    protected String buildImageUrl(String path) {
        if (path == null || path.trim().isEmpty()) return path;
        return mediaUrlBuilder.build(path, MessageType.IMAGE);
    }

    protected PinnedMessageDetail mapPinnedMessageDetail(PinnedMessageDetail p) {
        if (p == null) return null;
        PinnedMessageDetail copy = new PinnedMessageDetail();
        copy.setOriginalSenderId(p.getOriginalSenderId());
        copy.setMessageId(p.getMessageId());
        copy.setPinnerId(p.getPinnerId());
        copy.setPinnedAt(p.getPinnedAt());
        copy.setType(p.getType());
        copy.setContent(mediaUrlBuilder.build(p.getContent(), p.getType()));
        return copy;
    }
}
