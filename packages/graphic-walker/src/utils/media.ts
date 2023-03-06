import { useEffect, useState } from "react";
import { IDarkMode } from "../interfaces";

export function currentMediaTheme(): "dark" | "light" {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
    } else {
        return "light";
    }
}

export function useCurrentMediaTheme(mode: IDarkMode | undefined = 'media'): "dark" | "light" {
    const [theme, setTheme] = useState<"dark" | "light">(mode === 'media' ? currentMediaTheme() : mode);

    useEffect(() => {
        if (mode === 'media') {
            const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)") as MediaQueryList | undefined;
            const listener = (e: MediaQueryListEvent) => {
                setTheme(e.matches ? "dark" : "light");
            };
            mediaQuery?.addEventListener("change", listener);
            return () => {
                mediaQuery?.removeEventListener("change", listener);
            };
        } else {
            setTheme(mode);
        }
    }, [mode]);

    return theme;
}
