package iuh.fit.edu.backend.modules.ai.service;

import iuh.fit.edu.backend.modules.ai.dto.request.ConfirmAIRequest;
import iuh.fit.edu.backend.modules.ai.dto.response.ConfirmAIResponse;
import iuh.fit.edu.backend.modules.user.entity.User;

public interface UserAIConsentService {
    ConfirmAIResponse getConsentStatus();

    ConfirmAIResponse updateConsentStatus(ConfirmAIRequest request);

    User assertUserCanUseAI();
}
