"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clampStudyZoom } from "@/lib/reader-zoom";
import { SETTINGS_KEY, type Theme } from "@/lib/reader-model";
type Preferences = {
  theme: Theme;
  noteTextPx: number;
  studyZoomPercent: number;
  setStudyZoomPercent: (zoom: number) => void;
  setTheme: (theme: Theme) => void;
  setNoteTextPx: (size: number) => void;
};
const Context = createContext<Preferences | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("auto");
  const [noteTextPx, setNoteTextPx] = useState(15);
  const [studyZoomPercent, setStudyZoomPercent] = useState(100);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
      if (["auto", "light", "dark"].includes(data.theme)) setTheme(data.theme);
      if (Number.isFinite(data.studyZoomPercent))
        setStudyZoomPercent(clampStudyZoom(data.studyZoomPercent));
      if (Number.isFinite(data.noteTextPx))
        setNoteTextPx(Math.max(13, Math.min(19, data.noteTextPx)));
    } catch {
      /* Use safe defaults when settings are unavailable. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "auto" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.style.setProperty(
        "--note-size",
        `${noteTextPx}px`,
      );
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ theme, noteTextPx, studyZoomPercent }),
      );
    } catch {
      /* Reader persistence reports unavailable storage separately. */
    }
    return () => media.removeEventListener("change", apply);
  }, [theme, noteTextPx, studyZoomPercent, loaded]);
  return (
    <Context.Provider
      value={{
        theme,
        noteTextPx,
        studyZoomPercent,
        setStudyZoomPercent: (zoom) =>
          setStudyZoomPercent(clampStudyZoom(zoom)),
        setTheme,
        setNoteTextPx,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider is required");
  return value;
}
