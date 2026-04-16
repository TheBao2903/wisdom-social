/*
 * @ (#) ContactInfo.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql.embeddable;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * @description: Contact information embeddable class (shared by Page)
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactInfo {
    private String email;
    private String phone;
    private String website;
    private String address;
}
