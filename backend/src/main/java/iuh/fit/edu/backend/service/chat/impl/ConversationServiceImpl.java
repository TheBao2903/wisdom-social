/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.chat.impl;

import iuh.fit.edu.backend.domain.entity.mysql.Conversation;
import iuh.fit.edu.backend.domain.entity.mysql.ConversationMember;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import iuh.fit.edu.backend.dto.response.conversation.ConversationResponse;
import iuh.fit.edu.backend.dto.response.message.LastMessageResponse;
import iuh.fit.edu.backend.dto.response.message.MessageSeenResponse;
import iuh.fit.edu.backend.event.payload.MessageSeenEvent;
import iuh.fit.edu.backend.mapper.ConversationMapper;
import iuh.fit.edu.backend.repository.mysql.ConversationMemberRepository;
import iuh.fit.edu.backend.service.chat.ConversationMemberService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationServiceImpl implements iuh.fit.edu.backend.service.chat.ConversationService {
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationMapper conversationMapper;
    private final ConversationMemberService conversationMemberService;
    private final ApplicationEventPublisher eventPublisher;


    @Override
    public List<ConversationResponse> getConversationsByUser(Long userId){
        log.info("Get conversation by user {}", userId);

        List<Conversation> conversations = conversationMemberRepository.findConversationsByUserIdOrderByLastMessageAtDesc(userId);
        if(conversations.isEmpty()) return Collections.emptyList();

        // Map sang dto (lúc này senderName đang null vì cần lấy dynamic name trong trường hợp người dùng đổi tên)
        List<ConversationResponse> conversationResponses = this.conversationMapper.toListConversationResponse(conversations, userId);

        conversationResponses.forEach(res -> {
            if (res.getLastMessage() != null) {
                Long conversationId = res.getId();
                Long senderId = res.getLastMessage().getLastSenderId();

                // Kéo thông tin từ Redis Hash Map
                ConversationMemberResponse senderInfo = conversationMemberService.getMemberInfo(conversationId, senderId);
                if (senderInfo != null) {
                    res.getLastMessage().setLastSenderName(senderInfo.getNickname());
                } else {
                    res.getLastMessage().setLastSenderName("Người dùng ẩn");
                }
            }
        });
        log.info("List conversation {}", conversationResponses);
        return conversationResponses;
    }

    @Override
    public ConversationResponse getConversationById(Long conversationId, Long userId) {
        log.info("Get conversation {} for user {}", conversationId, userId);
        
        // Kiểm tra user có phải là member của conversation không
        ConversationMember conversationMember = conversationMemberRepository
                .findByConversation_IdAndUser_Id(conversationId, userId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện này"));
        
        Conversation conversation = conversationMember.getConversation();
        ConversationResponse response = conversationMapper.toConversationResponse(conversation, userId);

        log.info("Conversation: {}", response);
        return response;
    }
    @Transactional
    @Override
    public void deleteConversationForMe(Long conversationId, Long userId) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên trong cuộc trò chuyện"));

        member.setClearedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        member.setHidden(true);
        ConversationMember savedMember = conversationMemberRepository.save(member);

        // DỌN SẠCH CACHE ĐỂ CẬP NHẬT MỐC CLEARED_AT
        conversationMemberService.updateMemberStateInCache(conversationId, userId, savedMember);

    }

    @Transactional
    @Override
    public void markAsRead(Long conversationId, Long userId, String lastMessageId) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên trong cuộc trò chuyện"));

        // Kiểm tra xem có thực sự cần cập nhật không để tránh call DB vô ích
        if (member.getUnreadCount() == 0 &&
                (lastMessageId == null || lastMessageId.equals(member.getLastReadMessageId()))) {
            return;
        }
        member.setUnreadCount(0);
        if (lastMessageId != null) {
            member.setLastReadMessageId(lastMessageId);
        }
        ConversationMember savedMember = conversationMemberRepository.save(member);

        // ĐỒNG BỘ REDIS: Số unreadCount = 0 vừa cập nhật phải được nhét lại vào Redis Hash ngay!
        conversationMemberService.updateMemberStateInCache(conversationId, userId, savedMember);

        // Chuẩn bị dữ liệu bắn Socket
        MessageSeenResponse response = MessageSeenResponse.builder()
                .conversationId(conversationId)
                .userId(userId)
                .lastMessageId(lastMessageId)
                .seenAt(Instant.now())
                .build();

        Set<Long> memberIds = conversationMemberService.getAllMemberId(conversationId);


        // Publish Event cho các user khác thấy tin nhắn mình đã xem
        this.eventPublisher.publishEvent(new MessageSeenEvent(response, memberIds));

    }
}
