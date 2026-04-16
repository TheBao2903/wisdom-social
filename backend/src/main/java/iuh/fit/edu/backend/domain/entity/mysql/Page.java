package iuh.fit.edu.backend.domain.entity.mysql;

import com.fasterxml.jackson.annotation.JsonIgnore;
import iuh.fit.edu.backend.constant.PageStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

@Entity
@Data
@Table(name = "pages")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Page {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column
    private String username;

    private String category;

    @Column(length = 500)
    private String description;

    private String avatarUrl;
    private String coverUrl;

    private String phone;
    private String email;
    private String website;
    private String address;

    private Boolean isVerified = false;

    private PageStatus status;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @JsonIgnore
    @OneToMany(mappedBy = "page", cascade = CascadeType.ALL)
    private List<PageMember> pageMembers;

    @JsonIgnore
    @OneToMany(mappedBy = "page", cascade = CascadeType.ALL)
    private List<PageFollow> pageFollows;

    @JsonIgnore
    @OneToMany(mappedBy = "page", cascade = CascadeType.ALL)
    private List<PageLike> pageLikes;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
