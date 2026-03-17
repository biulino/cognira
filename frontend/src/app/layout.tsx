import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import SwRegister from "@/components/SwRegister";
import AntiCopy from "@/components/AntiCopy";
import ThemeProvider from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { BrandingProvider } from "@/lib/branding";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cognira",
  description: "Mystery Shopping & Market Research Platform",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" className={inter.variable} style={{ colorScheme: "light" }}>
      <body className="antialiased font-sans bg-white text-gray-900">
        <I18nProvider>
          <BrandingProvider>
          <AntiCopy />
          <ThemeProvider />
          <SwRegister />
          <ToastProvider><AppShell>{children}</AppShell></ToastProvider>
          </BrandingProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
