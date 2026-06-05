/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.service;/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

import iuh.fit.edu.backend.modules.conversation.dto.response.JoinRequestResponse;
import iuh.fit.edu.backend.modules.conversation.entity.GroupJoinRequest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface GroupJoinRequestService {

    void createRequest(Long conversationId, Long userId, Long inviterId);

    void cancelMyPendingRequest(Long conversationId, Long userId);

    @Transactional
    void processRequest(Long requestId, Long adminId, boolean isApproved);

    List<JoinRequestResponse> getPendingRequests(Long conversationId, Long adminId);

    GroupJoinRequest getRequestById(Long requestId);

    boolean hasPendingRequest(Long id, Long userId);

    void cancelPendingRequestsWhenApprovalDisabled(Long conversationId, Long processorId);
}
