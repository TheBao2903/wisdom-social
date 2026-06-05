package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.response.FriendSuggestionResponse;

import java.util.List;

public interface FriendService {
    boolean sendFriendRequest(long senderId, long receiverId);
    boolean acceptFriendRequest(long senderId, long receiverId);
    boolean cancelFriendRequest(long senderId, long receiverId);
    boolean rejectFriendRequest(long senderId, long receiverId);
//    @Scheduled
    void syncFriendRequestsToDb();
    List<User> getFriendRequestOfUser(long userId);
    List<User> getSentRequestsOfUser(long userId);
    List<User> getFriendsOfUser(long userId);
    List<FriendSuggestionResponse> getFriendSuggestions(long userId, int limit);
    List<Long> getAcceptedFriendIds(long userId);
}
