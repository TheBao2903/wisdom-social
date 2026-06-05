export const setCookie = (name: string, value: string, days = 7): void => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
};

export const getCookie = (name: string): string | null => {
  const target = `${name}=`;
  const cookies = document.cookie.split(';');
  for (const raw of cookies) {
    const cookie = raw.trim();
    if (cookie.indexOf(target) === 0) {
      return cookie.substring(target.length);
    }
  }
  return null;
};

export const deleteCookie = (name: string): void => {
  document.cookie = `${name}=;max-age=0;path=/`;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
};

export const clearAuthStorage = (): void => {
  ['accessToken', 'refreshToken', 'tokenExpiresAt'].forEach(deleteCookie);
  localStorage.clear();
};
