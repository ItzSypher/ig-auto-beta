import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IG Auto",
  description: "Automação de Instagram — comentário vira DM, sem mensalidade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
