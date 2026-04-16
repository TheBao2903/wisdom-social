package iuh.fit.edu.backend.service.user.impl;

import iuh.fit.edu.backend.constant.Gender;
import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.domain.entity.mysql.UserSetting;
import iuh.fit.edu.backend.dto.response.user.UserProfileResponse;
import iuh.fit.edu.backend.repository.mysql.FollowRepository;
import iuh.fit.edu.backend.repository.mysql.FriendRepository;
import iuh.fit.edu.backend.repository.mysql.UserSettingRepository;
import iuh.fit.edu.backend.repository.nosql.PostRepository;
import iuh.fit.edu.backend.service.user.FriendService;
import iuh.fit.edu.backend.service.user.UserService;
import iuh.fit.edu.backend.service.user.UserSettingService;
import org.springframework.stereotype.Service;

import java.util.List;

/*
 * @description: Repository for Follow entity
 * @author: The Bao
 * @date: 2026-03-19
 * @versio:n 1.0
 */

@Service
public class UserSettingServiceImpl implements UserSettingService {
    UserService userService;
    FriendService friendService;
    UserSettingRepository userSettingRepository;
    FollowRepository followRepository;
    FriendRepository friendRepository;
    PostRepository postRepository;

    public UserSettingServiceImpl(FriendService friendService,
                                  UserService userService, 
                                  UserSettingRepository userSettingRepository,
                                  FollowRepository followRepository,
                                  FriendRepository friendRepository,
                                  PostRepository postRepository) {
        this.friendService = friendService;
        this.userService = userService;
        this.userSettingRepository = userSettingRepository;
        this.followRepository = followRepository;
        this.friendRepository = friendRepository;
        this.postRepository = postRepository;
    }

    @Override
    public UserProfileResponse getProfileUser(long id) {
        User user = userService.findUserById(id);
        User userCurrent = userService.getCurrentUser();
        UserSetting userSetting = userSettingRepository.findById(user.getId()).orElse(null);

        // Check privacy settings
        boolean isPublic = userSetting == null || PrivacyType.PUBLIC.equals(userSetting.getPrivacyProfile());
        boolean isFriendsOnly = userSetting != null && PrivacyType.FRIENDS.equals(userSetting.getPrivacyProfile());
        boolean isPrivate = userSetting != null && PrivacyType.ONLY_ME.equals(userSetting.getPrivacyProfile());

        // Apply privacy rules
        if (isPrivate) {
            return buildHiddenProfile(user);
        }
        
        if (isFriendsOnly && userCurrent != null) {
            List<User> friends = friendService.getFriendsOfUser(id);
            boolean isFriend = friends.stream().anyMatch(f -> f.getId().equals(userCurrent.getId()));
            if (!isFriend) {
                return buildHiddenProfile(user);
            }
        }

        // Calculate dynamic statistics
        long friendCount = friendRepository.findFriendsByUser(user).size();
        long followerCount = followRepository.countByFollowing(user);
        long followingCount = followRepository.countByFollower(user);
        long postCount = postRepository.findByAuthorIdOrderByCreatedAtDesc(user.getId().toString()).size();

        // Build and return response with stats
        return UserProfileResponse.builder()
                .id(user.getId())
                .phone(user.getPhone())
                .name(user.getName())
                .username(user.getUsername())
                .avatarUrl(user.getAvatarUrl())
                .birthday(user.getBirthday())
                .bio(user.getBio())
                .gender(user.getGender())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .friendCount(friendCount)
                .followerCount(followerCount)
                .followingCount(followingCount)
                .postCount(postCount)
                .build();
    }

    private UserProfileResponse buildHiddenProfile(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .phone("*****")
                .name("*****")
                .username("*****")
                .avatarUrl(null)
                .birthday("*****")
                .bio("*****")
                .gender(Gender.OTHER)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .friendCount(0L)
                .followerCount(0L)
                .followingCount(0L)
                .postCount(0L)
                .build();
    }
}
