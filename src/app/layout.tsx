import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARO Internal",
  description: "Internal platform for ARO Models",
  icons: {
    icon: "/favicon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
