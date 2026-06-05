/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.media.controller;

import iuh.fit.edu.backend.common.dto.response.BulkPresignedRequest;
import iuh.fit.edu.backend.common.dto.response.PresignedUrlResponse;

import iuh.fit.edu.backend.common.service.s3.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final S3Service s3Service;
    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${app.cdn-domain}")
    private String cdnDomain;

    @PostMapping("/presigned-url")
    public ResponseEntity<List<PresignedUrlResponse>> getBulkPresignedUrls(
            @RequestBody BulkPresignedRequest request) {
        return ResponseEntity.ok(s3Service.generateMultiplePresignedUrls(request));
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadFile(@RequestParam String url) {
        String objectKey = normalizeS3ObjectKey(url);
        if (objectKey == null || objectKey.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        ResponseBytes<GetObjectResponse> responseBytes = s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .build()
        );
        GetObjectResponse objectResponse = responseBytes.response();
        String contentType = objectResponse.contentType() == null || objectResponse.contentType().isBlank()
                ? resolveContentType(objectKey)
                : objectResponse.contentType();
        String fileName = objectKey.substring(objectKey.lastIndexOf('/') + 1);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(responseBytes.asByteArray().length)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(fileName, StandardCharsets.UTF_8)
                                .build()
                                .toString()
                )
                .body(responseBytes.asByteArray());
    }

    private String normalizeS3ObjectKey(String keyOrUrl) {
        if (keyOrUrl == null) return null;
        String normalized = URLDecoder.decode(keyOrUrl.trim(), StandardCharsets.UTF_8);
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int fragmentIndex = normalized.indexOf('#');
        if (fragmentIndex >= 0) {
            normalized = normalized.substring(0, fragmentIndex);
        }
        if (cdnDomain != null && !cdnDomain.isBlank() && normalized.startsWith(cdnDomain)) {
            normalized = normalized.substring(cdnDomain.length());
        }
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        for (String root : List.of("conversations/", "users/", "posts/", "stories/")) {
            int rootIndex = normalized.indexOf(root);
            if (rootIndex >= 0) {
                return normalized.substring(rootIndex);
            }
        }
        return null;
    }

    private String resolveContentType(String objectKey) {
        String lower = objectKey.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".avif")) return "image/avif";
        return "application/octet-stream";
    }
}
