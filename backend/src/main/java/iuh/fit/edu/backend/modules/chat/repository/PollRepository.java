package iuh.fit.edu.backend.modules.chat.repository;

import iuh.fit.edu.backend.modules.chat.entity.Poll;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PollRepository extends MongoRepository<Poll, String> {
    Optional<Poll> findByMessageId(String messageId);
}
