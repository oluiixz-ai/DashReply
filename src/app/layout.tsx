import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DashReply — Automação inteligente para Instagram",
  description: "Gerencie automações, comentários, mensagens e contatos do Instagram em um só lugar.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
