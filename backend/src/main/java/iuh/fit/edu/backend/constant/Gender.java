/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.constant;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
public enum Gender {
    MALE("Nam"),
    FEMALE("Nữ"),
    OTHER("Other");

    private final String displayName;

    Gender(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String toString() {
        return displayName;
    }

    @JsonValue
    public String getValue() {
        return this.name();
    }

    @JsonCreator
    public static Gender fromValue(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Gender.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            // Try lowercase
            for (Gender gender : Gender.values()) {
                if (gender.name().equalsIgnoreCase(value)) {
                    return gender;
                }
            }
            return null;
        }
    }

}
