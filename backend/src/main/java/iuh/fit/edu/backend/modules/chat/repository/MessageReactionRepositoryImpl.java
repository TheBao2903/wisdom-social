package iuh.fit.edu.backend.modules.chat.repository;

import com.mongodb.client.result.UpdateResult;
import iuh.fit.edu.backend.modules.chat.entity.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@RequiredArgsConstructor
public class MessageReactionRepositoryImpl implements MessageReactionRepository {
    private static final int MAX_RETRY = 3;

    private final MongoTemplate mongoTemplate;

    @Override
    public Optional<Message> incrementReactionCounter(String messageId, Long userId, String emoji) {
        for (int attempt = 0; attempt < MAX_RETRY; attempt++) {
            if (incrementExistingUserReaction(messageId, userId, emoji)) {
                return findMessage(messageId);
            }
            if (pushUserToExistingReaction(messageId, userId, emoji)) {
                return findMessage(messageId);
            }
            if (pushNewReaction(messageId, userId, emoji)) {
                return findMessage(messageId);
            }
        }

        return findMessage(messageId);
    }

    private boolean incrementExistingUserReaction(String messageId, Long userId, String emoji) {
        Query query = new Query(
                Criteria.where("id").is(messageId)
                        .and("iconName").elemMatch(
                                Criteria.where("name").is(emoji)
                                        .and("user").elemMatch(Criteria.where("userId").is(userId))
                        )
        );

        Update update = baseUpdate()
                .inc("iconName.$[reaction].user.$[reactor].quantity", 1)
                .filterArray(Criteria.where("reaction.name").is(emoji))
                .filterArray(Criteria.where("reactor.userId").is(userId));

        return wasModified(query, update);
    }

    private boolean pushUserToExistingReaction(String messageId, Long userId, String emoji) {
        Query query = new Query(
                Criteria.where("id").is(messageId)
                        .and("iconName").elemMatch(
                                Criteria.where("name").is(emoji)
                                        .and("user").not().elemMatch(Criteria.where("userId").is(userId))
                        )
        );

        Message.IconUser iconUser = Message.IconUser.builder()
                .userId(userId)
                .quantity(1)
                .build();

        Update update = baseUpdate().push("iconName.$.user", iconUser);
        return wasModified(query, update);
    }

    private boolean pushNewReaction(String messageId, Long userId, String emoji) {
        Query query = new Query(
                new Criteria().andOperator(
                        Criteria.where("id").is(messageId),
                        new Criteria().orOperator(
                                Criteria.where("iconName").exists(false),
                                Criteria.where("iconName").is(null),
                                Criteria.where("iconName").not().elemMatch(Criteria.where("name").is(emoji))
                        )
                )
        );

        Message.IconName iconName = Message.IconName.builder()
                .name(emoji)
                .user(List.of(Message.IconUser.builder()
                        .userId(userId)
                        .quantity(1)
                        .build()))
                .build();

        Update update = baseUpdate().push("iconName", iconName);
        return wasModified(query, update);
    }

    private Update baseUpdate() {
        return new Update().set("modified_at", Instant.now().truncatedTo(ChronoUnit.MILLIS));
    }

    private boolean wasModified(Query query, Update update) {
        UpdateResult result = mongoTemplate.updateFirst(query, update, Message.class);
        return result.getModifiedCount() > 0;
    }

    private Optional<Message> findMessage(String messageId) {
        return Optional.ofNullable(mongoTemplate.findOne(
                Query.query(Criteria.where("id").is(messageId)),
                Message.class
        ));
    }
}
