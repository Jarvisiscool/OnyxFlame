"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const EVENT = "sl-theme-change";

function read(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Light/dark switch. The initial theme is set before paint by the script in layout.tsx. */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, read, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("sl-theme", next);
        } catch {}
        window.dispatchEvent(new Event(EVENT));
      }}
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
