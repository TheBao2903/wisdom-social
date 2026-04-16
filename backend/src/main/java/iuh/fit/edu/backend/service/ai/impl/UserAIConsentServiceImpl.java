package iuh.fit.edu.backend.service.ai.impl;

import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.user.ConfirmAIRequest;
import iuh.fit.edu.backend.dto.user.ConfirmAIResponse;
import iuh.fit.edu.backend.exception.AIConsentRequiredException;
import iuh.fit.edu.backend.exception.ConversationAccessDeniedException;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import iuh.fit.edu.backend.service.ai.UserAIConsentService;
import iuh.fit.edu.backend.service.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class UserAIConsentServiceImpl implements UserAIConsentService {

    private final UserService userService;
    private final UserRepository userRepository;

    @Override
    public ConfirmAIResponse getConsentStatus() {
        User currentUser = getCurrentUserOrThrow();
        return ConfirmAIResponse.builder()
                .confirmUseAI(currentUser.isConfirmUseAI())
                .build();
    }

    @Override
    public ConfirmAIResponse updateConsentStatus(ConfirmAIRequest request) {
        User currentUser = getCurrentUserOrThrow();

        currentUser.setConfirmUseAI(Boolean.TRUE.equals(request.getConfirmUseAI()));
        currentUser.setUpdatedAt(OffsetDateTime.now());
        User savedUser = userRepository.save(currentUser);

        return ConfirmAIResponse.builder()
                .confirmUseAI(savedUser.isConfirmUseAI())
                .build();
    }

    @Override
    public User assertUserCanUseAI() {
        User currentUser = getCurrentUserOrThrow();
        if (!currentUser.isConfirmUseAI()) {
            throw new AIConsentRequiredException("Bạn cần xác nhận quyền sử dụng AI trước khi dùng tính năng này");
        }
        return currentUser;
    }

    private User getCurrentUserOrThrow() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            throw new ConversationAccessDeniedException("Không thể xác định người dùng hiện tại");
        }
        return currentUser;
    }
}
