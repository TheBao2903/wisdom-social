/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.ReactionType;
import iuh.fit.edu.backend.constant.TargetType;
import jakarta.persistence.Id;
import lombok.Data;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/*
 * @description: Reaction entity for all content types
 * Tối ưu: Unique compound index tránh duplicate reactions
 * Index cho query reactions theo target và type
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "reactions")
@Data
@CompoundIndexes({
        @CompoundIndex(
                name = "unique_reaction",
                def = "{'userId': 1, 'targetType': 1, 'targetId': 1}",
                unique = true
        ),
        @CompoundIndex(
                name = "target_type_idx",
                def = "{'targetType': 1, 'targetId': 1, 'type': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "user_created_idx",
                def = "{'userId': 1, 'createdAt': -1}"
        )
})
public class Reaction {

    @Id
    private String id;

    private String userId;

    private TargetType targetType;
    private String targetId;

    private ReactionType type;

    private Instant createdAt;
    private Instant updatedAt;
}