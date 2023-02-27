import { useEffect, useState } from "react";

export function currentMediaTheme(): "dark" | "light" {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
    } else {
        return "light";
    }
}

export function useCurrentMediaTheme(): "dark" | "light" {
    const [theme, setTheme] = useState<"dark" | "light">(currentMediaTheme());

    useEffect(() => {
        const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)") as MediaQueryList | undefined;
        const listener = (e: MediaQueryListEvent) => {
            setTheme(e.matches ? "dark" : "light");
        };
        mediaQuery?.addEventListener("change", listener);
        return () => {
            mediaQuery?.removeEventListener("change", listener);
        };
    }, []);

    return theme;
}
