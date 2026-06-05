package iuh.fit.edu.backend.common.util.heplper;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ChatSnapshotHelper {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    /**
     * Tìm tên hiển thị của người tương tác (Ưu tiên Biệt danh -> Tên thật -> Username)
     */
    public String resolveActorDisplayName(Conversation conv, Long userId) {
        if (conv.getMembers() != null) {
            for (ConversationMember member : conv.getMembers()) {
                if (member.getUser() != null && Objects.equals(member.getUser().getId(), userId)) {
                    if (member.getNickname() != null && !member.getNickname().trim().isEmpty()) {
                        return member.getNickname().trim();
                    }
                    return getFallbackName(member.getUser().getName(), member.getUser().getUsername());
                }
            }
        }
        return resolveUserDisplayName(userId);
    }

    /**
     * Tìm tên hiển thị trực tiếp từ UserRepository
     */
    public String resolveUserDisplayName(Long userId) {
        return userRepository.findById(userId)
                .map(user -> getFallbackName(user.getName(), user.getUsername()))
                .orElse("Người dùng");
    }

    private String getFallbackName(String name, String username) {
        if (name != null && !name.trim().isEmpty()) return name.trim();
        if (username != null && !username.trim().isEmpty()) return username.trim();
        return "Người dùng";
    }

    /**
     * Build chuỗi JSON danh sách ID và Tên (Dùng cho Add/Kick Member, Create Group)
     */
    public String buildMemberSnapshotContent(Collection<Long> memberIds) {
        List<Map<String, Object>> snapshot = memberIds.stream()
                .map(memberId -> {
                    Map<String, Object> member = new HashMap<>();
                    member.put("id", memberId);
                    member.put("name", resolveUserDisplayName(memberId));
                    return member;
                })
                .collect(Collectors.toList());
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (Exception ex) {
            return "[]";
        }
    }

    public String buildRoleSnapshotContent(Long targetId, String newRole) {
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("targetId", targetId);
        snapshot.put("targetName", resolveUserDisplayName(targetId));
        snapshot.put("newRole", newRole);
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (Exception ex) {
            return "{}";
        }
    }

    public String buildKickSnapshotContent(Long targetId) {
        return buildMemberSnapshotContent(Collections.singleton(targetId));
    }
}