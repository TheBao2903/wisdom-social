import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const ID_TOKEN_KEY = "idToken";
const USER_KEY = "user";
const SETTINGS_KEY = "appSettings";

const memoryStorage: Record<string, string> = {};

const storage = {
    async setItem(key: string, value: string): Promise<void> {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes("Native module is null")) {
                memoryStorage[key] = value;
                return;
            }
            throw error;
        }
    },

    async getItem(key: string): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(key);
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes("Native module is null")) {
                return memoryStorage[key] ?? null;
            }
            throw error;
        }
    },

    async removeItem(key: string): Promise<void> {
        try {
            await AsyncStorage.removeItem(key);
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes("Native module is null")) {
                delete memoryStorage[key];
                return;
            }
            throw error;
        }
    },
};

export const saveToken = async (token: string): Promise<void> => {
    await storage.setItem(TOKEN_KEY, token);
};

export const getToken = async (): Promise<string | null> => {
    try {
        return await storage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};

export const saveRefreshToken = async (token: string): Promise<void> => {
    await storage.setItem(REFRESH_TOKEN_KEY, token);
};

export const getRefreshToken = async (): Promise<string | null> => {
    try {
        return await storage.getItem(REFRESH_TOKEN_KEY);
    } catch {
        return null;
    }
};

export const saveIdToken = async (token: string): Promise<void> => {
    await storage.setItem(ID_TOKEN_KEY, token);
};

export const getIdToken = async (): Promise<string | null> => {
    try {
        return await storage.getItem(ID_TOKEN_KEY);
    } catch {
        return null;
    }
};

export const saveUser = async (user: unknown): Promise<void> => {
    await storage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = async <T = unknown>(): Promise<T | null> => {
    try {
        const userJson = await storage.getItem(USER_KEY);
        return userJson ? (JSON.parse(userJson) as T) : null;
    } catch {
        return null;
    }
};

export const clearStorage = async (): Promise<void> => {
    await Promise.all([
        storage.removeItem(TOKEN_KEY),
        storage.removeItem(REFRESH_TOKEN_KEY),
        storage.removeItem(ID_TOKEN_KEY),
        storage.removeItem(USER_KEY),
    ]);
};

export const saveSettings = async (settings: unknown): Promise<void> => {
    await storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getSettings = async <T = unknown>(): Promise<T | null> => {
    try {
        const settingsJson = await storage.getItem(SETTINGS_KEY);
        return settingsJson ? (JSON.parse(settingsJson) as T) : null;
    } catch {
        return null;
    }
};
