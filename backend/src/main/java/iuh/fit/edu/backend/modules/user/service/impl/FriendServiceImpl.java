package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import iuh.fit.edu.backend.modules.user.entity.BlockedUser;
import iuh.fit.edu.backend.modules.user.entity.Friend;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.response.FriendEventPayload;
import iuh.fit.edu.backend.modules.user.dto.response.FriendSuggestionResponse;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.service.FriendService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Ngoc Hai
 * @date:
 * @version: 1.0
 */
@Service
@Slf4j
public class FriendServiceImpl implements FriendService {
    StringRedisTemplate redisTemplate;
    SimpMessagingTemplate messagingTemplate;
    FriendRepository friendRepository;
    UserService userService;
    UserRepository userRepository;
    BlockUserRepository blockUserRepository;
    NotificationService notificationService;

    public FriendServiceImpl(FriendRepository friendRepository,
                             SimpMessagingTemplate messagingTemplate, StringRedisTemplate redisTemplate,
                             UserService userService, UserRepository userRepository,
                             BlockUserRepository blockUserRepository,
                             NotificationService notificationService) {
        this.friendRepository = friendRepository;
        this.messagingTemplate = messagingTemplate;
        this.redisTemplate = redisTemplate;
        this.userService = userService;
        this.userRepository = userRepository;
        this.blockUserRepository = blockUserRepository;
        this.notificationService = notificationService;
    }

    @Override
    @Transactional
    public boolean sendFriendRequest(long senderId, long receiverId) {
        String sentKey=buildSentRequestKey(senderId);
        String recievedKey=buildReceivedRequestKey(receiverId);
        String requestKey=buildRequestKey(senderId,receiverId);

        if(senderId>0 && receiverId>0){
            User receiver = userService.findUserById(receiverId);
            User sender = userService.findUserById(senderId);
            
            //save redis
            redisTemplate.opsForSet().add(sentKey, String.valueOf(receiverId));
            redisTemplate.opsForSet().add(recievedKey, String.valueOf(senderId));
            redisTemplate.opsForValue().set(requestKey,FriendStatus.PENDING.toString(), Duration.ofDays(7));
            
            FriendEventPayload payload = FriendEventPayload.builder()
                    .eventType("friend-request")
                    .senderId(senderId)
                    .receiverId(receiverId)
                    .timestamp(OffsetDateTime.now().toString())
                    .build();

            //push websocket to both users so other logged-in devices sync too
            if(sender != null && sender.getPhone() != null) {
                String senderPhone = convertToInternationalFormat(sender.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + senderPhone + "/friend-request",
                        payload
                );
            }
            if(receiver != null && receiver.getPhone() != null) {
                String receiverPhone = convertToInternationalFormat(receiver.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + receiverPhone + "/friend-request",
                        payload
                );
            }

            // Persistent notification (bell) for the receiver
            notificationService.createNotification(NotificationEvent.builder()
                    .recipientId(String.valueOf(receiverId))
                    .actorIds(List.of(String.valueOf(senderId)))
                    .type(NotificationType.FRIEND_REQUEST)
                    .targetType(TargetType.USER)
                    .targetId(String.valueOf(senderId))
                    .content("đã gửi cho bạn lời mời kết bạn")
                    .build());

            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean acceptFriendRequest(long senderId, long receiverId) {
        if(senderId>0 && receiverId>0){
            User sender = userService.findUserById(senderId);
            User receiver = userService.findUserById(receiverId);

            // Check if already friends
            Friend existingFriend = friendRepository.findFriendByUserAndFriend(sender, receiver);
            if(existingFriend == null) {
                existingFriend = friendRepository.findFriendByUserAndFriend(receiver, sender);
            }
            
            if(existingFriend != null && existingFriend.getStatus().equals(FriendStatus.ACCEPTED)) {
                return true;
            }

            redisTemplate.opsForSet()
                    .remove(buildSentRequestKey(senderId), String.valueOf(receiverId));

            redisTemplate.opsForSet()
                    .remove(buildReceivedRequestKey(receiverId), String.valueOf(senderId));

            redisTemplate.delete(buildRequestKey(senderId,receiverId));

            // 2. Lưu DB (only if not exists)
            if(existingFriend == null) {
                Friend friend=Friend.builder()
                        .status(FriendStatus.ACCEPTED)
                        .user(sender)
                        .friend(receiver)
                        .friendAt(OffsetDateTime.now().toLocalDateTime())
                        .build();
                friendRepository.save(friend);
            } else {
                // Update existing to ACCEPTED
                existingFriend.setStatus(FriendStatus.ACCEPTED);
                existingFriend.setFriendAt(OffsetDateTime.now().toLocalDateTime());
                friendRepository.save(existingFriend);
            }

            FriendEventPayload payload = FriendEventPayload.builder()
                    .eventType("friend-accept")
                    .senderId(senderId)
                    .receiverId(receiverId)
                    .timestamp(OffsetDateTime.now().toString())
                    .build();

            // 3. Push realtime cho cả hai phía để đồng bộ nhiều thiết bị
            if(sender != null && sender.getPhone() != null) {
                String senderPhone = convertToInternationalFormat(sender.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + senderPhone + "/friend-accept",
                        payload
                );
            }
            if(receiver != null && receiver.getPhone() != null) {
                String receiverPhone = convertToInternationalFormat(receiver.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + receiverPhone + "/friend-accept",
                        payload
                );
            }

            // Persistent notification (bell) for the original requester (sender)
            notificationService.createNotification(NotificationEvent.builder()
                    .recipientId(String.valueOf(senderId))
                    .actorIds(List.of(String.valueOf(receiverId)))
                    .type(NotificationType.FRIEND_ACCEPT)
                    .targetType(TargetType.USER)
                    .targetId(String.valueOf(receiverId))
                    .content("đã chấp nhận lời mời kết bạn của bạn")
                    .build());

            return true;
        }
        return false;
    }

    @Override
    public boolean cancelFriendRequest(long senderId, long receiverId) {
        if(senderId>0 && receiverId>0){

            Friend friend=friendRepository.findFriendByUserAndFriend(
                    userService.findUserById(senderId),
                    userService.findUserById(receiverId)
            );
            
            if(friend == null) {
                friend = friendRepository.findFriendByUserAndFriend(
                        userService.findUserById(receiverId),
                        userService.findUserById(senderId)
                );
            }

            if(friend==null){
                // Only in Redis, remove from cache
                redisTemplate.opsForSet().remove(buildSentRequestKey(senderId),String.valueOf(receiverId));
                redisTemplate.opsForSet().remove(buildReceivedRequestKey(receiverId),String.valueOf(senderId));
                redisTemplate.delete(buildRequestKey(senderId,receiverId));
            }else {
                // In DB, delete both PENDING and ACCEPTED
                if(friend.getStatus().equals(FriendStatus.PENDING) || 
                   friend.getStatus().equals(FriendStatus.ACCEPTED)){
                    friendRepository.deleteById(friend.getId());
                }
            }

            FriendEventPayload payload = FriendEventPayload.builder()
                    .eventType("friend-cancel")
                    .senderId(senderId)
                    .receiverId(receiverId)
                    .timestamp(OffsetDateTime.now().toString())
                    .build();

            // Push realtime to both users so other logged-in devices sync too
            User sender = userService.findUserById(senderId);
            User receiver = userService.findUserById(receiverId);
            if(sender != null && sender.getPhone() != null) {
                String senderPhone = convertToInternationalFormat(sender.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + senderPhone + "/friend-cancel",
                        payload
                );
            }
            if(receiver != null && receiver.getPhone() != null) {
                String receiverPhone = convertToInternationalFormat(receiver.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + receiverPhone + "/friend-cancel",
                        payload
                );
            }
            return true;
        }
        return false;
    }

    @Override
    public boolean rejectFriendRequest(long senderId, long receiverId) {
        if(senderId>0 && receiverId >0){
            User senderUser = userService.findUserById(senderId);
            User receiverUser = userService.findUserById(receiverId);
            
            // Check both directions in DB
            Friend friend = friendRepository.findFriendByUserAndFriend(senderUser, receiverUser);
            
            if(friend == null) {
                friend = friendRepository.findFriendByUserAndFriend(receiverUser, senderUser);
            }

            redisTemplate.opsForSet().remove(buildSentRequestKey(senderId), String.valueOf(receiverId));
            redisTemplate.opsForSet().remove(buildReceivedRequestKey(receiverId), String.valueOf(senderId));
            redisTemplate.delete(buildRequestKey(senderId, receiverId));

            redisTemplate.opsForSet().remove(buildSentRequestKey(receiverId), String.valueOf(senderId));
            redisTemplate.opsForSet().remove(buildReceivedRequestKey(senderId), String.valueOf(receiverId));
            redisTemplate.delete(buildRequestKey(receiverId, senderId));

            if(friend != null) {
                if(friend.getStatus().equals(FriendStatus.PENDING)){
                    friendRepository.deleteById(friend.getId());
                }
            }

            FriendEventPayload payload = FriendEventPayload.builder()
                    .eventType("friend-reject")
                    .senderId(senderId)
                    .receiverId(receiverId)
                    .timestamp(OffsetDateTime.now().toString())
                    .build();

            if(senderUser != null && senderUser.getPhone() != null) {
                String senderPhone = convertToInternationalFormat(senderUser.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + senderPhone + "/friend-reject",
                        payload
                );
            }
            if(receiverUser != null && receiverUser.getPhone() != null) {
                String receiverPhone = convertToInternationalFormat(receiverUser.getPhone());
                messagingTemplate.convertAndSend(
                        "/topic/user/" + receiverPhone + "/friend-reject",
                        payload
                );
            }
            return true;
        }
        return false;
    }

    @Override
    @Scheduled(fixedRate = 900000000)
    public void syncFriendRequestsToDb() {
        Set<String> keys=redisTemplate.keys("friend:request:*");

        if(keys.isEmpty()) return;

        for(String key: keys){
            String[] parts=key.split(":");
            long senderId=Long.parseLong(parts[2]);
            long receiverId=Long.parseLong(parts[3]);

            Friend friend=Friend.builder()
                    .status(FriendStatus.PENDING)
                    .user(userService.findUserById(senderId))
                    .friend(userService.findUserById(receiverId))
                    .friendAt(OffsetDateTime.now().toLocalDateTime())
                    .build();

            friendRepository.save(friend);

            redisTemplate.opsForSet()
                    .remove(buildReceivedRequestKey(receiverId), String.valueOf(senderId));

            redisTemplate.opsForSet()
                    .remove(buildSentRequestKey(senderId), String.valueOf(receiverId));

            redisTemplate.delete(key);
        }
    }

    @Override
    public List<User> getFriendRequestOfUser(long userId) {
        User user = userService.findUserById(userId);
        if (user != null) {
            List<User> listUser = new ArrayList<>();
            Set<Long> addedUserIds = new HashSet<>();
            
            String receivedKey = buildReceivedRequestKey(userId);
            Set<String> senderIds = redisTemplate.opsForSet().members(receivedKey);
            
            if (senderIds != null) {
                for (String senderIdStr : senderIds) {

                        long senderId = Long.parseLong(senderIdStr);
                        User sender = userService.findUserById(senderId);
                        if (sender != null) {
                            listUser.add(sender);
                            addedUserIds.add(senderId);
                        }
                }
            }

            List<Friend> friends = friendRepository.findFriendsByFriend(user);
            for (Friend friend : friends) {
                if (FriendStatus.PENDING.equals(friend.getStatus())) {
                    long senderId = friend.getUser().getId();
                    if (!addedUserIds.contains(senderId)) {
                        User sender = userService.findUserById(senderId);
                        if (sender != null) {
                            listUser.add(sender);
                            addedUserIds.add(senderId);
                        }
                    }
                }
            }
            
            return listUser;
        }
        return new ArrayList<>();
    }

    @Override
    public List<User> getSentRequestsOfUser(long userId) {
        User user = userService.findUserById(userId);
        if (user != null) {
            List<User> listUser = new ArrayList<>();
            Set<Long> addedUserIds = new HashSet<>();
            
            // Get from Redis first (faster)
            String sentKey = buildSentRequestKey(userId);
            Set<String> receiverIds = redisTemplate.opsForSet().members(sentKey);
            
            if (receiverIds != null) {
                for (String receiverIdStr : receiverIds) {
                    long receiverId = Long.parseLong(receiverIdStr);
                    User receiver = userService.findUserById(receiverId);
                    if (receiver != null) {
                        listUser.add(receiver);
                        addedUserIds.add(receiverId);
                    }
                }
            }

            // Also check database for any pending requests where user is the sender
            List<Friend> friends = friendRepository.findFriendsByUser(user);
            for (Friend friend : friends) {
                if (FriendStatus.PENDING.equals(friend.getStatus())) {
                    long receiverId = friend.getFriend().getId();
                    if (!addedUserIds.contains(receiverId)) {
                        User receiver = userService.findUserById(receiverId);
                        if (receiver != null) {
                            listUser.add(receiver);
                            addedUserIds.add(receiverId);
                        }
                    }
                }
            }
            
            return listUser;
        }
        return new ArrayList<>();
    }

    @Override
    public List<User> getFriendsOfUser(long userId) {
        User user=userService.findUserById(userId);
        List<User> listUser=new ArrayList<>();
        if(user!=null){
            List<Friend> friends= friendRepository.findFriendsByUser(user);
            if (!friends.isEmpty()){
                for (Friend friend:friends){
                    if(FriendStatus.ACCEPTED.equals(friend.getStatus())){
                        User temp=userService.findUserById(friend.getFriend().getId());
                        listUser.add(temp);
                    }
                }

            }

            List<Friend> friendsMy= friendRepository.findFriendsByFriend(user);
            if (!friendsMy.isEmpty()){
                for (Friend friend:friendsMy){
                    if(FriendStatus.ACCEPTED.equals(friend.getStatus())){
                        User temp=userService.findUserById(friend.getUser().getId());
                        listUser.add(temp);
                    }
                }
            }

            return listUser;
        }
        return null;
    }

    @Override
    public List<FriendSuggestionResponse> getFriendSuggestions(long userId, int limit) {
        User me = userService.findUserById(userId);
        if (me == null) return new ArrayList<>();
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 100);

        Set<Long> myFriendIds = collectFriendIds(me);

        Set<Long> exclude = new HashSet<>();
        exclude.add(userId);
        exclude.addAll(myFriendIds);
        exclude.addAll(collectPendingPartnerIds(me));
        exclude.addAll(collectBlockRelatedIds(me));

        Map<Long, Integer> mutualCount = new HashMap<>();
        for (Long friendId : myFriendIds) {
            User friend = userService.findUserById(friendId);
            if (friend == null) continue;
            for (Long candidateId : collectFriendIds(friend)) {
                if (exclude.contains(candidateId)) continue;
                mutualCount.merge(candidateId, 1, Integer::sum);
            }
        }

        List<FriendSuggestionResponse> result = mutualCount.entrySet().stream()
                .sorted(Comparator.<Map.Entry<Long, Integer>>comparingInt(Map.Entry::getValue).reversed())
                .limit(safeLimit)
                .map(e -> toSuggestion(userService.findUserById(e.getKey()), e.getValue()))
                .filter(s -> s != null && isCandidateActive(s.getId()))
                .collect(Collectors.toList());

        if (result.size() < safeLimit) {
            Set<Long> alreadyIn = result.stream().map(FriendSuggestionResponse::getId).collect(Collectors.toSet());
            int need = safeLimit - result.size();
            List<FriendSuggestionResponse> fillers = userRepository.findAll().stream()
                    .filter(u -> u.getId() != null
                            && !exclude.contains(u.getId())
                            && !alreadyIn.contains(u.getId())
                            && isUserActive(u))
                    .limit(need)
                    .map(u -> toSuggestion(u, 0))
                    .filter(s -> s != null)
                    .collect(Collectors.toList());
            result.addAll(fillers);
        }

        return result;
    }

    @Override
    public List<Long> getAcceptedFriendIds(long userId) {
        if (userId <= 0) {
            return Collections.emptyList();
        }
        return friendRepository.findAcceptedFriendIds(userId, FriendStatus.ACCEPTED.ordinal());
    }

    private Set<Long> collectFriendIds(User user) {
        Set<Long> ids = new HashSet<>();
        for (Friend f : friendRepository.findFriendsByUser(user)) {
            if (FriendStatus.ACCEPTED.equals(f.getStatus()) && f.getFriend() != null) {
                ids.add(f.getFriend().getId());
            }
        }
        for (Friend f : friendRepository.findFriendsByFriend(user)) {
            if (FriendStatus.ACCEPTED.equals(f.getStatus()) && f.getUser() != null) {
                ids.add(f.getUser().getId());
            }
        }
        return ids;
    }

    private Set<Long> collectPendingPartnerIds(User user) {
        Set<Long> ids = new HashSet<>();
        for (Friend f : friendRepository.findFriendsByUser(user)) {
            if (FriendStatus.PENDING.equals(f.getStatus()) && f.getFriend() != null) {
                ids.add(f.getFriend().getId());
            }
        }
        for (Friend f : friendRepository.findFriendsByFriend(user)) {
            if (FriendStatus.PENDING.equals(f.getStatus()) && f.getUser() != null) {
                ids.add(f.getUser().getId());
            }
        }
        Set<String> sent = redisTemplate.opsForSet().members(buildSentRequestKey(user.getId()));
        if (sent != null) sent.forEach(s -> ids.add(Long.parseLong(s)));
        Set<String> received = redisTemplate.opsForSet().members(buildReceivedRequestKey(user.getId()));
        if (received != null) received.forEach(s -> ids.add(Long.parseLong(s)));
        return ids;
    }

    private Set<Long> collectBlockRelatedIds(User user) {
        Set<Long> ids = new HashSet<>();
        for (BlockedUser b : blockUserRepository.findBlockedUsersByBlocker(user)) {
            if (b.getBlocked() != null) ids.add(b.getBlocked().getId());
        }
        for (BlockedUser b : blockUserRepository.findBlockedUsersByBlocked(user)) {
            if (b.getBlocker() != null) ids.add(b.getBlocker().getId());
        }
        return ids;
    }

    private boolean isCandidateActive(Long id) {
        if (id == null) return false;
        User u = userService.findUserById(id);
        return isUserActive(u);
    }

    private boolean isUserActive(User u) {
        if (u == null) return false;
        if (u.isLocked()) return false;
        return u.getDeletionScheduledFor() == null;
    }

    private FriendSuggestionResponse toSuggestion(User u, int mutual) {
        if (u == null) return null;
        return FriendSuggestionResponse.builder()
                .id(u.getId())
                .name(u.getName())
                .username(u.getUsername())
                .phone(u.getPhone())
                .avatarUrl(u.getAvatarUrl())
                .bio(u.getBio())
                .mutualFriendsCount(mutual)
                .build();
    }

    private String buildSentRequestKey(long userId){
        return "user:"+userId+":sent_request";
    }

    private String buildReceivedRequestKey(long userId){
        return "user:"+userId+":received_request";
    }

    private String buildRequestKey(long senderId, long receivedId){
        return "friend:request:"+senderId+":"+receivedId;
    }


    private String convertToInternationalFormat(String phone) {
        if (phone == null || phone.isEmpty()) {
            return null;
        }
        
        if (phone.startsWith("+84")) {
            return phone;
        }
        
        if (phone.startsWith("0")) {
            return "+84" + phone.substring(1);
        }

        return "+84" + phone;
    }
}
