package iuh.fit.edu.backend.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CallSignalRequest {
    private String event; // call-user | answer-call | ice-candidate | reject-call | end-call
    private Long conversationId;
    private String callId;
    private String callType; // video | audio
    private Long fromUserId;
    private Long targetUserId;
    private Object sdp;
    private Object candidate;
}
