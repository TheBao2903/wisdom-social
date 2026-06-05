package iuh.fit.edu.backend.modules.chat.controller;

import iuh.fit.edu.backend.modules.chat.dto.request.poll.AddPollOptionRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.VotePollRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import iuh.fit.edu.backend.modules.chat.service.PollService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/polls")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class PollController {
    private final PollService pollService;
    private final UserService userService;

    @GetMapping("/{pollId}")
    public ResponseEntity<PollResponse> getPoll(@PathVariable String pollId) {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(pollService.getPoll(pollId, userId));
    }

    @PostMapping("/{pollId}/vote")
    public ResponseEntity<PollResponse> vote(
            @PathVariable String pollId,
            @Valid @RequestBody VotePollRequest request) {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(pollService.vote(pollId, request, userId));
    }

    @DeleteMapping("/{pollId}/vote")
    public ResponseEntity<PollResponse> removeVote(@PathVariable String pollId) {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(pollService.removeVote(pollId, userId));
    }

    @PostMapping("/{pollId}/options")
    public ResponseEntity<PollResponse> addOption(
            @PathVariable String pollId,
            @Valid @RequestBody AddPollOptionRequest request) {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(pollService.addOption(pollId, request, userId));
    }

    @PatchMapping("/{pollId}/close")
    public ResponseEntity<PollResponse> closePoll(@PathVariable String pollId) {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(pollService.closePoll(pollId, userId));
    }
}
