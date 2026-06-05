package iuh.fit.edu.backend.modules.user.dto.response;

import iuh.fit.edu.backend.modules.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaginatedUserResponse {
    private List<User> data;
    private int page;
    private boolean hasMore;
}
