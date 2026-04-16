/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.chat.impl;

import iuh.fit.edu.backend.domain.entity.mysql.ConversationMember;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import iuh.fit.edu.backend.event.payload.MemberUpdatedEvent;
import iuh.fit.edu.backend.mapper.ConversationMemberMapper;
import iuh.fit.edu.backend.repository.mysql.ConversationMemberRepository;
import iuh.fit.edu.backend.service.chat.ConversationMemberService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationMemberServiceImpl implements ConversationMemberService {
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationMemberMapper conversationMemberMapper;
    private final ConversationMemberCacheServiceImpl cacheService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Lấy danh sách toàn bộ thành viên. Ưu tiên lấy từ Cache, nếu rỗng thì gọi DB.
     */
    @Override
    public Map<Long, ConversationMemberResponse> getMembersMap(Long conversationId) {
        // Kéo từ Redis
        Map<Long, ConversationMemberResponse> cachedMap = cacheService.getMembersMap(conversationId);
        if (!cachedMap.isEmpty()) {
            return cachedMap;
        }

        // Nếu Redis trống, chọc xuống MySQL
        List<ConversationMember> members = conversationMemberRepository.findByConversation_Id(conversationId);
        Map<Long, ConversationMemberResponse> dbMap = members.stream()
                .map(conversationMemberMapper::toConversationMemberResponse)
                .collect(Collectors.toMap(ConversationMemberResponse::getUserId, m -> m));

        // Nạp lại vào Redis để lần sau đọc cho nhanh
        cacheService.saveMembersMap(conversationId, dbMap);
        return dbMap;
    }

    /**
     * Lấy thông tin 1 thành viên. Dùng cho hàm Gửi tin, Ghim tin...
     */
    @Override
    public ConversationMemberResponse getMemberInfo(Long conversationId, Long userId) {
        ConversationMemberResponse cachedMember = cacheService.getMemberInfo(conversationId, userId);
        if (cachedMember != null) {
            return cachedMember;
        }

        ConversationMemberResponse response = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, userId)
                .map(conversationMemberMapper::toConversationMemberResponse)
                        .orElseThrow(() -> new RuntimeException("Không tim thấy thành viên cuộc trò chuyện"));

        cacheService.saveMemberInfo(conversationId, userId, response);
        return response;
    }


    /**
     * Hàm dùng để đồng bộ dữ liệu vào Redis ngay sau khi DB vừa cập nhật.
     * Dùng cho tính năng "Đã xem" (Seen) hoặc "Xóa lịch sử" (ClearedAt).
     */
    @Override
    public void updateMemberStateInCache(Long conversationId, Long userId, ConversationMember memberEntity) {
        ConversationMemberResponse updatedInfo = conversationMemberMapper.toConversationMemberResponse(memberEntity);
        cacheService.saveMemberInfo(conversationId, userId, updatedInfo);
    }

    /**
     * Logic Đổi biệt danh. Cần cập nhật DB, Cập nhật Cache, và Bắn WebSocket.
     */
    @Transactional
    @Override
    public void updateNickname(Long conversationId, Long targetUserId, String newNickname) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, targetUserId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên trong phòng chat"));

        // Lưu vào MySQL
        member.setNickname(newNickname);
        ConversationMember savedMember = conversationMemberRepository.save(member);

        // Cập nhật đè lên ô của người này trong Redis Hash (HSET)
        updateMemberStateInCache(conversationId, targetUserId, savedMember);

        // 3. Bắn WebSocket Event để Frontend đổi tên hiển thị trên luồng chat
        eventPublisher.publishEvent(new MemberUpdatedEvent(
                conversationId,
                targetUserId,
                newNickname,
                savedMember.getUser().getAvatarUrl()
        ));
    }

    /**
     * Lấy ra tất cả id của member ở trong cuộc hội thoại (không trùng nhau)
     */
    @Override
    public Set<Long> getAllMemberId(Long conversationId){
        return  this.conversationMemberRepository.findAllUserIdsByConversationId(conversationId);
    }
}


