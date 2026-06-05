package iuh.fit.edu.backend.modules.user.controller;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.FriendRequest;
import iuh.fit.edu.backend.modules.user.dto.response.FriendSuggestionResponse;
import iuh.fit.edu.backend.modules.user.service.FriendService;
import iuh.fit.edu.backend.common.util.anotation.ApiMessage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
public class FriendController {
    FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @PostMapping("/request")
    @ApiMessage("Sending friend request succesfully")
    public ResponseEntity<String> sendRequest(@RequestBody FriendRequest friendRequest){
        boolean request=friendService.sendFriendRequest(friendRequest.getSenderId(),friendRequest.getReceivedId());
        if(request){
            return ResponseEntity.ok("Sending friend request succesfully");
        }
        return ResponseEntity.badRequest().body("Sending friend request failed");
    }

    @PostMapping("/accept")
    @ApiMessage("Accepted friend request succesfully")
    public ResponseEntity<String> acceptRequest(@RequestBody FriendRequest friendRequest){
        boolean request=friendService.acceptFriendRequest(friendRequest.getSenderId(),friendRequest.getReceivedId());
        if(request){
            return ResponseEntity.ok("Accepted friend request succesfully");
        }
        return ResponseEntity.badRequest().body("Accepte friend request failed");
    }
    // vừa hủy lời mời cũng vừa hủy kết bạn
    @PostMapping("/cancel")
    @ApiMessage("Cancel friend request succesfully")
    public ResponseEntity<String> cancelRequest(@RequestBody FriendRequest friendRequest){
        boolean request=friendService.cancelFriendRequest(friendRequest.getSenderId(),friendRequest.getReceivedId());
        if(request){
            return ResponseEntity.ok("Cancel friend request succesfully");
        }
        return ResponseEntity.badRequest().body("Cancel friend request failed");
    }

    @PostMapping("/reject")
    @ApiMessage("Reject friend request succesfully")
    public ResponseEntity<String> rejectRequest(@RequestBody FriendRequest friendRequest){
        boolean request=friendService.rejectFriendRequest(friendRequest.getSenderId(),friendRequest.getReceivedId());
        if(request){
            return ResponseEntity.ok("Reject friend request succesfully");
        }
        return ResponseEntity.badRequest().body("Reject friend request failed");
    }

    @GetMapping("/requests/{userId}")
    @ApiMessage("Get all friends request for User")
    public ResponseEntity<List<User>> getFriendRequestsForUser(@PathVariable long userId){
        return ResponseEntity.ok(friendService.getFriendRequestOfUser(userId));
    }

    @GetMapping("/sent-requests/{userId}")
    @ApiMessage("Get all sent friend requests for User")
    public ResponseEntity<List<User>> getSentRequestsForUser(@PathVariable long userId){
        return ResponseEntity.ok(friendService.getSentRequestsOfUser(userId));
    }

    @GetMapping("/{userId}")
    @ApiMessage("Get all friends for User")
    public ResponseEntity<List<User>> getFriendsForUser(@PathVariable long userId){
        return ResponseEntity.ok(friendService.getFriendsOfUser(userId));
    }

    @GetMapping("/suggestions/{userId}")
    @ApiMessage("Get friend suggestions for User")
    public ResponseEntity<List<FriendSuggestionResponse>> getFriendSuggestions(
            @PathVariable long userId,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return ResponseEntity.ok(friendService.getFriendSuggestions(userId, limit));
    }
}
