package iuh.fit.edu.backend.domain.entity.mysql;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PinnedMessageDetail {
    private String messageId; // ID của tin nhắn gốc trong MongoDB
    private Long pinnerId;    // ID của người thực hiện thao tác ghim
    private Instant pinnedAt; // Thời gian ghim để sắp xếp
}