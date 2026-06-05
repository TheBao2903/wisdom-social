package iuh.fit.edu.backend.modules.chat.controller;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import iuh.fit.edu.backend.modules.chat.dto.request.CallSignalRequest;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class CallSignalingController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/call.signal")
    public void handleSignal(CallSignalRequest signal) {
        if (signal == null || signal.getTargetUserId() == null || signal.getFromUserId() == null) {
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        String outboundEvent = mapOutboundEvent(signal.getEvent());

        payload.put("event", outboundEvent);
        payload.put("conversationId", signal.getConversationId());
        payload.put("callId", signal.getCallId());
        payload.put("callType", signal.getCallType());
        payload.put("fromUserId", signal.getFromUserId());
        payload.put("targetUserId", signal.getTargetUserId());
        payload.put("sdp", signal.getSdp());
        payload.put("candidate", signal.getCandidate());
        payload.put("timestamp", Instant.now().toString());

        String destination = "/topic/user/" + signal.getTargetUserId() + "/calls";
        messagingTemplate.convertAndSend(destination, payload);
    }

    private String mapOutboundEvent(String event) {
        if ("call-user".equals(event)) {
            return "incoming-call";
        }
        return event;
    }
}
