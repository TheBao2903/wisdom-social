// Cookie utility functions for managing tokens

/**
 * Set a cookie with the given name, value, and options
 */
export const setCookie = (name: string, value: string, days: number = 7): void => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;

    // Set cookie with SameSite and Secure flags for security
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
};

/**
 * Get a cookie value by name
 */
export const getCookie = (name: string): string | null => {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }
    return null;
};

/**
 * Delete a cookie by name
 */
export const deleteCookie = (name: string): void => {
    // Try multiple ways to ensure cookie is deleted
    document.cookie = `${name}=;max-age=0;path=/`;
    document.cookie = `${name}=;max-age=0;path=/;SameSite=Lax`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
};

/**
 * Clear all authentication-related data from cookies and localStorage
 */
export const clearAuthStorage = (): void => {
    // Explicitly delete known auth cookies
    const cookieNames = [
        'accessToken',
        'refreshToken',
        'refreshTokenQr',
        'idToken',
        'token',
        'authed',
    ];

    cookieNames.forEach(name => {
        deleteCookie(name);
    });

    // Also try to delete all cookies by iterating
    const allCookies = document.cookie.split(';');
    allCookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        if (cookieName) {
            deleteCookie(cookieName);
        }
    });

    // Clear all localStorage data on logout
    localStorage.clear();

    console.log('All auth data cleared');
};

