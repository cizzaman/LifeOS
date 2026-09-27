import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import ObserverScope from "@/components/ObserverScope";
import SecurityBanner from "@/components/SecurityBanner";
import { observerScopeScript } from "@/lib/observer";
import { themeScript } from "@/lib/theme-script";
import CommandPalette from "@/components/palette/CommandPalette";
import TemplateOnboarding from "@/components/TemplateOnboarding";
import { Providers } from "./providers";
import "./globals.css";
import "./telos/_v7/styles.css";

export const metadata: Metadata = {
  title: "Pulse | Home",
  description: "LifeOS Observability Dashboard",
  // The header mark (.fig-hub) on the header ground; theme-script swaps -dark for -light.
  icons: {
    icon: [
      { url: "/pulse-icon-dark.svg", type: "image/svg+xml" },
      { url: "/pulse-icon-dark.png", type: "image/png", sizes: "64x64" },
    ],
    apple: "/pulse-touch-dark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-paint: applies observer class + route scope before first render so
            a reload with observer on never flashes personal data. */}
        <script dangerouslySetInnerHTML={{ __html: observerScopeScript() }} />
        {/* Theme: the script alone owns data-theme and .dark on <html>, so a client re-render
            (a redirect, an error boundary) can never put the other theme back. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body className="font-sans">
        <Providers>
          <SecurityBanner />
          <AppHeader />
          <ObserverScope />
          <CommandPalette />
          <TemplateOnboarding />
          <main className="min-h-screen max-w-[1920px] mx-auto w-full overflow-x-hidden relative">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
