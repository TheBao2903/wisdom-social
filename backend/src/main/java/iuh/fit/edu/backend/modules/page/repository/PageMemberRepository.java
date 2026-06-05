package iuh.fit.edu.backend.modules.page.repository;

import iuh.fit.edu.backend.modules.page.constant.MemberStatus;
import iuh.fit.edu.backend.modules.page.constant.PageRole;
import iuh.fit.edu.backend.modules.page.entity.PageMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PageMemberRepository extends JpaRepository<PageMember,Long> {
    PageMember findPageMemberByPage_IdAndUser_Id(Long pageId, Long userId);
    Optional<PageMember> findByPage_IdAndUser_Id(Long pageId, Long userId);
    Optional<PageMember> findByPage_IdAndUser_IdAndStatus(Long pageId, Long userId, MemberStatus status);
    List<PageMember> findByPage_Id(Long pageId);
    List<PageMember> findByPage_IdAndStatus(Long pageId, MemberStatus status);

    void deletePageMemberById(Long id);

    boolean existsByUserIdAndPageIdAndRoleIn(Long userId, Long pageId, Collection<PageRole> roles);

    List<PageMember> findByPage_IdAndStatusAndRoleIn(Long pageId, MemberStatus status, Collection<PageRole> roles);

    long countByPage_IdAndStatus(Long pageId, MemberStatus status);
}
