package iuh.fit.edu.backend.common.service.s3.impl;

import iuh.fit.edu.backend.common.constant.UploadModule;

import iuh.fit.edu.backend.common.dto.response.BulkPresignedRequest;
import iuh.fit.edu.backend.common.dto.response.PresignedUrlResponse;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URL;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class S3ServiceImpl implements S3Service {
    private final S3Presigner s3Presigner;
    private final S3Client s3Client;
    @Value("${aws.s3.bucket-name}")
    private String bucketName;
    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("png","jpg","jpeg","mp4","webm","mov","avi","mkv");


    public S3ServiceImpl( S3Presigner s3Presigner,
                         S3Client s3Client
    ) {
        this.s3Presigner = s3Presigner;
        this.s3Client = s3Client;
    }

    @Override
    public Map<String, String> generateUpdateUploadUrl(String type, String id, String extension) {
        String contentType=getContentType(extension);

        String uuid= UUID.randomUUID().toString();
        String key="images/avatars/" + type + "/" + id + "/" + uuid + "." + extension;

        PutObjectRequest putObjectRequest= PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest putObjectPresignRequest=
                PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(5))
                        .putObjectRequest(putObjectRequest)
                        .build();

        PresignedPutObjectRequest presignedPutObjectRequest=
                s3Presigner.presignPutObject(putObjectPresignRequest);

        Map<String,String> result=new HashMap<>();
        result.put("uploadUrl", presignedPutObjectRequest.url().toString());
        result.put("imageUrl",key);

        return result;
    }

    @Override
    public Map<String, String> generateUploadUrl(String type, String extension) {
        String contentType=getContentType(extension);

        String uuid=UUID.randomUUID().toString();
        String key="images/avatars/" + type + "/" + "temp" + "/" + uuid + "." + extension;

        PutObjectRequest putObjectRequest=PutObjectRequest.builder()
                .key(key)
                .contentType(contentType)
                .bucket(bucketName)
                .build();

        PutObjectPresignRequest putObjectPresignRequest=
                PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(5))
                        .putObjectRequest(putObjectRequest)
                        .build();

        PresignedPutObjectRequest presignedPutObjectRequest=
                s3Presigner.presignPutObject(putObjectPresignRequest);

        Map<String,String> result=new HashMap<>();
        result.put("uploadUrl", presignedPutObjectRequest.url().toString());
        result.put("imageUrl",key);
        result.put("uuid",uuid);
        result.put("extension",extension);

        return result;
    }

    @Override
    public String moveUploadUrl(String type, String id, String url) {

        String uuid = url.substring(0, url.lastIndexOf("."));
        String extension = url.substring(url.lastIndexOf(".") + 1);

        CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                .sourceBucket(bucketName)
                .sourceKey("images/avatars/"+type+"/temp/" + uuid + "."+extension)
                .destinationBucket(bucketName)
                .destinationKey("images/avatars/"+type+"/" + id + "/" + uuid + "."+extension)
                .build();

        s3Client.copyObject(copyRequest);

        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key("images/avatars/"+type+"/temp/" + uuid + "."+extension)
                .build());

        return "images/avatars/"+type+"/" + id + "/" + uuid + "."+extension;
    }

    @Override
    public String getContentType(String extension) {
        if (extension == null) return "application/octet-stream";
        
        switch (extension.toLowerCase()) {
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "gif" : return "image/gif";
            case "mp4":
                return "video/mp4";
            case "webp": return "image/webp";
            case "webm":
                return "video/webm";
            case "mov":
                return "video/quicktime";
            case "avi":
                return "video/x-msvideo";
            case "mkv":
                return "video/x-matroska";
            default:
                return "application/octet-stream";
        }
    }
    
    @Override
    public String resolveMediaType(String extension) {
        if (extension == null) return "FILE";
        String ext = extension.toLowerCase();
        
        if (ext.matches("jpg|jpeg|png|gif|webp")) {
            return "IMAGE";
        } else if (ext.matches("mp4|webm|mov|avi|mkv")) {
            return "VIDEO";
        }
        return "FILE";
    }
    
    /**
     * Determine if extension is video type
     */
    private boolean isVideoExtension(String extension) {
        if (extension == null) return false;
        Set<String> videoExts = Set.of("mp4", "webm", "mov", "avi", "mkv");
        return videoExts.contains(extension.toLowerCase());
    }

    /**
     * Get base path for different content types
     * @param type content type (avatar, posts, cover, story, etc.)
     * @param extension file extension to determine if video or image
     * @return base path in S3
     */
    public String getBasePath(String type, String extension) {
        // Determine media folder based on file type
        String mediaFolder = isVideoExtension(extension) ? "videos" : "images";
        
        if (type != null) {
            switch (type.toLowerCase()) {
                case "avatar":
                case "cover":
                case "profile":
                    return mediaFolder + "/avatars";
                case "posts":
                case "post":
                    return mediaFolder + "/posts";
                case "story":
                case "stories":
                    return mediaFolder + "/stories";
                case "group":
                    return mediaFolder + "/group/posts";
                case "page":
                    return mediaFolder + "/page/posts";
                default:
                    return mediaFolder + "/uploads"; // Default base path
            }
        }
        return mediaFolder + "/uploads";
    }

    /**
     * Hàm sinh URL dùng chung cho TOÀN BỘ DỰ ÁN
     * @param module: CONVERSATION, USER, hoặc POST
     * @param targetId: ID của Conversation, ID của User, hoặc ID của Post
     * @param type: IMAGE, VIDEO, FILE
     */
    @Override
    public PresignedUrlResponse generatePresignedUrl(UploadModule module, String targetId, String type, String originalFilename, String contentType) {

        // Xử lý đuôi file (extension)
        List<String> blockedExtensions = Arrays.asList(".exe", ".sh", ".bat", ".cmd", ".msi", ".js", ".html");
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
            if (blockedExtensions.contains(extension)) {
                throw new IllegalArgumentException("File bạn chọn có định dạng không hợp lệ");
            }
        }
        // Xác định thư mục con (images, videos, files)
        String subFolder = switch (type.toUpperCase()) {
            case "IMAGE" -> "images";
            case "VIDEO" -> "videos";
            case "FILE" -> "files";
            case "AUDIO" -> "audios";
            default -> "others";
        };

        // ĐIỀU HƯỚNG THƯ MỤC GỐC DỰA VÀO MODULE
        String rootFolder = switch (module) {
            case CONVERSATION -> "conversations";
            case USER -> "users";
            case POST -> "posts";
            case STORY -> "stories";
        };
        // TẠO S3 OBJECT KEY
        // Quy hoạch file gọn gàng: {rootFolder}/{targetId}/{subFolder}/{uuid}.ext
        // Ví dụ: users/15/images/abc-xyz.jpg
        // Ví dụ: posts/99/videos/def-123.mp4
        String uuid = UUID.randomUUID().toString();
        String s3ObjectKey = String.format("%s/%s/%s/%s%s", rootFolder, targetId, subFolder, uuid, extension);

        try {
            // ạo PutObjectRequest (Cấu hình file tải lên)
            PutObjectRequest objectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3ObjectKey)
                    .contentType(contentType)
                    .build();

            // Cấp quyền upload trong 15 phút
            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(15)) // URL sống trong 15 phút
                    .putObjectRequest(objectRequest)
                    .build();

            // 6. Sinh Presigned URL
            PresignedPutObjectRequest presignedRequest = s3Presigner.presignPutObject(presignRequest);
            URL presignedUrl = presignedRequest.url();

            return PresignedUrlResponse.builder()
                    .presignedUrl(presignedUrl.toString())
                    .objectKey(s3ObjectKey)
                    .fileName(originalFilename)
                    .build();

        } catch (Exception e) {
            log.error("Lỗi khi tạo Presigned URL bằng SDK v2: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể khởi tạo phiên tải lên");
        }
    }
    @Override
    public List<PresignedUrlResponse> generateMultiplePresignedUrls(BulkPresignedRequest request) {
        return request.getFiles().stream()
                .map(f -> generatePresignedUrl(request.getModule(), request.getTargetId(), f.getType(), f.getFileName(), f.getContentType()))
                .collect(Collectors.toList());
    }

    @Override
    public String copyObject(UploadModule module, String sourceKey, String destinationKey) {
        String normalizedSourceKey = normalizeS3ObjectKey(sourceKey);
        String normalizedDestinationKey = normalizeS3ObjectKey(destinationKey);
        if (normalizedSourceKey == null || normalizedSourceKey.isBlank()) {
            throw new IllegalArgumentException("Source key khong hop le");
        }
        if (normalizedDestinationKey == null || normalizedDestinationKey.isBlank()) {
            throw new IllegalArgumentException("Destination key khong hop le");
        }

        String expectedRootFolder = switch (module) {
            case CONVERSATION -> "conversations";
            case USER -> "users";
            case POST -> "posts";
            case STORY -> "stories";
        };

        if (!normalizedSourceKey.startsWith(expectedRootFolder + "/")
                || !normalizedDestinationKey.startsWith(expectedRootFolder + "/")) {
            throw new IllegalArgumentException("S3 key khong khop voi module " + module);
        }

        CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                .sourceBucket(bucketName)
                .sourceKey(normalizedSourceKey)
                .destinationBucket(bucketName)
                .destinationKey(normalizedDestinationKey)
                .build();

        s3Client.copyObject(copyRequest);
        log.info("Copied S3 object from {} to {}", normalizedSourceKey, normalizedDestinationKey);
        return normalizedDestinationKey;
    }

    @Override
    public void deleteByKey(UploadModule module, String s3ObjectKey) {
        if (s3ObjectKey == null || s3ObjectKey.trim().isEmpty()) return;
        s3ObjectKey = normalizeS3ObjectKey(s3ObjectKey);

        // Xác định thư mục gốc dựa vào module (giống generatePresignedUrl)
        String expectedRootFolder = switch (module) {
            case CONVERSATION -> "conversations";
            case USER -> "users";
            case POST -> "posts";
            case STORY -> "stories";
        };
        // Validate key phải khớp với module được chỉ định
        if (!s3ObjectKey.startsWith(expectedRootFolder + "/")) {
            log.warn("Key {} không khớp với module {}. Mong đợi bắt đầu với {}/",
                     s3ObjectKey, module, expectedRootFolder);
            return;
        }

        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3ObjectKey)
                    .build());
            log.info("Đã xóa file S3: {} từ module {}", s3ObjectKey, module);
        } catch (Exception e) {
            log.error("Lỗi xóa file S3 từ module {}: {}", module, e.getMessage()); // Nuốt lỗi để không block luồng thu hồi
        }
    }

    private String normalizeS3ObjectKey(String keyOrUrl) {
        if (keyOrUrl == null) return null;
        String normalized = keyOrUrl.trim();
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int fragmentIndex = normalized.indexOf('#');
        if (fragmentIndex >= 0) {
            normalized = normalized.substring(0, fragmentIndex);
        }
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }

        for (String root : List.of("conversations/", "users/", "posts/", "stories/")) {
            int rootIndex = normalized.indexOf(root);
            if (rootIndex > 0) {
                return normalized.substring(rootIndex);
            }
        }
        return normalized;
    }

    @Override
    public String relocatePostMediaKey(String sourceKey, String postId, String mediaType) {
        if (sourceKey == null || sourceKey.isBlank() || postId == null || postId.isBlank()) {
            return sourceKey;
        }

        String normalized = sourceKey.trim();
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int fragmentIndex = normalized.indexOf('#');
        if (fragmentIndex >= 0) {
            normalized = normalized.substring(0, fragmentIndex);
        }
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }

        if (!normalized.startsWith("posts/")) {
            return normalized;
        }

        String[] parts = normalized.split("/");
        if (parts.length < 4) {
            return normalized;
        }

        String fileName = parts[parts.length - 1];
        String subFolder = parts[2];
        if (mediaType != null && !mediaType.isBlank()) {
            String t = mediaType.toLowerCase();
            if (t.contains("video")) subFolder = "videos";
            else if (t.contains("file")) subFolder = "files";
            else if (t.contains("audio")) subFolder = "audios";
            else if (t.contains("image")) subFolder = "images";
        }

        String destinationKey = "posts/" + postId + "/" + subFolder + "/" + fileName;
        if (destinationKey.equals(normalized)) {
            return normalized;
        }

        CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                .sourceBucket(bucketName)
                .sourceKey(normalized)
                .destinationBucket(bucketName)
                .destinationKey(destinationKey)
                .build();

        s3Client.copyObject(copyRequest);
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(normalized)
                .build());

        log.info("Relocated media key from {} to {}", normalized, destinationKey);
        return destinationKey;
    }

    @Override
    public String relocateStoryMediaKey(String sourceKey, String storyId, String mediaType) {
        if (sourceKey == null || sourceKey.isBlank() || storyId == null || storyId.isBlank()) {
            return sourceKey;
        }

        String normalized = sourceKey.trim();
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int fragmentIndex = normalized.indexOf('#');
        if (fragmentIndex >= 0) {
            normalized = normalized.substring(0, fragmentIndex);
        }
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }

        if (!normalized.startsWith("stories/")) {
            return normalized;
        }

        String[] parts = normalized.split("/");
        if (parts.length < 4) {
            return normalized;
        }

        String fileName = parts[parts.length - 1];
        String subFolder = parts[2];
        if (mediaType != null && !mediaType.isBlank()) {
            String t = mediaType.toLowerCase();
            if (t.contains("video")) subFolder = "videos";
            else if (t.contains("file")) subFolder = "files";
            else if (t.contains("audio")) subFolder = "audios";
            else if (t.contains("image")) subFolder = "images";
        }

        String destinationKey = "stories/" + storyId + "/" + subFolder + "/" + fileName;
        if (destinationKey.equals(normalized)) {
            return normalized;
        }

        CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                .sourceBucket(bucketName)
                .sourceKey(normalized)
                .destinationBucket(bucketName)
                .destinationKey(destinationKey)
                .build();

        s3Client.copyObject(copyRequest);
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(normalized)
                .build());

        log.info("Relocated story media key from {} to {}", normalized, destinationKey);
        return destinationKey;
    }
}
