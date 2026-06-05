package iuh.fit.edu.backend.modules.chat.service;

import iuh.fit.edu.backend.modules.chat.dto.request.poll.AddPollOptionRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.VotePollRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;

public interface PollService {
    PollResponse getPoll(String pollId, Long userId);

    PollResponse vote(String pollId, VotePollRequest request, Long userId);

    PollResponse removeVote(String pollId, Long userId);

    PollResponse addOption(String pollId, AddPollOptionRequest request, Long userId);

    PollResponse closePoll(String pollId, Long userId);
}
