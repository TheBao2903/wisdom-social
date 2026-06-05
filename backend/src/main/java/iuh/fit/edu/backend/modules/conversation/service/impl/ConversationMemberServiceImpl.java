/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.common.exception.ConversationAccessDeniedException;
import iuh.fit.edu.backend.modules.conversation.dto.response.JoinRequestResponse;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.entity.FrozenLastMessage;
import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberWithInvitesRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberRequest;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.event.payload.*;
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
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberCacheService;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import iuh.fit.edu.backend.modules.chat.service.InternalMessageService;
import iuh.fit.edu.backend.common.util.TransactionUtil;
import iuh.fit.edu.backend.common.util.heplper.ChatSnapshotHelper;
import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
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
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationMemberServiceImpl implements ConversationMemberService {
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationMemberMapper conversationMemberMapper;
    private final ConversationRepository conversationRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final UserRepository userRepository;
    private final ConversationMapper conversationMapper;
    private final InternalMessageService internalMessageService;
    private final ConversationMemberCacheService conversationMemberCacheService;
    private final ChatSnapshotHelper chatSnapshotHelper;
    private final GroupJoinRequestService joinRequestService;
    private final FriendRepository friendRepository;

    /**
     * Lấy danh sách toàn bộ thành viên. Ưu tiên lấy từ Cache, nếu rỗng thì gọi DB.
     */
    @Override
    public Map<Long, ConversationMemberResponse> getMembersMap(Long conversationId) {
        // Kéo từ Redis
        Map<Long, ConversationMemberResponse> cachedMap = conversationMemberCacheService.getMembersMap(conversationId);
        Map<Long, ConversationMemberResponse> result;
        if (!cachedMap.isEmpty()) {
            result = cachedMap;
        } else {
            // Nếu Redis trống, chọc xuống MySQL
            List<ConversationMember> members = conversationMemberRepository.findByConversation_Id(conversationId);
            Map<Long, ConversationMemberResponse> dbMap = members.stream()
                    .map(conversationMemberMapper::toConversationMemberResponse)
                    .collect(Collectors.toMap(ConversationMemberResponse::getUserId, m -> m));

            // Nạp lại vào Redis để lần sau đọc cho nhanh
            conversationMemberCacheService.saveMembersMap(conversationId, dbMap);
            result = dbMap;
        }

        // Overlay trạng thái khóa TƯƠI từ DB lên kết quả (kể cả khi lấy từ cache).
        // Bảo đảm accountLocked luôn đúng dù cache members chưa được invalidate,
        // để FE mask đúng tên/avatar (đặc biệt cho group, vốn không có cờ riêng).
        applyFreshLockStatus(result);
        return result;
    }

    /**
     * Cập nhật lại cờ accountLocked cho từng member dựa trên trạng thái khóa hiện
     * tại trong bảng User. Mutate trực tiếp các DTO (đối tượng mới deserialize từ
     * Redis hoặc vừa map từ DB nên an toàn). Chỉ 1 truy vấn IN.
     */
    private void applyFreshLockStatus(Map<Long, ConversationMemberResponse> membersMap) {
        if (membersMap == null || membersMap.isEmpty()) return;
        Set<Long> lockedUserIds = userRepository.findLockedUserIds(membersMap.keySet());
        membersMap.forEach((userId, response) ->
                response.setAccountLocked(lockedUserIds.contains(userId)));
    }

    /**
     * Lấy thông tin 1 thành viên. Dùng cho hàm Gửi tin, Ghim tin...
     */
    @Override
    public ConversationMemberResponse getMemberInfo(Long conversationId, Long userId) {
        ConversationMemberResponse cachedMember = conversationMemberCacheService.getMemberInfo(conversationId, userId);
        if (cachedMember != null && cachedMember.getStatus().equals(ConversationMemberStatus.ACTIVE)) {
            return cachedMember;
        }

        ConversationMemberResponse response = conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(conversationId, userId, ConversationMemberStatus.ACTIVE)
                .map(conversationMemberMapper::toConversationMemberResponse)
                        .orElseThrow(() -> new RuntimeException("Không tim thấy thành viên cuộc trò chuyện"));

        conversationMemberCacheService.saveMemberInfo(conversationId, userId, response);
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse addMembers(Long conversationId, AddMemberRequest request, Long inviterId) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        // Kiểm tra phòng chat
        Conversation conv = validateGroupAndInviter(conversationId, inviterId);
        ConversationMember inviter = getActiveMember(conversationId, inviterId);
        Set<Long> targetIds = normalizeTargetIds(request.getNewMemberIds(), inviterId);
        Set<Long> blockedRejectedIds = findBlockedRejectedIds(conv.getId(), targetIds, inviter);

        // LUỒNG DUYỆT THÀNH VIÊN
        if (conv.isJoinApprovalRequired() && inviter.getRole() == MemberRole.MEMBER) {
            Set<Long> requestableIds = new HashSet<>(targetIds);
            requestableIds.removeAll(blockedRejectedIds);
            for (Long targetUserId : requestableIds) {
                joinRequestService.createRequest(conversationId, targetUserId, inviterId);
            }

            String targetIdsJson = chatSnapshotHelper.buildMemberSnapshotContent(requestableIds);

            ConversationResponse response = requestableIds.isEmpty()
                    ? null
                    : executeSystemActionAndBuildResponse(
                    conv, inviterId, MessageType.SYSTEM_REQUIRE_APPROVAL, targetIdsJson, now);

            if (!blockedRejectedIds.isEmpty()) {
                response = executeSystemActionAndBuildResponse(
                        conv,
                        inviterId,
                        MessageType.SYSTEM_MEMBER_BLOCKED_FROM_JOIN,
                        chatSnapshotHelper.buildMemberSnapshotContent(blockedRejectedIds),
                        Instant.now().truncatedTo(ChronoUnit.MILLIS));
            }

            if (response == null) {
                return conversationMapper.toConversationResponse(conv, inviterId);
            }

            Set<Long> allActiveMemberIds = conversationMemberRepository
                    .findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);

            // Cập nhật Sidebar cho tất cả mọi người
            eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, response.getLastMessage(), allActiveMemberIds));
            return response;
        }

        MemberAdditionResult additionResult = prepareMembersForAddition(
                conv, targetIds, inviter, now);

        // Nếu tất cả ID gửi lên đều đã nằm trong nhóm (ACTIVE) rồi thì dừng luôn
        if (additionResult.actuallyAddedIds().isEmpty() && additionResult.blockedRejectedIds().isEmpty()) {
            return conversationMapper.toConversationResponse(conv, inviterId);
        }
        List<ConversationMember> conversationMembers = additionResult.membersToSave().isEmpty()
                ? Collections.emptyList()
                : conversationMemberRepository.saveAll(additionResult.membersToSave());

        // Cập nhật thông tin cho redis
        TransactionUtil.executeAfterCommit(() -> {
            for (ConversationMember member : conversationMembers){
                this.conversationMemberCacheService.saveMemberInfo(conversationId, member.getUser().getId(), conversationMemberMapper.toConversationMemberResponse(member));
            }
        });

        // Nếu danh sách add chỉ có 1 người, và người đó chính là người mời -> Là luồng bấm Link!
        boolean isJoinViaLink = additionResult.actuallyAddedIds().size() == 1 && additionResult.actuallyAddedIds().contains(inviterId);
        MessageType msgType = isJoinViaLink ? MessageType.SYSTEM_JOIN_VIA_LINK : MessageType.SYSTEM_ADD_MEMBER;

        // Ghi Log vào MongoDB qua MessageFacade
        String targetIdsJson = chatSnapshotHelper.buildMemberSnapshotContent(additionResult.actuallyAddedIds());

        ConversationResponse response = additionResult.actuallyAddedIds().isEmpty()
                ? null
                : executeSystemActionAndBuildResponse(
                conv, inviterId, msgType, targetIdsJson, now);

        if (!additionResult.blockedRejectedIds().isEmpty()) {
            response = executeSystemActionAndBuildResponse(
                    conv,
                    inviterId,
                    MessageType.SYSTEM_MEMBER_BLOCKED_FROM_JOIN,
                    chatSnapshotHelper.buildMemberSnapshotContent(additionResult.blockedRejectedIds()),
                    Instant.now().truncatedTo(ChronoUnit.MILLIS));
        }

        Set<Long> allActiveMemberIds = conversationMemberRepository
                .findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);

        eventPublisher.publishEvent(new MemberAddedEvent(response, allActiveMemberIds));
        additionResult.unblockedByAdminIds().forEach(userId ->
                publishBlockedMembersUpdated(conversationId, userId, false));
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse addMembersWithInvites(Long conversationId, AddMemberWithInvitesRequest request, Long inviterId) {
        Conversation conv = validateGroupAndInviter(conversationId, inviterId);
        Set<Long> directMemberIds = normalizeTargetIds(request.getNewMemberIds(), inviterId);
        Set<Long> inviteeUserIds = normalizeTargetIds(request.getInviteeUserIds(), inviterId);
        inviteeUserIds.removeAll(directMemberIds);

        if (directMemberIds.isEmpty() && inviteeUserIds.isEmpty()) {
            throw new IllegalArgumentException("Vui long chon it nhat 1 nguoi de them vao nhom");
        }

        validateAcceptedFriends(inviterId, directMemberIds, "Chi co the them truc tiep ban be vao nhom");
        validateStrangerInvitees(inviterId, inviteeUserIds);
        removeExistingActiveMembers(conversationId, inviteeUserIds);

        ConversationResponse response = null;
        if (!directMemberIds.isEmpty()) {
            AddMemberRequest addMemberRequest = new AddMemberRequest();
            addMemberRequest.setNewMemberIds(directMemberIds);
            response = addMembers(conversationId, addMemberRequest, inviterId);
        }

        if (!inviteeUserIds.isEmpty()) {
            String inviteToken = ensureInviteToken(conv);
            String content = chatSnapshotHelper.buildMemberSnapshotContent(inviteeUserIds);
            response = executeSystemActionAndBuildResponse(
                    conv,
                    inviterId,
                    MessageType.SYSTEM_GROUP_INVITE_LINK_SENT,
                    content,
                    Instant.now().truncatedTo(ChronoUnit.MILLIS)
            );

            Set<Long> activeMemberIds = conversationMemberRepository
                    .findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);
            eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, response.getLastMessage(), activeMemberIds));
            eventPublisher.publishEvent(new GroupInviteLinkDispatchEvent(
                    inviterId,
                    conversationId,
                    inviteToken,
                    inviteeUserIds
            ));
        }

        return response != null ? response : conversationMapper.toConversationResponse(conv, inviterId);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse joinByInviteLink(Long conversationId, Long userId) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP
                && conv.getInviteToken() != null
                && !conv.getInviteToken().isBlank()) {
            conv.setType(ConversationType.GROUP);
            conv.setDirectKey(null);
            conv = conversationRepository.save(conv);
        }

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ nhóm chat mới có thể tham gia bằng link");
        }

        ConversationMember member = conversationMemberRepository
                .findByConversation_IdAndUser_Id(conversationId, userId)
                .orElse(null);

        if (member != null && member.getStatus() == ConversationMemberStatus.ACTIVE) {
            return conversationMapper.toConversationResponse(conv, userId);
        }

        if (member != null && member.getStatus() == ConversationMemberStatus.BLOCKED) {
            throw new ConversationAccessDeniedException("Bạn đã bị chặn khỏi nhóm.");
        }

//        if (member != null && member.getStatus() == ConversationMemberStatus.KICKED) {
//            throw new RuntimeException("Bạn đã bị chặn khỏi nhóm");
//        }

        if (member == null) {
            member = new ConversationMember();
            member.setConversation(conv);
            member.setUser(userRepository.getReferenceById(userId));
        }

        member.setRole(MemberRole.MEMBER);
        member.setStatus(ConversationMemberStatus.ACTIVE);
        member.setJoinedAt(now);
        member.setLeftAt(null);
        member.setBlockedAt(null);
        member.setBlockedBy(null);
        member.setClearedAt(null);
        member.setHidden(false);

        ConversationMember savedMember = conversationMemberRepository.save(member);

        TransactionUtil.executeAfterCommit(() ->
                conversationMemberCacheService.saveMemberInfo(
                        conversationId,
                        userId,
                        conversationMemberMapper.toConversationMemberResponse(savedMember)
                )
        );

        String targetIdsJson = chatSnapshotHelper.buildMemberSnapshotContent(Collections.singleton(userId));
        ConversationResponse response = executeSystemActionAndBuildResponse(
                conv, userId, MessageType.SYSTEM_JOIN_VIA_LINK, targetIdsJson, now);

        Set<Long> allActiveMemberIds = conversationMemberRepository
                .findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);

        eventPublisher.publishEvent(new MemberAddedEvent(response, allActiveMemberIds));
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse leaveGroup(Long conversationId, Long userId) {
        // 1. Chỉ validate logic Leave
        Conversation conv = validateLeavePermission(conversationId, userId);

        // 2. Gọi hàm lõi dùng chung
        return processMemberRemoval(conv, userId, userId,
                ConversationMemberStatus.LEFT, MessageType.SYSTEM_LEAVE_GROUP, "[]", DomainEventType.MEMBER_LEFT);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse kickMember(Long conversationId, Long targetId, Long requesterId) {
        // Chỉ validate logic Kick
        Conversation conv = validateKickPermission(conversationId, targetId, requesterId);

        // Gọi hàm lõi dùng chung
        return processMemberRemoval(conv, targetId, requesterId,
                ConversationMemberStatus.KICKED, MessageType.SYSTEM_KICK_MEMBER, chatSnapshotHelper.buildKickSnapshotContent(targetId), DomainEventType.MEMBER_KICKED);
    }



    /**
     * Hàm dùng để đồng bộ dữ liệu vào Redis ngay sau khi DB vừa cập nhật.
     * Dùng cho tính năng "Đã xem" (Seen) hoặc "Xóa lịch sử" (ClearedAt).
     */
    @Override
    public void updateMemberStateInCache(Long conversationId, Long userId, ConversationMember memberEntity) {
        ConversationMemberResponse updatedInfo = conversationMemberMapper.toConversationMemberResponse(memberEntity);
        TransactionUtil.executeAfterCommit(() -> {
            conversationMemberCacheService.saveMemberInfo(conversationId, userId, updatedInfo);
        });
    }

    /**
     * Logic Đổi biệt danh. Cần cập nhật DB, Cập nhật Cache, và Bắn WebSocket.
     */
    @Transactional
    @Override
    public void updateNickname(Long conversationId, Long targetUserId, String newNickname) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(conversationId, targetUserId, ConversationMemberStatus.ACTIVE)
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
        return  this.conversationMemberRepository.findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse updateMemberRole(Long conversationId, Long targetId, Long requesterId, MemberRole newRole) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        // Kiểm tra phòng và lấy thông tin 2 người
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        ConversationMember requester = getActiveMember(conversationId, requesterId);
        ConversationMember target = getActiveMember(conversationId, targetId);

        // Kiểm tra tính hợp lệ (Chỉ OWNER mới được làm điều này)
        validateRoleUpdatePermission(conv, requester, target, newRole);

        // Xử lý logic cập nhật (1 dòng hay 2 dòng DB?)
        List<ConversationMember> membersToUpdate = new ArrayList<>();

        if (newRole == MemberRole.OWNER) {
            requester.setRole(MemberRole.MEMBER);
            target.setRole(MemberRole.OWNER);
            membersToUpdate.add(requester);
            membersToUpdate.add(target);
        } else {
            // Chỉ update người kia
            target.setRole(newRole);
            membersToUpdate.add(target);
        }
        conversationMemberRepository.saveAll(membersToUpdate);

        // Cập nhật thông tin cho redis
        TransactionUtil.executeAfterCommit(() -> {
            for (ConversationMember m : membersToUpdate) {
                ConversationMemberResponse memberResponse = conversationMemberMapper.toConversationMemberResponse(m);
                conversationMemberCacheService.saveMemberInfo(conversationId, m.getUser().getId(), memberResponse);
            }
        });

        // Tạo JSON Content cho tin nhắn hệ thống
        // Đính kèm luôn tên hiển thị để FE render sidebar và timeline đồng nhất
        String sysMsgContent = chatSnapshotHelper.buildRoleSnapshotContent(targetId, newRole.name());

        ConversationResponse response = executeSystemActionAndBuildResponse(
                conv, requesterId, MessageType.SYSTEM_UPDATE_ROLE, sysMsgContent, now);

        Set<Long> allNotifyIds = conversationMemberRepository
                .findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);
        eventPublisher.publishEvent(new MemberRoleUpdatedEvent(response, allNotifyIds));

        return response;
    }

    @Override
    public List<ConversationMemberResponse> getBlockedMembers(Long conversationId, Long requesterId) {
        validateGroupAdmin(conversationId, requesterId);
        return conversationMemberRepository
                .findByConversationIdAndStatusOrderByBlockedAtDesc(conversationId, ConversationMemberStatus.BLOCKED)
                .stream()
                .map(conversationMemberMapper::toConversationMemberResponse)
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse blockMember(Long conversationId, Long targetId, Long requesterId) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));
        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chi co the ap dung cho nhom chat");
        }
        ConversationMember requester = getActiveMember(conversationId, requesterId);
        if (!isGroupAdmin(requester)) {
            throw new RuntimeException("Ban khong co quyen thuc hien hanh dong nay");
        }

        ConversationMember target = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, targetId)
                .orElse(null);
        boolean targetWasActive = target != null && target.getStatus() == ConversationMemberStatus.ACTIVE;
        if (targetWasActive) {
            validateKickPermission(conversationId, targetId, requesterId);
        }

        if (target == null) {
            target = new ConversationMember();
            target.setConversation(conv);
            target.setUser(userRepository.getReferenceById(targetId));
            target.setRole(MemberRole.MEMBER);
        }

        target.setStatus(ConversationMemberStatus.BLOCKED);
        target.setRole(MemberRole.MEMBER);
        target.setBlockedAt(now);
        target.setBlockedBy(userRepository.getReferenceById(requesterId));
        target.setLeftAt(now);
        target.setFrozenLastMessage(new FrozenLastMessage(
                chatSnapshotHelper.buildKickSnapshotContent(targetId),
                requesterId,
                chatSnapshotHelper.resolveActorDisplayName(conv, requesterId),
                MessageType.SYSTEM_BLOCK_MEMBER,
                now
        ));
        ConversationMember savedMember = conversationMemberRepository.save(target);
        updateMemberStateInCache(conversationId, targetId, savedMember);

        ConversationResponse response = executeSystemActionAndBuildResponse(
                conv,
                requesterId,
                MessageType.SYSTEM_BLOCK_MEMBER,
                chatSnapshotHelper.buildKickSnapshotContent(targetId),
                now);

        Set<Long> notifyIds = conversationMemberRepository
                .findUserIdsByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);
        if (targetWasActive) {
            notifyIds.add(targetId);
            eventPublisher.publishEvent(new MemberStatusChangedEvent(response, DomainEventType.MEMBER_KICKED, notifyIds));
        } else {
            eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, response.getLastMessage(), notifyIds));
        }
        publishBlockedMembersUpdated(conversationId, targetId, true);

        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ConversationResponse unblockMember(Long conversationId, Long targetId, Long requesterId) {
        Conversation conv = validateGroupAdmin(conversationId, requesterId);
        ConversationMember target = conversationMemberRepository.findByConversation_IdAndUser_Id(conversationId, targetId)
                .orElseThrow(() -> new RuntimeException("Thanh vien khong ton tai trong nhom"));

        if (target.getStatus() != ConversationMemberStatus.BLOCKED) {
            return conversationMapper.toConversationResponse(conv, requesterId);
        }

        target.setStatus(ConversationMemberStatus.KICKED);
        target.setBlockedAt(null);
        target.setBlockedBy(null);
        ConversationMember savedMember = conversationMemberRepository.save(target);
        updateMemberStateInCache(conversationId, targetId, savedMember);
        publishBlockedMembersUpdated(conversationId, targetId, false);

        return conversationMapper.toConversationResponse(conv, requesterId);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void disbandGroup(Long conversationId, Long requesterId) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        // 1. Kiểm tra phòng và quyền Trưởng nhóm
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        ConversationMember requester = getActiveMember(conversationId, requesterId);
        if (requester.getRole() != MemberRole.OWNER) {
            throw new RuntimeException("Chỉ Trưởng nhóm mới có quyền giải tán nhóm");
        }

        // 2. Lấy danh sách tất cả thành viên đang ACTIVE để xử lý
        List<ConversationMember> activeMembers = conversationMemberRepository
                .findByConversationIdAndStatus(conversationId, ConversationMemberStatus.ACTIVE);

        Set<Long> allNotifyIds = activeMembers.stream()
                .map(m -> m.getUser().getId()).collect(Collectors.toSet());
        String requesterName = chatSnapshotHelper.resolveActorDisplayName(conv, requesterId);

        // Cập nhật trạng thái hàng loạt trong MySQL
        for (ConversationMember member : activeMembers) {
            member.setStatus(ConversationMemberStatus.GROUP_DISBANDED);
            member.setLeftAt(now);
            member.setUnreadCount(0);
            member.setFrozenLastMessage(new FrozenLastMessage(
                    "[]",
                    requesterId,
                    requesterName,
                    MessageType.SYSTEM_DISBAND_GROUP,
                    now
            ));
        }
        conversationMemberRepository.saveAll(activeMembers);

        TransactionUtil.executeAfterCommit(() ->
                conversationMemberCacheService.evictConversation(conversationId)
        );

        ConversationResponse response = executeSystemActionAndBuildResponse(
                conv, requesterId, MessageType.SYSTEM_DISBAND_GROUP, "[]", now);

        eventPublisher.publishEvent(new GroupDisbandedEvent(conversationId, allNotifyIds, response.getLastMessage()));
    }

// ======================= HÀM HELPER =======================

    private void validateRoleUpdatePermission(Conversation conv, ConversationMember requester,
                                              ConversationMember target, MemberRole newRole) {
        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ có thể phân quyền trong nhóm chat");
        }

        if (requester.getRole() != MemberRole.OWNER) {
            throw new RuntimeException("Chỉ Trưởng nhóm mới có quyền thay đổi vai trò thành viên");
        }

        if (requester.getUser().getId().equals(target.getUser().getId())) {
            throw new RuntimeException("Bạn không thể tự thay đổi quyền của chính mình");
        }

        if (target.getRole() == newRole) {
            throw new RuntimeException("Thành viên này đã giữ vai trò " + newRole.name() + " rồi");
        }
    }

    private Conversation validateLeavePermission(Long convId, Long userId) {
        Conversation conv = conversationRepository.findById(convId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ có thể rời khỏi nhóm chat");
        }

        ConversationMember member = getActiveMember(convId, userId);

        // Trưởng nhóm không được tự ý bỏ đi nếu nhóm còn người khác
        if (member.getRole() == MemberRole.OWNER) {
            long activeCount = conversationMemberRepository.countByConversationIdAndStatus(convId, ConversationMemberStatus.ACTIVE);
            if (activeCount > 1) {
                throw new RuntimeException("Bạn là Trưởng nhóm. Hãy chuyển quyền cho người khác trước khi rời đi.");
            }
        }
        return conv;
    }

    private Conversation validateKickPermission(Long convId, Long targetId, Long requesterId) {
        Conversation conv = conversationRepository.findById(convId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ có thể áp dụng cho nhóm chat");
        }

        ConversationMember requester = getActiveMember(convId, requesterId);
        ConversationMember target = getActiveMember(convId, targetId);

        if (requester.getRole() == MemberRole.MEMBER) {
            throw new RuntimeException("Bạn không có quyền mời thành viên ra khỏi nhóm");
        }
        if (target.getRole() == MemberRole.OWNER) {
            throw new RuntimeException("Không thể mời Trưởng nhóm ra khỏi nhóm");
        }
        if (requester.getRole() == MemberRole.DEPUTY && target.getRole() == MemberRole.DEPUTY) {
            throw new RuntimeException("Phó nhóm không thể mời Phó nhóm khác ra khỏi nhóm");
        }
        return conv;
    }

    private ConversationMember getActiveMember(Long convId, Long userId) {
        ConversationMember member = conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(convId, userId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("Thành viên không tồn tại trong nhóm"));
        if (member.getStatus() != ConversationMemberStatus.ACTIVE) {
            throw new RuntimeException("Thành viên này không còn hoạt động trong nhóm");
        }
        return member;
    }

    private ConversationResponse executeSystemActionAndBuildResponse(
            Conversation conv, Long actorId, MessageType type, String content, Instant now) {

        // Lưu MongoDB
        internalMessageService.createSystemMessage(conv.getId(), actorId, type, content);

        // Cập nhật Snapshot (MySQL)
        String actorName = chatSnapshotHelper.resolveActorDisplayName(conv, actorId);
        conv.setLastMessageContent(content);
        conv.setLastSenderId(actorId);
        conv.setLastMessageType(type);
        conv.setLastMessageAt(now);
        conv.setLastSenderName(actorName);
        conversationRepository.save(conv);

        // Map DTO và xử lý cờ Read
        ConversationResponse response = conversationMapper.toConversationResponse(conv, actorId);
        if (response.getLastMessage() != null) {
            response.getLastMessage().setLastSenderName(actorName);
            response.getLastMessage().setRead(true);
        }
        return response;
    }

    private ConversationResponse processMemberRemoval(
            Conversation conv, Long targetId, Long requesterId,
            ConversationMemberStatus newStatus, MessageType sysMsgType, String sysMsgContent, DomainEventType eventType) {

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        Long convId = conv.getId();

        // Cập nhật DB cho nạn nhân (Soft Delete)
        ConversationMember target = getActiveMember(convId, targetId);
        target.setStatus(newStatus);
        target.setRole(MemberRole.MEMBER);
        target.setLeftAt(now);
        target.setUnreadCount(0);
        if (newStatus == ConversationMemberStatus.BLOCKED) {
            target.setBlockedAt(now);
            target.setBlockedBy(userRepository.getReferenceById(requesterId));
        } else {
            target.setBlockedAt(null);
            target.setBlockedBy(null);
        }
        target.setFrozenLastMessage(
                new FrozenLastMessage(
                        sysMsgContent,
                        requesterId,
                        chatSnapshotHelper.resolveActorDisplayName(conv, requesterId),
                        sysMsgType,
                        now
                )
        );
        conversationMemberRepository.save(target);

        // Cập nhật thông tin cho redis
        ConversationMemberResponse memberResponse = conversationMemberMapper.toConversationMemberResponse(target);
        TransactionUtil.executeAfterCommit(() -> {
            conversationMemberCacheService.saveMemberInfo(convId, targetId, memberResponse);
        });

        // Gom ID để bắn Socket (Bao gồm cả người vừa out để họ biết đường khóa ô chat)
        Set<Long> allNotifyIds = conversationMemberRepository
                .findUserIdsByConversationIdAndStatus(convId, ConversationMemberStatus.ACTIVE);
        allNotifyIds.add(targetId);

        ConversationResponse response = executeSystemActionAndBuildResponse(
                conv, requesterId, sysMsgType, sysMsgContent, now);

        eventPublisher.publishEvent(new MemberStatusChangedEvent(response, eventType, allNotifyIds));
        if (newStatus == ConversationMemberStatus.BLOCKED) {
            publishBlockedMembersUpdated(convId, targetId, true);
        }
        return response;
    }

    private Conversation validateGroupAndInviter(Long conversationId, Long inviterId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chỉ có thể thêm thành viên vào nhóm");
        }

        ConversationMember inviter = conversationMemberRepository.findByConversation_IdAndUser_IdAndStatus(conversationId, inviterId, ConversationMemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("Bạn không nằm trong nhóm này"));

        if (inviter.getStatus() != ConversationMemberStatus.ACTIVE) {
            throw new RuntimeException("Bạn không có quyền thực hiện hành động này");
        }
        return conv;
    }

    private Conversation validateGroupAdmin(Long conversationId, Long requesterId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Chi co the ap dung cho nhom chat");
        }

        ConversationMember requester = getActiveMember(conversationId, requesterId);
        if (!isGroupAdmin(requester)) {
            throw new RuntimeException("Ban khong co quyen thuc hien hanh dong nay");
        }
        return conv;
    }

    private MemberAdditionResult prepareMembersForAddition(
            Conversation conv, Set<Long> rawIds, ConversationMember inviter, Instant now) {

        // Lọc danh sách được mời (Bỏ ID của chính người mời nếu FE gửi nhầm)
        Set<Long> targetIds = new HashSet<>(rawIds);
        targetIds.remove(inviter.getUser().getId());

        // Thêm mới hoặc Cập nhật người cũ
        // Lấy tất cả record của những người này trong nhóm (kể cả đã LEFT/KICKED)
        List<ConversationMember> existingRecords = conversationMemberRepository
                .findByConversationIdAndUserIdIn(conv.getId(), targetIds);

        Map<Long, ConversationMember> existingMap = existingRecords.stream()
                .collect(Collectors.toMap(m -> m.getUser().getId(), m -> m));

        List<ConversationMember> membersToSave = new ArrayList<>();
        Set<Long> actuallyAddedIds = new HashSet<>();
        Set<Long> blockedRejectedIds = new HashSet<>();
        Set<Long> unblockedByAdminIds = new HashSet<>();
        boolean inviterCanUnblock = isGroupAdmin(inviter);

        for (Long tId : targetIds) {
            if (existingMap.containsKey(tId)) {
                // Trường hợp 1: Người cũ (Đã Left/Kicked)
                ConversationMember em = existingMap.get(tId);
                if (em.getStatus() == ConversationMemberStatus.BLOCKED && !inviterCanUnblock) {
                    blockedRejectedIds.add(tId);
                } else if (em.getStatus() != ConversationMemberStatus.ACTIVE) {
                    if (em.getStatus() == ConversationMemberStatus.BLOCKED) {
                        unblockedByAdminIds.add(tId);
                    }
                    em.setStatus(ConversationMemberStatus.ACTIVE);
                    em.setJoinedAt(now);
                    em.setLeftAt(null); // Xóa mốc thời gian rời đi
                    em.setClearedAt(null); // Reset lại mốc xóa để xem được toàn bộ tin nhắn
                    em.setHidden(false); // Đảm bảo hiện lại hội thoại nếu trước đó đã ẩn/xóa
                    em.setBlockedAt(null);
                    em.setBlockedBy(null);
                    membersToSave.add(em);
                    actuallyAddedIds.add(tId);
                }
            } else {
                // Trường hợp 2: Người mới hoàn toàn
                ConversationMember nm = new ConversationMember();
                nm.setConversation(conv);
                nm.setUser(userRepository.getReferenceById(tId));
                nm.setRole(MemberRole.MEMBER);
                nm.setStatus(ConversationMemberStatus.ACTIVE);
                nm.setJoinedAt(now);
                membersToSave.add(nm);
                actuallyAddedIds.add(tId);
            }
        }
        return new MemberAdditionResult(membersToSave, actuallyAddedIds, blockedRejectedIds, unblockedByAdminIds);
    }

    private Set<Long> normalizeTargetIds(Set<Long> rawIds, Long inviterId) {
        Set<Long> targetIds = new HashSet<>(rawIds);
        targetIds.remove(inviterId);
        return targetIds;
    }

    private Set<Long> findBlockedRejectedIds(Long conversationId, Set<Long> targetIds, ConversationMember inviter) {
        if (targetIds.isEmpty() || isGroupAdmin(inviter)) {
            return Collections.emptySet();
        }
        return conversationMemberRepository.findByConversationIdAndUserIdIn(conversationId, targetIds)
                .stream()
                .filter(member -> member.getStatus() == ConversationMemberStatus.BLOCKED)
                .map(member -> member.getUser().getId())
                .collect(Collectors.toSet());
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

    private void removeExistingActiveMembers(Long conversationId, Set<Long> userIds) {
        if (userIds.isEmpty()) {
            return;
        }
        Set<Long> activeIds = conversationMemberRepository
                .findByConversationIdAndUserIdIn(conversationId, userIds)
                .stream()
                .filter(member -> member.getStatus() == ConversationMemberStatus.ACTIVE)
                .map(member -> member.getUser().getId())
                .collect(Collectors.toSet());
        userIds.removeAll(activeIds);
    }

    private String ensureInviteToken(Conversation conversation) {
        if (conversation.getInviteToken() == null || conversation.getInviteToken().isBlank()) {
            conversation.setInviteToken(java.util.UUID.randomUUID().toString().replace("-", ""));
            conversationRepository.save(conversation);
        }
        return conversation.getInviteToken();
    }

    private void publishBlockedMembersUpdated(Long conversationId, Long targetUserId, boolean blocked) {
        Set<Long> adminIds = conversationMemberRepository.findAdminIdsByConversationId(conversationId);
        if (!adminIds.isEmpty()) {
            eventPublisher.publishEvent(new BlockedMembersUpdatedEvent(conversationId, targetUserId, blocked, adminIds));
        }
    }

    private boolean isGroupAdmin(ConversationMember member) {
        return member.getRole() == MemberRole.OWNER || member.getRole() == MemberRole.DEPUTY;
    }

    private record MemberAdditionResult(
            List<ConversationMember> membersToSave,
            Set<Long> actuallyAddedIds,
            Set<Long> blockedRejectedIds,
            Set<Long> unblockedByAdminIds) {
    }

}


