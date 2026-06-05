package iuh.fit.edu.backend.modules.page.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import iuh.fit.edu.backend.modules.post.constant.PostStatus;
import iuh.fit.edu.backend.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Entity
@Table(name = "page_posts")
@Data
public class PagePost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String postId;

    @ManyToOne
    @JoinColumn(name = "page_id", nullable = false)
    @JsonIgnore
    private Page page;

    private PostStatus status;


    @ManyToOne
    @JoinColumn(name = "approved_by")
    @JsonIgnore
    private User approvedBy;
    private OffsetDateTime approvedAt;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}