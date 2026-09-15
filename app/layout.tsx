import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next + Electron Desktop Kit",
  description: "A friendly desktop-app starter for Next.js developers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
