package iuh.fit.edu.backend.modules.chat.service;

import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;

public interface PollCacheService {
    PollResponse getPoll(String pollId);

    void cachePoll(PollResponse pollResponse);

    void evictPoll(String pollId);
}
