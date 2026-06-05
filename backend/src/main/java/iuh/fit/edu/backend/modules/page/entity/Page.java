package iuh.fit.edu.backend.modules.page.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import iuh.fit.edu.backend.modules.page.constant.PageStatus;
import iuh.fit.edu.backend.modules.user.entity.User;
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

    @JsonIgnore
    @OneToMany(mappedBy = "page", cascade = CascadeType.ALL)
    private List<PagePost> pagePosts;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    // ─── Transient interaction fields (per current user, not persisted) ───────
    // Populated on read endpoints so the discover list can render like/follow
    // state in a single request instead of an N+1 of interaction-status calls.
    @Transient
    private Boolean isLiked;
    @Transient
    private Boolean isFollowing;
    @Transient
    private Long likeCount;
    @Transient
    private Long followCount;
}
