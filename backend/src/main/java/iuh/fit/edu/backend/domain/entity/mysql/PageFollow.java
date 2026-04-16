package iuh.fit.edu.backend.domain.entity.mysql;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;

@Entity
@Table(name = "page_follows",
        uniqueConstraints = @UniqueConstraint(columnNames = {"page_id", "user_id"}))
@Data
public class PageFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "page_id", nullable = false)
    private Page page;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private OffsetDateTime followedAt;
}

