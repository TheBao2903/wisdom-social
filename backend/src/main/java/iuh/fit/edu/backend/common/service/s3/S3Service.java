package iuh.fit.edu.backend.common.service.s3;

import iuh.fit.edu.backend.common.constant.UploadModule;

import iuh.fit.edu.backend.common.dto.response.BulkPresignedRequest;
import iuh.fit.edu.backend.common.dto.response.PresignedUrlResponse;

import java.util.List;
import java.util.Map;

public interface S3Service {
    Map<String, String> generateUpdateUploadUrl(String type, String id, String extension);
    Map<String, String> generateUploadUrl(String type, String extension);
    String moveUploadUrl(String type, String id, String url);
    String getContentType(String extension);
    String resolveMediaType(String extension);
    String relocatePostMediaKey(String sourceKey, String postId, String mediaType);
    String relocateStoryMediaKey(String sourceKey, String storyId, String mediaType);

    List<PresignedUrlResponse> generateMultiplePresignedUrls(BulkPresignedRequest request);

    PresignedUrlResponse generatePresignedUrl(UploadModule module, String targetId, String type, String originalFilename, String contentType);

    String copyObject(UploadModule module, String sourceKey, String destinationKey);

    void deleteByKey(UploadModule module, String s3ObjectKey);
}
