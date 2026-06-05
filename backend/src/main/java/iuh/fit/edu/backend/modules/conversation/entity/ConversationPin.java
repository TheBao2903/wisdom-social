package iuh.fit.edu.backend.modules.conversation.entity;

import java.time.Instant;


import iuh.fit.edu.backend.modules.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

/**
 * @author Nguyen Tan Nghi
 * @version 1.0
 * @created 5/16/2026 2:26 PM
 */
@Entity
@Table(
        name = "conversation_pins",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"user_id", "conversation_ref_id"})
        }
)
@Getter
@Setter
public class ConversationPin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "conversation_ref_id", nullable = false)
    private Long conversationRefId;

    @Column(name = "pinned_at", nullable = false)
    private Instant pinnedAt;

    @PrePersist
    void prePersist() {
        if (pinnedAt == null) {
            pinnedAt = Instant.now();
        }
    }
}
