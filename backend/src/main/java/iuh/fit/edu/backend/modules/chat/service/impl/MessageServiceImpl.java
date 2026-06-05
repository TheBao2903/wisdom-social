/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service.impl;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;

import iuh.fit.edu.backend.common.dto.response.CursorResponse;
import iuh.fit.edu.backend.modules.chat.dto.request.ForwardMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.SendCallMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.SendMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.CreatePollRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageRecalledResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageSearchResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.ConversationMediaResponse;
import iuh.fit.edu.backend.modules.chat.service.MessageService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Service
@AllArgsConstructor
public class MessageServiceImpl implements MessageService{
    private final MessageCommandService commandService;
    private final MessageQueryService queryService;


    @Override
    public MessageResponse sendMessage(SendMessageRequest sendMessageRequest, Long userId) {
        return commandService.sendMessage(sendMessageRequest, userId);
    }

    @Override
    public MessageResponse createPoll(CreatePollRequest createPollRequest, Long userId) {
        return commandService.createPoll(createPollRequest, userId);
    }

    @Override
    public List<MessageResponse> forwardMessage(ForwardMessageRequest forwardMessageRequest, Long userId) {
        return commandService.forwardMessage(forwardMessageRequest, userId);
    }

    @Override
    public void pinMessage(String messageId, Long userId) {
        commandService.pinMessage(messageId, userId);
    }

    @Override
    public void unpinMessage(String messageId, Long userId) {
        commandService.unpinMessage(messageId, userId);
    }

    @Override
    public MessageResponse addReaction(String messageId, Long userId, String emoji) {
        return commandService.addReaction(messageId, userId, emoji);
    }

    @Override
    public MessageResponse getMessageById(String messageId, Long userId) {
        return queryService.getMessageById(messageId, userId);
    }

    @Override
    public MessageResponse sendCallMessage(SendCallMessageRequest sendCallMessageRequest, Long userId) {
        return commandService.sendCallMessage(sendCallMessageRequest, userId);
    }

    @Override
    public MessageRecalledResponse recallMessage(String messageId, Long userId) {
        return commandService.recallMessage(messageId, userId);
    }

    @Override
    public void deleteMessageForMe(String messageId, Long userId) {
        commandService.deleteMessageForMe(messageId, userId);
    }

    @Override
    public CursorResponse<List<MessageResponse>> getMessagesByConversation(Long conversationId, Long userId, Instant before, int limit) {
        return queryService.getMessagesByConversation(conversationId, userId, before, limit);
    }

    @Override
    public CursorResponse<List<MessageResponse>> getNewerMessages(Long conversationId, Long userId, Instant after, int limit) {
        return queryService.getNewerMessages(conversationId, userId, after, limit);
    }

    @Override
    public CursorResponse<List<MessageResponse>> jumpToMessage(Long conversationId, String targetMessageId, Long userId) {
        return queryService.jumpToMessage(conversationId, targetMessageId, userId);
    }

    @Override
    public MessageSearchResponse searchMessages(
            Long conversationId,
            Long userId,
            String keyword,
            Long senderId,
            Instant fromDate,
            Instant toDate,
            Instant cursor,
            int limit) {
        return queryService.searchMessages(conversationId, userId, keyword, senderId, fromDate, toDate, cursor, limit);
    }

    @Override
    public ConversationMediaResponse getConversationMedia(
            Long conversationId,
            Long userId,
            String type,
            Instant cursor,
            int limit) {
        return queryService.getConversationMedia(conversationId, userId, type, cursor, limit);
    }
}
