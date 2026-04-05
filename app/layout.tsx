import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tec SEO Auditor",
  description: "Serverless technical SEO audits for Next.js and Vercel sites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
