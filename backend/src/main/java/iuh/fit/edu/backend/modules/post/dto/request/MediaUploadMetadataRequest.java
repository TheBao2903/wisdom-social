package iuh.fit.edu.backend.modules.post.dto.request;

import lombok.Data;

@Data
public class MediaUploadMetadataRequest {
    private Long duration;
    private Integer width;
    private Integer height;
    private Long fileSize;
    private String mimeType;
    private String originalFileName;
}
