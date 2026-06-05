package iuh.fit.edu.backend.modules.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Document(collection = "polls")
@CompoundIndex(name = "poll_conversation_createdAt_idx", def = "{ 'conversation_id': 1, 'created_at': -1 }")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Poll {
    @Id
    private String id;

    @Field(name = "message_id")
    private String messageId;

    @Field(name = "conversation_id")
    private Long conversationId;

    @Field(name = "creator_id")
    private Long creatorId;

    private String title;

    @Field(name = "allow_multiple_choices")
    private boolean allowMultipleChoices;

    @Field(name = "allow_add_option")
    private boolean allowAddOption;

    private boolean anonymous;

    private boolean closed;
    private boolean recalled;

    @Field(name = "expires_at")
    private Instant expiresAt;

    @Field(name = "created_at")
    private Instant createdAt;

    @Field(name = "updated_at")
    private Instant updatedAt;

    @Builder.Default
    private List<Option> options = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Option {
        private String id;
        private String text;

        @Builder.Default
        private Set<Long> voterIds = new LinkedHashSet<>();
    }
}
