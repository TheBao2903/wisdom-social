import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useReducer,
} from "react";
import type { ReactNode } from "react";

type ThemeMode = "light" | "dark";

interface ThemeState {
    mode: ThemeMode;
}

type ThemeAction =
    | { type: "TOGGLE_THEME" }
    | { type: "SET_THEME"; payload: ThemeMode };

interface ThemeContextType {
    mode: ThemeMode;
    isDark: boolean;
    dispatch: React.Dispatch<ThemeAction>;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "theme";

function getInitialThemeState(): ThemeState {
    const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedMode === "dark" || savedMode === "light") {
        return { mode: savedMode };
    }
    return { mode: "light" };
}

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
    switch (action.type) {
        case "TOGGLE_THEME":
            return { mode: state.mode === "light" ? "dark" : "light" };
        case "SET_THEME":
            return { mode: action.payload };
        default:
            return state;
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(
        themeReducer,
        undefined,
        getInitialThemeState,
    );
    const isDark = state.mode === "dark";

    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, state.mode);
        if (isDark) {
            document.documentElement.classList.add("dark");
            document.body.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
            document.body.classList.remove("dark");
        }

        document.documentElement.setAttribute("data-theme", state.mode);
        document.body.setAttribute("data-theme", state.mode);
    }, [isDark, state.mode]);

    const value = useMemo(
        () => ({
            mode: state.mode,
            isDark,
            dispatch,
            toggleTheme: () => dispatch({ type: "TOGGLE_THEME" }),
        }),
        [isDark, state.mode],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}
