package iuh.fit.edu.backend.common.dto.response;

import iuh.fit.edu.backend.common.constant.UploadModule;
import lombok.Data;

import java.util.List;

@Data
public class BulkPresignedRequest {
    
    // Nơi lưu trữ (VD: CONVERSATION)
    private UploadModule module;
    
    // ID của phòng chat
    private String targetId; 
    
    // Danh sách các file cần xin quyền
    private List<FileInfo> files;

    @Data
    public static class FileInfo {
        private String type;         // "IMAGE", "VIDEO", "FILE"
        private String fileName;     // "anh_bien.jpg"
        private String contentType;  // "image/jpeg", "application/pdf"
    }
}