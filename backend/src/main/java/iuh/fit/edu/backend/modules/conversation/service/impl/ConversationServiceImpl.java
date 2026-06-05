/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.common.util.MediaUrlBuilder;
import iuh.fit.edu.backend.modules.conversation.dto.response.*;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.dto.request.CreateGroupRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.CreateGroupWithInvitesRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageSeenResponse;
import iuh.fit.edu.backend.modules.conversation.event.payload.ConversationCreatedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.ConversationUpdatedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.GroupInviteLinkDispatchEvent;
import iuh.fit.edu.backend.modules.chat.event.payload.MessageSeenEvent;
import iuh.fit.edu.backend.common.exception.ConversationAccessDeniedException;
import iuh.fit.edu.backend.common.exception.ConversationMemberKickedException;
import iuh.fit.edu.backend.common.exception.ConversationMemberLeftException;
import iuh.fit.edu.backend.modules.conversation.mapper.ConversationMapper;
import iuh.fit.edu.backend.modules.conversation.mapper.ConversationMemberMapper;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.service.GroupJoinRequestService;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberCacheService;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import iuh.fit.edu.backend.modules.conversation.service.ConversationService;
import iuh.fit.edu.backend.modules.chat.service.InternalMessageService;
import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.common.util.TransactionUtil;
import iuh.fit.edu.backend.common.util.heplper.ChatSnapshotHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
public class ConversationServiceImpl implements ConversationService {
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationMapper conversationMapper;
    private final ConversationMemberService conversationMemberService;
    private final ApplicationEventPublisher eventPublisher;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final InternalMessageService internalMessageService;
    private final ConversationMemberCacheService memberCacheService;
    private final ConversationMemberMapper conversationMemberMapper;
    private final ChatSnapshotHelper chatSnapshotHelper;
    private final GroupJoinRequestService groupJoinRequestService;
    private final MediaUrlBuilder mediaUrlBuilder;
    private final FriendRepository friendRepository;
    private final BlockUserRepository blockUserRepository;


    @Override
    public List<ConversationSidebarResponse> getConversationsByUser(Long userId){
        List<ConversationMember> members = conversationMemberRepository.findActiveSidebarByUserId(userId);
        if(members.isEmpty()) return Collections.emptyList();
        List<ConversationSidebarResponse> conversationResponses = this.conversationMapper.toListSidebarFromMembers(members);
        applyDirectBlockStatus(conversationResponses, userId);
        log.info("List conversation by user {}:  {} ", userId, conversationResponses);
        return conversationResponses;
    }

    @Override
    public List<ConversationSidebarResponse> getForwardableConversationsByUser(Long userId) {
        List<ConversationMember> members = conversationMemberRepository.findForwardableSidebarByUserId(userId);
        if (members.isEmpty()) return Collections.emptyList();
        return this.conversationMapper.toListSidebarFromMembers(members);
    }

    @Override
    public ConversationResponse getConversationById(Long conversationId, Long userId) {
        log.info("Get conversation {} for user {}", conversationId, userId);

        ConversationMember conversationMember = conversationMemberRepository
                .findByConversation_IdAndUser_Id(conversationId, userId)
                .orElseThrow(() -> new ConversationAccessDeniedException("Bạn không phải thành viên của cuộc trò chuyện này"));

        if (conversationMember.getStatus() == ConversationMemberStatus.KICKED) {
            throw new ConversationMemberKickedException("Bạn đã bị xóa khỏi nhóm");
        }
        if (conversationMember.getStatus() == ConversationMemberStatus.BLOCKED) {
            throw new ConversationMemberKickedException("Bạn đã bị chặn khỏi nhóm");
        }

        if (conversationMember.getStatus() == ConversationMemberStatus.LEFT) {
            throw new ConversationMemberLeftException("Bạn đã rời khỏi nhóm");
        }

        if (conversationMember.getStatus() == ConversationMemberStatus.GROUP_DISBANDED) {
            throw new ConversationAccessDeniedException("Nhóm đã bị giải tán");
        }

        Conversation conversation = conversationMember.getConversation();
        ConversationResponse response = conversationMapper.toConversationResponse(conversation, userId);
        applyDirectBlockStatus(response, userId);
        if (conversationMember.getRole() == MemberRole.OWNER || conversationMember.getRole() == MemberRole.DEPUTY) {
            List<JoinRequestResponse> pending = groupJoinRequestService.getPendingRequests(conversationId, userId);
            response.setPendingRequests(pending);
        }
        log.info("Conversation: {}", response);
        return response;
    }

    private void applyDirectBlockStatus(List<ConversationSidebarResponse> responses, Long userId) {
        if (responses == null || responses.isEmpty() || userId == null) return;

        Set<Long> partnerIds = responses.stream()
                .filter(response -> response.getType() == ConversationType.DIRECT)
                .map(ConversationSidebarResponse::getDirectPartnerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (partnerIds.isEmpty()) return;

        Set<Long> blockedByMeIds = blockUserRepository
                .findByBlocker_IdAndBlocked_IdIn(userId, partnerIds)
                .stream()
                .map(blockedUser -> blockedUser.getBlocked().getId())
                .collect(Collectors.toSet());
        Set<Long> blockedMeIds = blockUserRepository
                .findByBlocked_IdAndBlocker_IdIn(userId, partnerIds)
                .stream()
                .map(blockedUser -> blockedUser.getBlocker().getId())
                .collect(Collectors.toSet());

        responses.forEach(response -> {
            Long partnerId = response.getDirectPartnerId();
            if (partnerId == null) return;
            response.setDirectBlockedByMe(blockedByMeIds.contains(partnerId));
            response.setDirectBlockedMe(blockedMeIds.contains(partnerId));
        });
    }

    private void applyDirectBlockStatus(ConversationResponse response, Long userId) {
        if (response == null || userId == null || response.getType() != ConversationType.DIRECT) return;
        Long partnerId = response.getMembers() == null ? null : response.getMembers()
                .stream()
                .map(ConversationMemberResponse::getUserId)
                .filter(Objects::nonNull)
                .filter(memberUserId -> !memberUserId.equals(userId))
                .findFirst()
                .orElse(null);
        if (partnerId == null) return;

        response.setDirectBlockedByMe(blockUserRepository.existsByBlocker_IdAndBlocked_Id(userId, partnerId));
        response.setDirectBlockedMe(blockUserRepository.existsByBlocker_IdAndBlocked_Id(partnerId, userId));
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse createGroup(CreateGroupRequest request, Long creatorId) {
        return createGroupInternal(request.getName(), request.getImageUrl(), request.getMemberIds(), creatorId, 2);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse createGroupWithInvites(CreateGroupWithInvitesRequest request, Long creatorId) {
        Set<Long> directMemberIds = normalizeIds(request.getMemberIds(), creatorId);
        Set<Long> inviteeUserIds = normalizeIds(request.getInviteeUserIds(), creatorId);
        inviteeUserIds.removeAll(directMemberIds);

        if (directMemberIds.isEmpty()) {
            throw new IllegalArgumentException("Phai chon it nhat 1 ban be de tao nhom");
        }
        if (inviteeUserIds.isEmpty()) {
            throw new IllegalArgumentException("Danh sach nguoi nhan link moi khong duoc trong");
        }
        if (directMemberIds.size() + inviteeUserIds.size() < 2) {
            throw new IllegalArgumentException("Phai chon it nhat 2 nguoi de tao nhom");
        }

        validateAcceptedFriends(creatorId, directMemberIds, "Chi co the them truc tiep ban be vao nhom");
        validateStrangerInvitees(creatorId, inviteeUserIds);

        ConversationResponse created = createGroupInternal(
                request.getName(),
                request.getImageUrl(),
                directMemberIds,
                creatorId,
                1
        );

        String inviteToken = ensureInviteToken(created.getId());
        publishInviteLinkSystemMessage(created.getId(), creatorId, inviteeUserIds);
        eventPublisher.publishEvent(new GroupInviteLinkDispatchEvent(
                creatorId,
                created.getId(),
                inviteToken,
                inviteeUserIds
        ));

        return getConversationById(created.getId(), creatorId);
    }

    private ConversationResponse createGroupInternal(
            String name,
            String requestedImageUrl,
            Set<Long> memberIds,
            Long creatorId,
            int minDirectMembers) {

        Set<Long> targetMemberIds = new HashSet<>(memberIds);
        targetMemberIds.remove(creatorId); // Đề phòng FE vô tình gửi kèm ID của người tạo
        if (targetMemberIds.size() < minDirectMembers) {
            throw new IllegalArgumentException("Nhóm phải có ít nhất 3 thành viên (bao gồm bạn)");
        }

        String imageUrl = requestedImageUrl != null ? requestedImageUrl : "users/group.png";
        // Set tổng hợp tất cả ID
        Set<Long> allMemberIds = new HashSet<>(targetMemberIds);
        allMemberIds.add(creatorId);

        // LƯU BẢNG CONVERSATION (MySQL)
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        Conversation savedConversation = initializeNewConversation(name, imageUrl, now);


        // LƯU BẢNG CONVERSATION MEMBER (MySQL - BATCH INSERT)
        List<ConversationMember> members = createMembersForNewGroup(savedConversation, allMemberIds, creatorId, now);
        savedConversation.setMembers(members);

        Map<Long, ConversationMemberResponse> dbMap = members.stream()
                .map(conversationMemberMapper::toConversationMemberResponse)
                .collect(Collectors.toMap(ConversationMemberResponse::getUserId, m -> m));

        TransactionUtil.executeAfterCommit(() -> {
            memberCacheService.saveMembersMap(savedConversation.getId(), dbMap);
        });

        String targetMembersSnapshot = chatSnapshotHelper.buildMemberSnapshotContent(targetMemberIds);
        internalMessageService.createSystemMessage(savedConversation.getId(), creatorId, MessageType.SYSTEM_CREATE_GROUP, targetMembersSnapshot);

        // CẬP NHẬT SNAPSHOT TIN NHẮN CUỐI (MySQL)
        String creatorName = chatSnapshotHelper.resolveUserDisplayName(creatorId);
        updateGroupSnapshot(savedConversation, targetMembersSnapshot, creatorId, creatorName, MessageType.SYSTEM_CREATE_GROUP);

        // MAP RESPONSE & BẮN EVENT
        ConversationResponse response = conversationMapper.toConversationResponse(savedConversation, creatorId);
        if(response.getLastMessage() != null){
            response.getLastMessage().setLastSenderName(creatorName);
            response.getLastMessage().setRead(true);
        }

        // Bắn Socket Event cho toàn bộ thành viên
        this.eventPublisher.publishEvent(new ConversationCreatedEvent(response,allMemberIds));

        return response;
    }

    @Transactional
    @Override
    public void deleteConversationForMe(Long conversationId, Long userId) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(conversationId, userId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên trong cuộc trò chuyện"));

        member.setClearedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        member.setHidden(true);
        ConversationMember savedMember = conversationMemberRepository.save(member);

        // DỌN SẠCH CACHE ĐỂ CẬP NHẬT MỐC CLEARED_AT
        conversationMemberService.updateMemberStateInCache(conversationId, userId, savedMember);

    }

    @Transactional
    @Override
    public void hideConversationForMe(Long conversationId, Long userId) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên trong cuộc trò chuyện"));

        member.setHidden(true);
        ConversationMember savedMember = conversationMemberRepository.save(member);

        conversationMemberService.updateMemberStateInCache(conversationId, userId, savedMember);
    }

    @Transactional
    @Override
    public void markAsRead(Long conversationId, Long userId, String lastMessageId) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(conversationId, userId, ConversationMemberStatus.ACTIVE)
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

    // =======================================================
    // QUẢN LÝ CẤU HÌNH NHÓM (CHO PHÉP NHẮN TIN / DUYỆT THÀNH VIÊN)
    // =======================================================

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse updateMessageRestriction(Long conversationId, Long requesterId, boolean isRestricted) {
        return updateGroupSetting(conversationId, requesterId, isRestricted, true);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse updateJoinApprovalRequired(Long conversationId, Long requesterId, boolean isRequired) {
        return updateGroupSetting(conversationId, requesterId, isRequired, false);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse updateGroupImage(Long conversationId, Long requesterId, String imageUrl) {
        String normalizedImageUrl = imageUrl == null ? "" : imageUrl.trim();
        if (normalizedImageUrl.isEmpty()) {
            throw new IllegalArgumentException("Ảnh nhóm không được để trống");
        }

        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ nhóm chat mới có thể cập nhật ảnh nhóm");
        }

        conversationMemberRepository
                .findByConversation_IdAndUser_IdAndStatus(conversationId, requesterId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("Bạn không nằm trong nhóm này"));

        if (normalizedImageUrl.equals(conv.getImageUrl())) {
            return conversationMapper.toConversationResponse(conv, requesterId);
        }

        conv.setImageUrl(normalizedImageUrl);
        updateConversationAndNotify(conv, requesterId, "đã cập nhật ảnh nhóm");
        return conversationMapper.toConversationResponse(conv, requesterId);
    }

    // =======================================================
    // QUẢN LÝ LINK MỜI VÀ THAM GIA QUA LINK
    // =======================================================

    @Transactional
    @Override
    public String getOrGenerateInviteLink(Long conversationId, Long requesterId) {
        Conversation conv = validateGroupAndAdmin(conversationId, requesterId);
        if (conv.getInviteToken() == null || conv.getInviteToken().isEmpty()) {
            conv.setInviteToken(generateUniqueToken());
            conversationRepository.save(conv);
            String content = "đã tạo link tham gia nhóm";
            updateConversationAndNotify(conv, requesterId, content);
        }
        return conv.getInviteToken();
    }

    @Transactional
    @Override
    public String resetInviteLink(Long conversationId, Long requesterId) {
        Conversation conv = validateGroupAndAdmin(conversationId, requesterId);

        String newToken = generateUniqueToken();
        conv.setInviteToken(newToken);
        conversationRepository.save(conv);

        String content = "đã làm mới link tham gia nhóm";
        updateConversationAndNotify(conv, requesterId, content);

        return newToken;
    }

    @Transactional
    @Override
    public void disableInviteLink(Long conversationId, Long requesterId) {
        Conversation conv = validateGroupAndAdmin(conversationId, requesterId);

        conv.setInviteToken(null);
        conversationRepository.save(conv);

        String content = "đã vô hiệu hóa link tham gia nhóm";
        updateConversationAndNotify(conv, requesterId, content);
    }

    @Override
    public ConversationPreviewResponse previewGroupFromToken(String token, Long userId) {
        Conversation conv = conversationRepository.findByInviteToken(token)
                .orElseThrow(() -> new RuntimeException("Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa"));

        String status = "NOT_MEMBER";

        // Kiểm tra xem đã là thành viên ACTIVE chưa
        boolean isActive = conversationMemberRepository
                .findByConversation_IdAndUser_IdAndStatus(conv.getId(), userId, ConversationMemberStatus.ACTIVE)
                .isPresent();

        if (isActive) {
            status = "ACTIVE";
        } else if (groupJoinRequestService.hasPendingRequest(conv.getId(), userId)) {
            status = "PENDING";
        }

        int count = conversationMemberRepository.countByConversation_IdAndStatus(conv.getId(), ConversationMemberStatus.ACTIVE);

        return ConversationPreviewResponse.builder()
                .conversationId(conv.getId())
                .name(conv.getName())
                .imageUrl(mediaUrlBuilder.build(conv.getImageUrl(), MessageType.IMAGE))
                .memberCount(count)
                .isJoinApprovalRequired(conv.isJoinApprovalRequired())
                .userStatus(status)
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public Object joinGroupFromToken(String token, Long userId, String message) {
        Conversation conv = conversationRepository.findByInviteToken(token)
                .orElseThrow(() -> new RuntimeException("Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa"));

        // Chặn nếu đang là thành viên ACTIVE
        if (conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(conv.getId(), userId, ConversationMemberStatus.ACTIVE).isPresent()) {
            throw new RuntimeException("Bạn đã là thành viên của nhóm này");
        }

        if (conv.isJoinApprovalRequired()) {
            // Trường hợp nhóm bật duyệt -> Đẩy vào phòng chờ
            groupJoinRequestService.createRequest(conv.getId(), userId, null);
            return java.util.Collections.singletonMap("message", "Đã gửi yêu cầu tham gia đến Quản trị viên");
        } else {
            // Trường hợp nhóm tự do -> Add thẳng (Tái sử dụng service member)
            return conversationMemberService.joinByInviteLink(conv.getId(), userId);
        }
    }

    // =======================================================
    // PRIVATE HELPERS CHO HÀM TẠO NHÓM
    // =======================================================

    private Conversation initializeNewConversation(String name, String imageUrl, Instant now) {
        Conversation conversation = new Conversation();
        conversation.setType(ConversationType.GROUP);
        conversation.setName(name);
        conversation.setImageUrl(imageUrl);
        conversation.setUpdatedAt(now);
        conversation.setLastMessageAt(now);
        return conversationRepository.save(conversation);
    }

    private List<ConversationMember> createMembersForNewGroup(Conversation conv, Set<Long> allMemberIds, Long creatorId, Instant now) {
        List<ConversationMember> members = allMemberIds.stream().map(userId -> {
            ConversationMember member = new ConversationMember();
            member.setConversation(conv);
            member.setUser(userRepository.getReferenceById(userId));
            member.setStatus(ConversationMemberStatus.ACTIVE);
            member.setJoinedAt(now);
            member.setRole(userId.equals(creatorId) ? MemberRole.OWNER : MemberRole.MEMBER);
            return member;
        }).collect(Collectors.toList());

        return conversationMemberRepository.saveAll(members);
    }

    private void updateGroupSnapshot(Conversation conv, String targetSnapshot, Long creatorId, String creatorName, MessageType type) {
        conv.setLastMessageContent(targetSnapshot);
        conv.setLastSenderId(creatorId);
        conv.setLastMessageType(type);
        conv.setLastSenderName(creatorName);
        conversationRepository.save(conv);
    }

    private ConversationResponse updateGroupSetting(Long conversationId, Long requesterId, boolean flagValue, boolean isMessageSetting) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        // 1. Lấy thông tin nhóm
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Cài đặt này chỉ áp dụng cho nhóm chat");
        }

        // 2. Lấy thông tin người yêu cầu và check quyền
        ConversationMember requester = conversationMemberRepository
                .findByConversation_IdAndUser_IdAndStatus(conversationId, requesterId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("Bạn không nằm trong nhóm này"));

        if (requester.getRole() != MemberRole.OWNER && requester.getRole() != MemberRole.DEPUTY) {
            throw new ConversationAccessDeniedException("Chỉ Trưởng nhóm hoặc Phó nhóm mới có quyền thay đổi cài đặt này");
        }

        // Nếu trạng thái không thay đổi thì return luôn cho nhẹ DB
        if (isMessageSetting && conv.isMessageRestricted() == flagValue) return conversationMapper.toConversationResponse(conv, requesterId);
        if (!isMessageSetting && conv.isJoinApprovalRequired() == flagValue) return conversationMapper.toConversationResponse(conv, requesterId);

        // Cập nhật trạng thái va  Bắn tin nhắn hệ thống
        String content;
        if (isMessageSetting) {
            conv.setMessageRestricted(flagValue);
            content = flagValue ? "đã bật chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn" : "đã tắt chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn";
        } else {
            conv.setJoinApprovalRequired(flagValue);
            content = flagValue ? "đã bật chế độ phê duyệt thành viên" : "đã tắt chế độ phê duyệt thành viên";
            if (!flagValue) {
                groupJoinRequestService.cancelPendingRequestsWhenApprovalDisabled(conversationId, requesterId);
            }
        }
        String requesterName = chatSnapshotHelper.resolveActorDisplayName(conv, requesterId);

        // Hàm này tự động lưu Cache an toàn nhờ TransactionUtil (đã fix ở bước trước)
        internalMessageService.createSystemMessage(conversationId, requesterId, MessageType.SYSTEM_UPDATE_SETTING, content);

        // Cập nhật Snapshot (MySQL)
        conv.setLastMessageContent(content);
        conv.setLastMessageType(MessageType.SYSTEM_UPDATE_SETTING);
        conv.setLastMessageAt(now);
        conv.setLastSenderId(requesterId);
        conv.setLastSenderName(requesterName);
        conversationRepository.save(conv);

        // Map dữ liệu trả về
        ConversationResponse response = conversationMapper.toConversationResponse(conv, requesterId);
        if (response.getLastMessage() != null) {
            response.getLastMessage().setLastSenderName(requesterName);
            response.getLastMessage().setRead(true);
        }

        // Bắn Socket để UI của tất cả mọi người tự động render lại (ẩn/hiện ô nhập tin nhắn)
        Set<Long> memberIds = conversationMemberRepository.findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);
        eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, response.getLastMessage(), memberIds));

        return response;
    }

    private Conversation validateGroupAndAdmin(Long conversationId, Long requesterId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ nhóm chat mới có tính năng này");
        }

        ConversationMember requester = conversationMemberRepository
                .findByConversation_IdAndUser_IdAndStatus(conversationId, requesterId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new ConversationAccessDeniedException("Bạn không ở trong nhóm này"));

        if (requester.getRole() != MemberRole.OWNER && requester.getRole() != MemberRole.DEPUTY) {
            throw new ConversationAccessDeniedException("Chỉ Trưởng/Phó nhóm mới được quản lý link");
        }
        return conv;
    }

    private String generateUniqueToken() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }

    private Set<Long> normalizeIds(Set<Long> rawIds, Long actorId) {
        Set<Long> ids = rawIds == null ? new HashSet<>() : new HashSet<>(rawIds);
        ids.remove(null);
        ids.remove(actorId);
        return ids;
    }

    private void validateAcceptedFriends(Long currentUserId, Set<Long> targetIds, String message) {
        for (Long targetId : targetIds) {
            if (friendRepository.countAcceptedFriendship(
                    currentUserId,
                    targetId
            ) == 0) {
                throw new IllegalArgumentException(message);
            }
        }
    }

    private void validateStrangerInvitees(Long currentUserId, Set<Long> inviteeUserIds) {
        for (Long inviteeUserId : inviteeUserIds) {
            if (!userRepository.existsById(inviteeUserId)) {
                throw new IllegalArgumentException("Nguoi nhan link moi khong ton tai");
            }
            if (friendRepository.countAcceptedFriendship(
                    currentUserId,
                    inviteeUserId
            ) > 0) {
                throw new IllegalArgumentException("Ban be nen duoc them truc tiep vao nhom");
            }
        }
    }

    private String ensureInviteToken(Long conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));
        if (conversation.getInviteToken() == null || conversation.getInviteToken().isBlank()) {
            conversation.setInviteToken(generateUniqueToken());
            conversationRepository.save(conversation);
        }
        return conversation.getInviteToken();
    }

    private ConversationResponse publishInviteLinkSystemMessage(
            Long conversationId,
            Long actorId,
            Set<Long> inviteeUserIds) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        String content = chatSnapshotHelper.buildMemberSnapshotContent(inviteeUserIds);

        internalMessageService.createSystemMessage(
                conversationId,
                actorId,
                MessageType.SYSTEM_GROUP_INVITE_LINK_SENT,
                content
        );

        String actorName = chatSnapshotHelper.resolveActorDisplayName(conversation, actorId);
        conversation.setLastMessageContent(content);
        conversation.setLastSenderId(actorId);
        conversation.setLastMessageType(MessageType.SYSTEM_GROUP_INVITE_LINK_SENT);
        conversation.setLastMessageAt(now);
        conversation.setLastSenderName(actorName);
        conversationRepository.save(conversation);

        ConversationResponse response = conversationMapper.toConversationResponse(conversation, actorId);
        if (response.getLastMessage() != null) {
            response.getLastMessage().setLastSenderName(actorName);
            response.getLastMessage().setRead(true);
        }

        Set<Long> memberIds = conversationMemberRepository.findUserIdsByConversationIdAndStatus(
                conversationId,
                ConversationMemberStatus.ACTIVE
        );
        eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, response.getLastMessage(), memberIds));
        return response;
    }

    private void updateConversationAndNotify(Conversation conv, Long requesterId, String content) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        String requesterName = chatSnapshotHelper.resolveActorDisplayName(conv, requesterId);

        // Tạo tin nhắn hệ thống (Lưu MongoDB)
        internalMessageService.createSystemMessage(conv.getId(), requesterId,
                MessageType.SYSTEM_UPDATE_SETTING, content);

        // 2. Cập nhật Metadata cho Conversation (MySQL) để đồng bộ Sidebar
        conv.setLastMessageContent(content);
        conv.setLastMessageType(MessageType.SYSTEM_UPDATE_SETTING);
        conv.setLastMessageAt(now);
        conv.setLastSenderId(requesterId);
        conv.setLastSenderName(requesterName);
        conversationRepository.save(conv);

        // Bắn Event cập nhật Sidebar (Thông qua Redis Pub/Sub -> Socket)
        ConversationResponse response = conversationMapper.toConversationResponse(conv, requesterId);
        if (response.getLastMessage() != null) {
            response.getLastMessage().setLastSenderName(requesterName);
            response.getLastMessage().setRead(true);
        }

        Set<Long> memberIds = conversationMemberRepository.findUserIdsByConversationIdAndStatus(
                conv.getId(), ConversationMemberStatus.ACTIVE);

        eventPublisher.publishEvent(new ConversationUpdatedEvent(conv.getId(), response.getLastMessage(), memberIds));
    }
}
