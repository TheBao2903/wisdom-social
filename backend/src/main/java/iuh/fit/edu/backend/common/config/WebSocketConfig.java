/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.socket.config.annotation.*;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor webSocketAuthInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // SockJS endpoint for web browsers
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
        
        // Raw WebSocket endpoint for React Native
        registry.addEndpoint("/ws-native")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Đăng ký interceptor có sẵn để gắn Principal cho STOMP session.
        // Giữ nguyên quy ước hiện tại: principal.getName() là phone từ header "login".
        registration.interceptors(webSocketAuthInterceptor);
    }
    
//    @Override
//    public void configureClientInboundChannel(ChannelRegistration registration) {
//        registration.interceptors(new WebSocketAuthInterceptor());
//    }
//    private final JwtTokenProvider jwtTokenProvider; // Class giải mã JWT của bạn
//
//    // ... Các cấu hình endpoint và broker của bạn giữ nguyên ...
//
//    /**
//     * TRẠM GÁC SOÁT VÉ WEBSOCKET
//     */
//    @Override
//    public void configureClientInboundChannel(ChannelRegistration registration) {
//        registration.interceptors(new ChannelInterceptor() {
//            @Override
//            public Message<?> preSend(Message<?> message, MessageChannel channel) {
//                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
//
//                // Chỉ soát vé khi Frontend gửi lệnh CONNECT đầu tiên
//                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
//
//                    // 1. Lấy token từ Header mà FE gửi lên
//                    String authHeader = accessor.getFirstNativeHeader("Authorization");
//
//                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
//                        String token = authHeader.substring(7);
//
//                        // 2. Giải mã Token y hệt như cách bạn làm bên REST API
//                        if (jwtTokenProvider.validateToken(token)) {
//                            // Hàm này tùy thuộc vào logic của bạn, mục đích là lấy ra userId (String)
//                            String userId = jwtTokenProvider.getUserIdFromToken(token);
//
//                            // 3. TẠO RA CÁI "THẺ TÊN" (PRINCIPAL) TẠI ĐÂY!
//                            // Tham số đầu tiên (userId) chính là cái sẽ được trả về khi gọi principal.getName()
//                            UsernamePasswordAuthenticationToken authentication =
//                                    new UsernamePasswordAuthenticationToken(userId, null, null);
//
//                            // 4. Gắn thẻ tên vào SecurityContext và quan trọng nhất là gắn vào Accessor của WebSocket
//                            SecurityContextHolder.getContext().setAuthentication(authentication);
//                            accessor.setUser(authentication);
//
//                            log.info("Xác thực WebSocket thành công cho User ID: {}", userId);
//                        }
//                    } else {
//                        log.warn("Lỗi xác thực WebSocket: Không tìm thấy Token hợp lệ");
//                        // Tùy chọn: Bạn có thể throw Exception ở đây để đá FE văng ra nếu không có token
//                    }
//                }
//                return message; // Cho phép gói tin đi tiếp vào hệ thống
//            }
//        });
//    }
}
