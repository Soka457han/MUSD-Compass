import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MUSD Compass",
  description: "Where Mezo MUSD earns the most after costs — cash first, locked veMEZO beside it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
