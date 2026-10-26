import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fontsource's Plus Jakarta Sans latin file (wght axis), loaded through next/font so it is preloaded.
const jakarta = localFont({
  src: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MUSD Compass",
  description: "Where Mezo MUSD earns the most after costs — cash first, locked veMEZO beside it.",
};

// Dark is the default; a saved "light" choice is applied before paint so the page never flashes dark first.
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
