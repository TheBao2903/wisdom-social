package iuh.fit.edu.backend.modules.chat.mapper;

import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import iuh.fit.edu.backend.modules.chat.entity.Poll;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class PollMapper {
    public PollResponse toResponse(Poll poll, Long currentUserId) {
        if (poll == null) {
            return null;
        }

        List<String> currentUserOptionIds = poll.getOptions() == null
                ? Collections.emptyList()
                : poll.getOptions().stream()
                .filter(option -> hasVoted(option, currentUserId))
                .map(Poll.Option::getId)
                .toList();

        List<PollResponse.OptionResponse> options = poll.getOptions() == null
                ? Collections.emptyList()
                : poll.getOptions().stream()
                .map(option -> toOptionResponse(option, poll.isAnonymous(), currentUserId))
                .toList();

        int totalVoteCount = poll.getOptions() == null
                ? 0
                : poll.getOptions().stream()
                .map(Poll.Option::getVoterIds)
                .filter(voterIds -> voterIds != null)
                .mapToInt(Set::size)
                .sum();

        int totalVoterCount = poll.getOptions() == null
                ? 0
                : poll.getOptions().stream()
                .map(Poll.Option::getVoterIds)
                .filter(voterIds -> voterIds != null)
                .collect(LinkedHashSet<Long>::new, Set::addAll, Set::addAll)
                .size();

        return PollResponse.builder()
                .id(poll.getId())
                .messageId(poll.getMessageId())
                .conversationId(poll.getConversationId())
                .creatorId(poll.getCreatorId())
                .title(poll.getTitle())
                .allowMultipleChoices(poll.isAllowMultipleChoices())
                .allowAddOption(poll.isAllowAddOption())
                .anonymous(poll.isAnonymous())
                .closed(poll.isClosed())
                .recalled(poll.isRecalled())
                .expiresAt(poll.getExpiresAt())
                .createdAt(poll.getCreatedAt())
                .updatedAt(poll.getUpdatedAt())
                .totalVoterCount(totalVoterCount)
                .totalVoteCount(totalVoteCount)
                .currentUserOptionIds(currentUserOptionIds)
                .options(options)
                .build();
    }

    private PollResponse.OptionResponse toOptionResponse(Poll.Option option, boolean anonymous, Long currentUserId) {
        Set<Long> voterIds = option.getVoterIds() == null ? Collections.emptySet() : option.getVoterIds();
        return PollResponse.OptionResponse.builder()
                .id(option.getId())
                .text(option.getText())
                .voteCount(voterIds.size())
                .selectedByCurrentUser(currentUserId != null && voterIds.contains(currentUserId))
                .voterIds(anonymous ? null : voterIds)
                .build();
    }

    private boolean hasVoted(Poll.Option option, Long currentUserId) {
        return currentUserId != null
                && option.getVoterIds() != null
                && option.getVoterIds().contains(currentUserId);
    }
}
