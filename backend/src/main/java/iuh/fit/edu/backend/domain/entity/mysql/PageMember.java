package iuh.fit.edu.backend.domain.entity.mysql;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import iuh.fit.edu.backend.constant.MemberStatus;
import iuh.fit.edu.backend.constant.PageRole;
import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;

@Entity
@Table(name = "page_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"page_id", "user_id"}))
@Data
public class PageMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "page_id", nullable = false)
    @JsonIgnoreProperties({"pageMembers", "createdBy"})
    private Page page;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({"password", "roles", "authorities"})
    private User user;

    private PageRole role;

    private MemberStatus status;

    private OffsetDateTime joinedAt;
}
