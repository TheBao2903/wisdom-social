package iuh.fit.edu.backend.common.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresignedUrlResponse {
    private String presignedUrl; // Link để FE dùng method PUT đẩy file lên
    private String objectKey;    // Link để FE hiển thị ảnh/video sau khi up xong
    private String fileName;     // Tên file đã được hash (UUID)
}