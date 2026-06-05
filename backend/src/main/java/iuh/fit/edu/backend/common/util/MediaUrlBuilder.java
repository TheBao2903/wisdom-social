package iuh.fit.edu.backend.common.util;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
@Component
public class MediaUrlBuilder {

    @Value("${app.cdn-domain}")
    private String cdnDomain;

    public String build(String url, MessageType type) {
        if (url == null || url.isEmpty()) return url;

        if (isMedia(type)) {
            return buildCdnUrl(url);
        }
        return url;
    }

    public String buildAttachment(String url) {
        if (url == null || url.isEmpty()) return url;
        return buildCdnUrl(url);
    }

    private String buildCdnUrl(String url) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
        }

        String base = cdnDomain == null ? "" : cdnDomain.trim();
        if (base.isEmpty()) {
            return url;
        }

        String normalizedBase = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        String normalizedPath = url.startsWith("/") ? url.substring(1) : url;
        return normalizedBase + "/" + normalizedPath;
    }

    private boolean isMedia(MessageType type) {
        return type == MessageType.IMAGE
                || type == MessageType.VIDEO
                || type == MessageType.FILE
                || type == MessageType.AUDIO;
    }
}
