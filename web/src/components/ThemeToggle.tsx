"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./Icons";

/** Dark is the default; the choice is kept per browser (the layout applies it before paint). */
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []); // eslint-disable-line react-hooks/set-state-in-effect

  const toggle = () => {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      // private mode: the choice lasts for this page only
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:bg-surface"
    >
      {light ? <MoonIcon className="size-[18px]" /> : <SunIcon className="size-[18px]" />}
    </button>
  );
}
