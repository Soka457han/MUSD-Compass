"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./Icons";

/** The phone status bar / installed-app bar colour follows the theme. */
const paintBar = (dark: boolean) => document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1015" : "#ffffff");

/** Light is the default; the choice is kept per browser (the layout applies it before paint). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = document.documentElement.dataset.theme === "dark";
    setDark(saved); // eslint-disable-line react-hooks/set-state-in-effect
    paintBar(saved);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    paintBar(next);
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
