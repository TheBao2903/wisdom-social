package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DirectConversationBackfillRunner implements ApplicationRunner {
    private final ConversationRepository conversationRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Conversation> legacyDirectConversations =
                conversationRepository.findLegacyDirectConversationsWithoutDirectKey();

        if (legacyDirectConversations.isEmpty()) {
            return;
        }

        Set<String> processedKeys = new HashSet<>();
        int updated = 0;
        int skipped = 0;

        for (Conversation conversation : legacyDirectConversations) {
            List<Long> memberIds = conversation.getMembers()
                    .stream()
                    .map(member -> member.getUser() == null ? null : member.getUser().getId())
                    .filter(Objects::nonNull)
                    .distinct()
                    .sorted()
                    .toList();

            if (memberIds.size() != 2) {
                skipped++;
                continue;
            }

            String directKey = memberIds.get(0) + ":" + memberIds.get(1);
            if (!processedKeys.add(directKey) || conversationRepository.findByDirectKey(directKey).isPresent()) {
                skipped++;
                continue;
            }

            conversation.setType(ConversationType.DIRECT);
            conversation.setDirectKey(directKey);
            updated++;
        }

        if (updated > 0) {
            conversationRepository.flush();
        }

        log.info("Backfilled direct_key for legacy direct conversations: updated={}, skipped={}", updated, skipped);
    }
}
