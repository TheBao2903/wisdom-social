/*
 * @ (#) WebSocketAuthInterceptor.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;

import java.security.Principal;

/*
 * @author: Ngoc Hai
 * @date: 2026-02-28
 * @version: 1.0
 */
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Get phone from STOMP CONNECT headers
            String phone = accessor.getFirstNativeHeader("login");
            
            if (phone != null && !phone.isEmpty()) {
                accessor.setUser(new UserPrincipal(phone));
            }
        }
        
        return message;
    }
    
    // Simple Principal implementation
    private static class UserPrincipal implements Principal {
        private final String name;
        
        public UserPrincipal(String name) {
            this.name = name;
        }
        
        @Override
        public String getName() {
            return name;
        }
    }
}
