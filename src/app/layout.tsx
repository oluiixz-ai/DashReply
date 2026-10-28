import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "DashReply — Automação inteligente para Instagram",
  description: "Gerencie automações, comentários, mensagens e contatos do Instagram em um só lugar.",
  applicationName: "DashReply",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DashReply",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6d28d9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body><PwaRegister />{children}</body></html>;
}
