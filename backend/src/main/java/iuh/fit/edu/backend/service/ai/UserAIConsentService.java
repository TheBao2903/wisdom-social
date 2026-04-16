package iuh.fit.edu.backend.service.ai;

import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.user.ConfirmAIRequest;
import iuh.fit.edu.backend.dto.user.ConfirmAIResponse;

public interface UserAIConsentService {
    ConfirmAIResponse getConsentStatus();

    ConfirmAIResponse updateConsentStatus(ConfirmAIRequest request);

    User assertUserCanUseAI();
}
