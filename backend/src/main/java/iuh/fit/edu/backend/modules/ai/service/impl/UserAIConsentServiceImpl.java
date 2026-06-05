package iuh.fit.edu.backend.modules.ai.service.impl;

import java.time.OffsetDateTime;

import org.springframework.stereotype.Service;

import iuh.fit.edu.backend.common.exception.AIConsentRequiredException;
import iuh.fit.edu.backend.common.exception.ConversationAccessDeniedException;
import iuh.fit.edu.backend.modules.ai.dto.request.ConfirmAIRequest;
import iuh.fit.edu.backend.modules.ai.dto.response.ConfirmAIResponse;
import iuh.fit.edu.backend.modules.ai.service.UserAIConsentService;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;

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
