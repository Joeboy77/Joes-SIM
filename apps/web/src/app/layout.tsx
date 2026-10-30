import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@/styles/globals.css";
import { OfflineSupport } from "@/components/OfflineSupport";

// Atkinson Hyperlegible is designed for low-vision readers; JetBrains Mono keeps 0/O and 1/l apart.
const sans = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Joe's SIM: learn how computers work",
    template: "%s · Joe's SIM",
  },
  description:
    "A free, open-source Little Man Computer simulator and learning environment. No account needed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">
        {children}
        <OfflineSupport />
      </body>
    </html>
  );
}
