package iuh.fit.edu.backend.service.music;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;

/*
 * @description: Cloudflare R2 service for handling music and media storage
 * @author: The Bao
 * @date: 2026-03-23
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CloudflareR2Service {

    @Value("${R2_ENDPOINT_URL}")
    private String r2EndpointUrl;

    @Value("${R2_PUBLIC_URL}")
    private String r2PublicUrl;

    @Value("${R2_ACCESS_KEY_ID}")
    private String r2AccessKeyId;

    @Value("${R2_SECRET_ACCESS_KEY}")
    private String r2SecretAccessKey;

    @Value("${R2_BUCKET_NAME}")
    private String r2BucketName;

    /**
     * Get S3Client configured for Cloudflare R2
     */
    private S3Client getR2Client() {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
                r2AccessKeyId,
                r2SecretAccessKey
        );

        return S3Client.builder()
                .region(Region.US_EAST_1)
                .endpointOverride(URI.create(r2EndpointUrl))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .build();
    }

    /**
     * List all objects in a prefix (e.g., 'music/audio', 'music/images')
     */
    public List<String> listMusicFiles(String prefix) {
        try (S3Client s3Client = getR2Client()) {
            ListObjectsV2Request request = ListObjectsV2Request.builder()
                    .bucket(r2BucketName)
                    .prefix(prefix)
                    .build();

            ListObjectsV2Response response = s3Client.listObjectsV2(request);

            List<String> files = response.contents().stream()
                    .map(S3Object::key)
                    .collect(Collectors.toList());

            log.info("Listed {} files from R2 prefix '{}'", files.size(), prefix);
            return files;
        } catch (Exception e) {
            log.error("Failed to list R2 files for prefix: {}", prefix, e);
            return List.of();
        }
    }

    /**
     * Get public URL for a file in R2
     */
    public String getPublicUrl(String fileKey) {
        return r2PublicUrl + "/" + fileKey;
    }

    /**
     * Verify file exists in R2
     */
    public boolean fileExists(String fileKey) {
        try (S3Client s3Client = getR2Client()) {
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(r2BucketName)
                    .key(fileKey)
                    .build();

            s3Client.getObject(request);
            return true;
        } catch (Exception e) {
            log.debug("File not found in R2: {}", fileKey);
            return false;
        }
    }
}
