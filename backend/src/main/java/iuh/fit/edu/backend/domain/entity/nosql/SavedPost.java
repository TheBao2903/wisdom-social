/*
 * @ (#) SavedPost.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.TargetType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/*
 * @description: Saved/Bookmarked posts feature (giống Instagram saved collection)
 * Tối ưu: Compound index cho query saved posts của user
 * Hỗ trợ collection/folder để organize saved posts
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "saved_posts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "unique_user_target",
                def = "{'userId': 1, 'targetType': 1, 'targetId': 1}",
                unique = true
        ),
        @CompoundIndex(
                name = "user_collection_idx",
                def = "{'userId': 1, 'collectionName': 1, 'savedAt': -1}"
        )
})
public class SavedPost {

    @Id
    private String id;

    private String userId;

    // Target có thể là POST, POST_SHARE, STORY, NOTE
    private TargetType targetType;
    private String targetId;

    // Collection/Folder name (VD: "Công thức nấu ăn", "Tài liệu học tập")
    private String collectionName;

    // Tags để filter
    private List<String> tags;

    // Note riêng của user
    private String privateNote;

    private Instant savedAt;
}
