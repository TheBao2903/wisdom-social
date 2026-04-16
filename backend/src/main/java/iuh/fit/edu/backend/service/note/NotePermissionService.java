package iuh.fit.edu.backend.service.note;

import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import iuh.fit.edu.backend.repository.mysql.FriendRepository;
import iuh.fit.edu.backend.constant.FriendStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/*
 * @description: Note permission service - handles authorization checks for Note API
 * @author: The Bao
 * @date: 2026-03-23
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotePermissionService {

    private final UserRepository userRepository;
    private final FriendRepository friendRepository;

    /**
     * Get User by phone number (from JWT token)
     * Normalize phone number: +84xxx -> 0xxx
     */
    public Optional<User> getUserByPhone(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return Optional.empty();
        }
        
        // Normalize phone number: +84 -> 0
        String normalizedPhone = phoneNumber;
        if (phoneNumber.startsWith("+84")) {
            normalizedPhone = "0" + phoneNumber.substring(3);
        }
        
        return Optional.ofNullable(userRepository.findByPhone(normalizedPhone));
    }

    /**
     * Check if requester can view note
     * - Owner can always view
     * - Friends can view
     * - Others cannot view
     */
    public boolean canViewNote(Long noteOwnerId, Long requesterId) {
        if (noteOwnerId == null || requesterId == null) {
            return false;
        }

        // Owner can view their own note
        if (noteOwnerId.equals(requesterId)) {
            return true;
        }

        // Check if they are friends
        return areFriends(noteOwnerId, requesterId);
    }

    /**
     * Check if requester can edit/update note
     * - Only owner can edit
     */
    public boolean canEditNote(Long noteOwnerId, Long requesterId) {
        if (noteOwnerId == null || requesterId == null) {
            return false;
        }
        return noteOwnerId.equals(requesterId);
    }

    /**
     * Check if requester can delete note
     * - Only owner can delete
     */
    public boolean canDeleteNote(Long noteOwnerId, Long requesterId) {
        if (noteOwnerId == null || requesterId == null) {
            return false;
        }
        return noteOwnerId.equals(requesterId);
    }

    /**
     * Check if two users are friends (bidirectional)
     */
    public boolean areFriends(Long userId1, Long userId2) {
        if (userId1.equals(userId2)) {
            return true; // User is friend with themselves
        }

        User user1 = userRepository.findById(userId1).orElse(null);
        User user2 = userRepository.findById(userId2).orElse(null);

        if (user1 == null || user2 == null) {
            return false;
        }

        // Check if both directions have ACCEPTED friendship
        var friend1 = friendRepository.findFriendByUserAndFriend(user1, user2);
        var friend2 = friendRepository.findFriendByUserAndFriend(user2, user1);

        boolean isFriend1 = friend1 != null && FriendStatus.ACCEPTED.equals(friend1.getStatus());
        boolean isFriend2 = friend2 != null && FriendStatus.ACCEPTED.equals(friend2.getStatus());

        return isFriend1 || isFriend2;
    }

    /**
     * Get User by ID
     */
    public Optional<User> getUserById(Long userId) {
        if (userId == null || userId <= 0) {
            return Optional.empty();
        }
        return userRepository.findById(userId);
    }
}
