package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.entity.PostShare;
import iuh.fit.edu.backend.modules.post.repository.PostShareRepository;
import iuh.fit.edu.backend.modules.post.repository.PostRepository;
import iuh.fit.edu.backend.modules.post.service.PostShareService;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostShareServiceImpl implements PostShareService {

    private final PostShareRepository postShareRepository;
    private final PostRepository postRepository;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public PostShare sharePost(String userId, String postId, String content) {
        log.info("User {} sharing post {}", userId, postId);

        // 🔒 Validate allowShares for the post
        Post post = postRepository.findById(postId).orElse(null);
        if (post != null && !post.isAllowShares()) {
            log.warn("Share rejected: Post {} has sharing disabled", postId);
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Sharing is disabled for this post"
            );
        }

        PostShare share = PostShare.builder()
                .originalPostId(postId)
                .sharedByUserId(userId)
                .content(content)
                .privacy(PrivacyType.PUBLIC)
                .status(StatusType.ACTIVE)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        PostShare saved = postShareRepository.save(share);

        // Notify the post author that their post was shared (skip self-share)
        try {
            if (post != null && post.getAuthorId() != null
                    && !post.getAuthorId().equals(userId)) {
                notificationService.createNotification(NotificationEvent.builder()
                        .recipientId(post.getAuthorId())
                        .actorIds(List.of(userId))
                        .type(NotificationType.SHARE_POST)
                        .targetType(TargetType.POST)
                        .targetId(post.getId())
                        .rootTargetId(post.getId())
                        .content("đã chia sẻ bài viết của bạn")
                        .build());
            }
        } catch (Exception e) {
            log.error("Failed to send SHARE_POST notification for post {}: {}", postId, e.getMessage());
        }

        return saved;
    }

    @Override
    public List<PostShare> getSharedPostsByUserId(String userId) {
        return postShareRepository.findBySharedByUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    public void deleteShare(String shareId, String userId) {
        postShareRepository.findById(shareId).ifPresent(share -> {
            if (share.getSharedByUserId().equals(userId)) {
                postShareRepository.delete(share);
            }
        });
    }
}
