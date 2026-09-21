import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matchflix — Escolham. Combinem. Assistam.",
  description: "Encontre o filme que todo mundo quer ver. Reúna seus amigos, deslize e dê match.",
};

export const viewport: Viewport = {
  themeColor: "#161618",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
