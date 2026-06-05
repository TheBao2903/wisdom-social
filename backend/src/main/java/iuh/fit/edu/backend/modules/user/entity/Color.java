/*
 * @ (#) Color.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.user.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/*
 * @description: Color entity for conversation themes
 * @author: Huu Thai
 * @date: 17/01/2026
 * @version: 1.0
 */
@Entity
@Table(name = "colors")
@Getter
@Setter
public class Color {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String background;
    private String font;
    private String admin;
}
