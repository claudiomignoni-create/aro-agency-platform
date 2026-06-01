import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARO Lab Internal",
  description: "Internal platform for ARO Models and ARO Lab"
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
