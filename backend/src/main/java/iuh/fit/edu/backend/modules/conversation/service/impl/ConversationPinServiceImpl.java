package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.common.exception.ConversationAccessDeniedException;
import iuh.fit.edu.backend.common.exception.MaxPinLimitException;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationPinResponse;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationPin;
import iuh.fit.edu.backend.modules.conversation.mapper.ConversationMapper;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationPinRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationPinService;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationPinServiceImpl implements ConversationPinService {
    private static final int MAX_PINNED_CONVERSATIONS = 4;
    private static final String MAX_PIN_MESSAGE =
            "Bạn chỉ được ghim tối đa 4 cuộc hội thoại. Hãy bỏ ghim 1 cuộc hội thoại trước khi ghim thêm.";

    private final ConversationPinRepository conversationPinRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final UserRepository userRepository;
    private final ConversationMapper conversationMapper;

    @Transactional
    @Override
    public ConversationPinResponse pinConversation(Long userId, Long conversationId) {
        ConversationMember member = conversationMemberRepository
                .findByConversation_IdAndUser_IdAndStatus(conversationId, userId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new ConversationAccessDeniedException("Bạn không có quyền ghim cuộc hội thoại này"));

        ConversationPin existingPin = conversationPinRepository
                .findByUser_IdAndConversationRefId(userId, conversationId)
                .orElse(null);
        if (existingPin != null) {
            return toResponse(existingPin, member);
        }

        validateMaxPins(userId);

        ConversationPin pin = new ConversationPin();
        pin.setUser(userRepository.getReferenceById(userId));
        pin.setConversationRefId(conversationId);
        pin.setPinnedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));

        return toResponse(conversationPinRepository.save(pin), member);
    }

    @Transactional
    @Override
    public void unpinConversation(Long userId, Long conversationId) {
        if (!conversationPinRepository.existsByUser_IdAndConversationRefId(userId, conversationId)) {
            return;
        }
        conversationPinRepository.deleteByUser_IdAndConversationRefId(userId, conversationId);
    }

    @Transactional(readOnly = true)
    @Override
    public List<ConversationPinResponse> getPinnedConversations(Long userId) {
        List<ConversationPin> pins = conversationPinRepository.findByUser_IdOrderByPinnedAtDesc(userId);
        if (pins.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> conversationIds = pins.stream()
                .map(ConversationPin::getConversationRefId)
                .collect(Collectors.toSet());

        Map<Long, ConversationMember> membersByConversationId = conversationMemberRepository
                .findActiveSidebarByUserIdAndConversationIds(userId, conversationIds)
                .stream()
                .collect(Collectors.toMap(
                        member -> member.getConversation().getId(),
                        member -> member,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        return pins.stream()
                .map(pin -> {
                    ConversationMember member = membersByConversationId.get(pin.getConversationRefId());
                    return member == null ? null : toResponse(pin, member);
                })
                .filter(response -> response != null)
                .toList();
    }

    private void validateMaxPins(Long userId) {
        if (conversationPinRepository.countByUser_Id(userId) >= MAX_PINNED_CONVERSATIONS) {
            throw new MaxPinLimitException(MAX_PIN_MESSAGE);
        }
    }

    private ConversationPinResponse toResponse(ConversationPin pin, ConversationMember member) {
        return ConversationPinResponse.builder()
                .conversationId(pin.getConversationRefId())
                .pinnedAt(pin.getPinnedAt())
                .conversation(conversationMapper.toSidebarFromMember(member))
                .build();
    }
}
