"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./Icons";

/** Light is the default; the choice is kept per browser (the layout applies it before paint). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []); // eslint-disable-line react-hooks/set-state-in-effect

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // private mode: the choice lasts for this page only
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:bg-surface"
    >
      {dark ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
    </button>
  );
}
