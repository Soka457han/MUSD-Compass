import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fontsource's Archivo latin file (wdth + wght axes), loaded through next/font so it is preloaded:
// the CSS @import only found it after the stylesheet, which pushed the price figure (the LCP) past 3 s.
const archivo = localFont({
  src: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

export const metadata: Metadata = {
  title: "MUSD Compass",
  description: "Where Mezo MUSD earns the most after costs — cash first, locked veMEZO beside it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
