package iuh.fit.edu.backend.modules.note.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NoteMusic {
    private String trackId;
    private String title;
    private String artist;
    private String coverUrl;
    private String previewUrl;
}
